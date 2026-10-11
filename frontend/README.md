# Agent Hub Console

Build a dark-mode "AI Agent Operations Console" in React and Tailwind CSS that connects to a local FastAPI WebSocket server at ws://localhost:8000/ws, with a full mock simulation fallback so the UI is immediately interactive offline.

Layout and Features:
1. Header:
   - Title: "HARNESS OPERATIONS CONSOLE" with a pulsing green indicator
   - Model Select dropdown: local (qwen3.5:4b), gpt (gpt-5.2), and claude (claude-sonnet-5) (calls POST /api/model/:name on change)
   - Status indicators: "Connected (127.0.0.1:8000)" | "Limit: 8 Steps" | "12 Tools"

2. Left Column (60% width):
   - Diagnostic Test Bar with 4 quick-action buttons:
     * "📁 Storage Policy" (triggers sandbox storage isolation check)
     * "🌐 Egress Policy" (triggers outbound API rule verification)
     * "🔒 Network Policy" (triggers internal routing restriction check)
     * "✍️ File Write Request" (triggers file write authorization prompt)
   - Chat Stream: Scrollable feed showing User prompt cards, Tool execution cards (yellow badge with tool name & ms execution duration, expandable arguments/results), and Assistant response cards.
   - Execution Bar: Prompt input box with "EXECUTE" and "CLEAR" buttons.

3. Right Column (40% width, 3 Tabs):
   - Tab 1 "Telemetry": 4 metric stat cards (LLM Steps: N/8, Total Tokens, Tool Count, Status), plus a scrollable viewer of JSONL trace events with syntax highlighting.
   - Tab 2 "Compliance Audit": Feed of policy enforcement events showing rule tag (Storage Boundary, Egress Policy, Network Routing), timestamp, status badge, and target.
   - Tab 3 "Tasks": Displays active task goal from tasks.json with an interactive checklist of subtasks (pending / completed states).

4. Human-in-the-Loop Modal:
   - When receiving an approval event ({type: "approval_required", approval_id, tool, filename, content_preview}):
     * Modal header: "⚠️ SENSITIVE WRITE APPROVAL"
     * Displays target file name and code/content preview
     * Action buttons: "APPROVE WRITE" (sends {type: "approval_response", approval_id, approved: true}) and "DENY" (approved: false).

5. WebSocket & Simulation Engine:
   - Connects to ws://localhost:8000/ws.
   - When offline or unreachable, seamlessly runs realistic mock simulation: clicking diagnostic buttons or typing prompts streams realistic tool steps, telemetry updates, and approval prompts.
   - Support message types: init, run_started, run_completed, approval_required, run_error.
   - Vite proxy configuration for /api and /ws pointing to http://127.0.0.1:8000.
   - Polished dark terminal UI theme with high contrast, monospaced metrics, and smooth transitions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/58025162-23ec-4835-bac3-a5d20934ddd2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
