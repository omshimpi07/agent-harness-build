# Definitive Critique: GPT-5 Plan vs Sonnet Plan vs Reality

**Reviewed by:** Antigravity (Claude Opus 4.6 Thinking)
**Based on:** Actual inspection of [harness.py](file:///d:/agent-harness-build/harness.py) (306 lines), all version files, config, workspace, and memory.
**Time now:** ~12:23 AM IST, October 11. Interview is in ~24 hours.

---

## The Ground Truth: What You Actually Have

Your entire harness is **306 lines of clean Python** in one file. Here is what is real vs. what the plans assume:

| Capability | Actually Exists? | Evidence |
|---|---|---|
| Agent loop (repeat until done) | ✅ Yes | `while True:` at [line 226](file:///d:/agent-harness-build/harness.py#L226) |
| Local tools (list, read, write, save_memory) | ✅ Yes | [lines 80–99](file:///d:/agent-harness-build/harness.py#L80-L99) |
| MCP integration (time, fetch servers) | ✅ Yes | [lines 179–205](file:///d:/agent-harness-build/harness.py#L179-L205) |
| Model registry (local + cloud switching) | ✅ Yes | [lines 33–57](file:///d:/agent-harness-build/harness.py#L33-L57) |
| Conversation history in-session | ✅ Yes | Global `messages` list [line 169](file:///d:/agent-harness-build/harness.py#L169) |
| File-based memory (memory.md) | ✅ Yes | [lines 64–73](file:///d:/agent-harness-build/harness.py#L64-L73) |
| Slash commands (/model, /tools, etc.) | ✅ Yes | [lines 249–276](file:///d:/agent-harness-build/harness.py#L249-L276) |
| **Max-step limit** | ❌ **NO** | `while True` with no counter |
| **Path traversal protection** | ❌ **NO** | `WORKSPACE / filename` with no `.resolve()` check |
| **Write approval (y/n)** | ❌ **NO** | `write_file` executes silently |
| **Tool error handling** | ❌ **NO** | No try/except around `call_tool` |
| **Tool timeout** | ❌ **NO** | Awaits forever |
| **URL size limit** | ❌ **NO** | MCP fetch returns whatever it gets |
| **Tracing / logging** | ❌ **NO** | Only `print(f"  [tool] ...")` |
| **Any tests** | ❌ **NO** | Zero test files |
| **Verification step** | ❌ **NO** | Model's first answer is final |

This is a **tutorial-quality agent loop** — clean, working, but with zero production engineering. Both plans correctly identify this, but they diverge on what to do about it.

---

## Head-to-Head: GPT-5 vs Sonnet

### Overall Verdict

| Dimension | GPT-5 Plan | Sonnet Plan | Winner |
|---|---|---|---|
| **Accuracy about your code** | Assumed more than exists, never saw the files | More accurately scoped, but also never saw the files | Sonnet |
| **Prioritization** | Tracing & mocks first, demo second | Eval suite first, safety second, demo built-in | **Sonnet** |
| **Practical realism** | 12-test mock suite is academic busywork | Before/after eval table is a CTO killer feature | **Sonnet** |
| **Time estimates** | 5–7h (too optimistic) | 7h core + 5h wow (too optimistic, but honest about it) | **Sonnet** |
| **CTO demo impact** | "Here is a trace JSON" (yawn) | "Same 4B model, bare loop vs. full harness, X% → Y%" (wow) | **Sonnet** |
| **Cut discipline** | Lists non-goals but no cut order | Explicit cut order: lessons → skills → reduce eval tasks | **Sonnet** |
| **Risk of 4B model** | Acknowledges but doesn't adapt | Explicitly says "make verification code-only if 4B is bad" | **Sonnet** |

> **Sonnet's plan is significantly better for a 1-day sprint.** GPT-5's plan reads like an architecture doc for a team with a week. Sonnet's reads like a battle plan for a solo developer with a clock.

---

## 1. The 3 Most Likely Ways EACH Plan Fails

### Sonnet's Plan (the better one) — still has these failure modes:

1. **Eval Suite Time Bomb (Block 1, "2 hours")**
   Running 15 tasks × 2 runs (before + after) against Qwen 4B on local inference will take **30–90 seconds per task per run**. That is 15–45 minutes of *pure waiting per run*, plus debugging flaky string-match scoring. Real time for Block 1: **3–4 hours**, not 2.

2. **HTML Trace Viewer Scope Creep (Block 3, "1.5 hours")**
   Writing a "small HTML timeline page" from scratch means HTML + CSS + JS + JSON parsing + file serving. You will spend 2 hours making it look presentable and another hour debugging edge cases. This is a vanity feature that a CTO will glance at for 5 seconds.

3. **Qwen 4B Chokes on the Hero Demo**
   The "research assistant" demo requires: `list_files` → `read_file` → extract URL → `fetch` (returns thousands of tokens of markdown) → synthesize a summary. A 4B model will lose instruction-following after ingesting a large fetched page. The demo fails live, and the eval numbers collapse.

### GPT-5's Plan — these are worse:

1. **Mocking Trap:** 12 mocked tests pass. Live model fails. CTO asks "run it live" and it falls apart.
2. **No Quantified Impact:** "Here is a trace log" is not a story. No before/after numbers = nothing memorable.
3. **Architecture Paralysis:** Spending the first hour "mapping current architecture to target boundaries" on a 306-line file is pure procrastination.

---

## 2. What to CUT and What is MISSING

### CUT from Sonnet's plan:

| Feature | Verdict | Why |
|---|---|---|
| HTML trace viewer | **CUT** | Print colored terminal output or save JSONL. A CTO reads logs, not custom dashboards. |
| LLM-based verification | **CUT** | Qwen 4B cannot reliably self-check. Code-only verification (file exists? path safe? response non-empty?) is sufficient and deterministic. |
| Skills folder (Block 6) | **CUT** | Cool concept but adds prompt bloat to a 4B model with limited context. Mention it as "future work." |
| Lessons memory (Block 7) | **CUT** | Reflexion requires a model that can synthesize generalizations from failure. 4B models cannot. |
| 15 eval tasks | **REDUCE to 7** | 3 single-tool, 2 multi-step, 1 safety (path traversal), 1 recovery (missing file). Enough for a real before/after table without burning 4 hours on eval runs. |

### CUT from GPT-5's plan:

| Feature | Verdict | Why |
|---|---|---|
| Repeated-call detection | **CUT** | Hard `max_steps` is sufficient. Heuristic duplicate detection is subtle, buggy, and adds no demo value. |
| Separate `MAX_TOOL_CALLS` budget | **CUT** | Redundant with `MAX_STEPS`. One limit is enough. |
| 10+ event types for tracing | **CUT** | 4 event types are sufficient: `step_start`, `tool_call`, `tool_result`, `run_end`. |
| Full `pytest` mock suite | **REDUCE** | 3 tests max: tool dispatch, circuit breaker, error recovery. |

### MISSING from BOTH plans (what a CTO expects):

1. **`PROVIDER=ollama|openai` live switch during the demo**
   You already have model configs for GPT and Claude in your registry! But neither plan tells you to *demo the switch*. Showing `"/model local"` → runs on Qwen 4B locally → `"/model gpt"` → same harness, same tools, now using GPT-5 → *"The harness is model-agnostic"* is a **10-second CTO wow moment** that costs zero implementation time.

2. **Token/latency accounting per step**
   The `response` object from OpenAI's API (and Ollama's compatible endpoint) returns `usage.prompt_tokens` and `usage.completion_tokens`. Logging these per step costs 3 lines of code and shows production awareness.

3. **Graceful degradation story**
   Neither plan addresses: "What happens when Ollama is down? What happens when the API key is invalid?" The harness should catch connection errors and report them cleanly instead of crashing with a stack trace.

---

## 3. What is Unrealistic for Qwen 4B

| Feature | Realistic? | Why |
|---|---|---|
| Single tool call (list_files, read_file) | ✅ Works | Simple, short schema, short result |
| 2-step chain (list → read) | ⚠️ Usually works | May need prompt engineering |
| 3+ step chain with URL fetch | ❌ Unreliable | Fetched content floods the context window; model loses the thread |
| LLM self-verification | ❌ No | 4B models rubber-stamp their own output |
| Reflexion / lesson synthesis | ❌ No | Cannot generalize from failures |
| Extracting a URL from file content and deciding to fetch it | ⚠️ Fragile | Requires instruction-following across tool boundaries |
| Correct JSON argument formatting after 3+ turns | ⚠️ Degrades | Small models produce malformed JSON as context grows |

### The safe demo strategy for Qwen 4B:
- **2-step max chains** for the live demo (list → read → answer)
- **Keep the 3-step "research" demo** but run it against GPT/Claude via `/model gpt` during the interview, then show the *same task* attempted on local 4B with the trace showing where it struggled
- This turns a weakness into a strength: *"The eval framework lets me measure exactly where a 4B model breaks down vs. a frontier model, on the same harness"*

---

## 4. Realistic Time Estimates (Adjusted)

Based on your actual 306-line codebase and Qwen 4B inference speed:

| Block | Sonnet's Estimate | Realistic | Notes |
|---|---|---|---|
| 0. Setup (baseline copy, fixtures) | 0.5h | **0.5h** | ✅ Fair — it is a file copy and `git init` |
| 1. Eval suite + baseline run | 2h | **3.5–4h** | Writing 7 task scripts + scoring logic + waiting for 4B inference × 7 tasks × multiple debug iterations |
| 2. Safety layer | 1.5h | **1.5h** | ✅ Fair — path check, approval prompt, timeout, max_steps are all small code changes to one file |
| 3. Trace + viewer | 1.5h | **1h (JSONL only, no HTML)** | Cut the HTML viewer, just emit structured JSONL |
| 4. Verification + re-eval | 1.5h | **1.5h (code-only checks + re-run 7 tasks)** | Skip LLM verification entirely |
| 5. Task file + resume | 1.5h | **2h** | State serialization is fiddly |
| 6. Skills folder | 1h | **CUT** | |
| 7. Lessons memory | 1.5h | **CUT** | |
| 8. Polish + README + demo script | 1h | **1.5h** | Always takes longer than expected |

**Realistic total for the CORE path: ~8 hours**
**With Block 5 (resume): ~10 hours**
**You have ~20 waking hours if you start now. Tight but doable for core + resume + polish.**

---

## 5. The Safer, Higher-Impact Strategy

Here is what I recommend — a hybrid of Sonnet's plan (better structure) with critical fixes:

### The One Sentence for the CTO:
*"I built a model-agnostic agent harness, added production-grade safety controls, and measured the improvement with an automated eval that runs on any model — local 4B or cloud frontier — through the same interface."*

### The 3-Minute Demo Script:
1. **Start the harness** → show it connects to MCP, loads memory, lists tools
2. **Run a task on local Qwen 4B**: "List my workspace files and tell me what's in summary.txt" (2-step chain, reliable on 4B)
3. **Show the safety**: "Read ../secret.txt" → blocked. "Write a file" → y/n approval prompt
4. **Show the trace**: Cat the JSONL log → every step visible with tool, args, duration, status, exit reason
5. **Switch to cloud model**: `/model gpt` → run the same task → show it works identically through the same harness
6. **Show the eval table**: "Here are my before/after numbers — same 7 tasks, same Qwen 4B. Baseline: X/7. With safety + tracing: Y/7."
7. **Show the circuit breaker**: Give a task that would loop forever → harness stops at step 5 with `max_steps_exceeded`
8. **Architecture walkthrough**: "Here are the 5 components: model adapter, tool registry, agent loop with safety, trace logger, eval suite"

### What makes this SAFE:
- The 2-step demo on 4B is **reliable**
- The model switch proves **architecture quality** without relying on 4B for hard tasks
- The eval table provides **quantified evidence**
- The safety demo is **deterministic** (path check is code, not model judgment)
- If Qwen 4B chokes on anything, you say: *"That's exactly why the eval exists — it measures where models fail, so I can make engineering decisions about which model to use for which task"*

---

## Final Verdict: Scores

| Dimension | GPT-5 Plan | Sonnet Plan | My Recommended Hybrid |
|---|---|---|---|
| Architecture quality | 7/10 | 7/10 | 8/10 |
| One-day feasibility | 4/10 | 6/10 | 8/10 |
| CTO demo impact | 5/10 | 8/10 | 9/10 |
| Testability | 6/10 | 7/10 | 8/10 |
| Safety awareness | 6/10 | 8/10 | 9/10 |
| Model realism (4B) | 4/10 | 7/10 | 9/10 |

> [!IMPORTANT]
> **Go with Sonnet's structure, cut the HTML viewer and LLM verification, reduce eval to 7 tasks, and add the live model-switch demo.** That is your highest-impact, lowest-risk path.

---

## What To Do RIGHT NOW

Say **"go"** and I will start building the upgraded harness directly in your codebase — Block 0 (setup) and Block 2 (safety layer) first, since those are the foundation everything else depends on. No more planning. Code time.
