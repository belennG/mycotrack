"""Run the evals against the real model:  python -m evals  (from backend/).

Needs ANTHROPIC_API_KEY (read from backend/.env). Costs about a cent or two for the full set.
Exit code: 0 all good, 1 an eval failed, 2 no API key.
"""

import argparse
import json
import os
import sys

import anthropic
from dotenv import load_dotenv

from agent.loop import DEFAULT_MODEL
from evals.cases import CASES
from evals.runner import RUNS, format_report, passed, run_all


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate the MycoTrack assistant.")
    parser.add_argument(
        "--runs", type=int, default=RUNS, help="runs per case (default 3)"
    )
    parser.add_argument("--only", nargs="*", help="run only these case ids")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--json", help="also write the full results to this file")
    parser.add_argument("--list", action="store_true", help="list the cases and stop")
    args = parser.parse_args()

    if args.list:
        for case in CASES:
            print(f"{case.category:<10} {case.id}")
        return 0

    load_dotenv()
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set. Put it in backend/.env.")
        return 2

    chosen = [c for c in CASES if not args.only or c.id in args.only]
    if not chosen:
        print("No case matches --only.")
        return 2

    print(f"Model: {args.model}. {len(chosen)} cases x {args.runs} runs.")
    client = anthropic.Anthropic(timeout=60.0)
    reports = run_all(
        chosen,
        client,
        model=args.model,
        runs=args.runs,
        on_done=lambda r: print(
            f"  done {r.case.id}: {r.passes}/{len(r.runs)}", flush=True
        ),
    )
    print(format_report(reports))

    if args.json:
        with open(args.json, "w") as out:
            json.dump(
                [
                    {
                        "id": r.case.id,
                        "category": r.case.category,
                        "passes": r.passes,
                        "required": r.required,
                        "runs": [
                            {
                                "passed": run.passed,
                                "failures": run.failures,
                                "tools": run.tools,
                                "answer": run.answer,
                            }
                            for run in r.runs
                        ],
                    }
                    for r in reports
                ],
                out,
                indent=1,
                ensure_ascii=False,
            )
    return 0 if passed(reports) else 1


if __name__ == "__main__":
    sys.exit(main())
