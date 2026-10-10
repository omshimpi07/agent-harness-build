import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent

def compare():
    baseline_file = ROOT / "results_baseline.json"
    v5_file = ROOT / "results_v5.json"

    if not baseline_file.exists():
        print("  ❌ Missing: eval/results_baseline.json")
        print("     Run: uv run eval/run_eval.py --baseline")
        return
    if not v5_file.exists():
        print("  ❌ Missing: eval/results_v5.json")
        print("     Run: uv run eval/run_eval.py")
        return

    baseline = json.loads(baseline_file.read_text(encoding="utf-8"))
    v5 = json.loads(v5_file.read_text(encoding="utf-8"))

    # Build lookup
    v5_map = {r["id"]: r for r in v5}

    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║      BEFORE / AFTER COMPARISON — Same Model, Same Tasks    ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  Task                           │  Before  │  After        ║")
    print("╠═════════════════════════════════╪══════════╪═══════════════╣")

    before_pass = 0
    after_pass = 0

    for b in baseline:
        tid = b["id"]
        v = v5_map.get(tid, {})
        b_mark = "✅" if b.get("passed") else "❌"
        v_mark = "✅" if v.get("passed") else "❌"
        if b.get("passed"):
            before_pass += 1
        if v.get("passed"):
            after_pass += 1

        name = f"{tid} {b['name']}"
        improved = " ← improved" if v.get("passed") and not b.get("passed") else ""
        print(f"║  {name:<31} │   {b_mark}    │   {v_mark}{improved:<10} ║")

    total = len(baseline)
    b_pct = 100 * before_pass // total if total else 0
    a_pct = 100 * after_pass // total if total else 0

    print("╠═════════════════════════════════╪══════════╪═══════════════╣")
    print(f"║  SCORE                          │ {before_pass}/{total} ({b_pct:>3}%) │ {after_pass}/{total} ({a_pct:>3}%)       ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    # Time comparison
    b_avg = sum(r.get("seconds", 0) for r in baseline) / total if total else 0
    a_avg = sum(r.get("seconds", 0) for r in v5) / total if total else 0
    print(f"\n  Avg time per task:  Before={b_avg:.1f}s  After={a_avg:.1f}s")
    print()


if __name__ == "__main__":
    compare()
