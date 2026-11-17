#!/usr/bin/env bash
# Turns the results of the weekly dependency audit into one GitHub issue.
#
#   - Something found, no open issue yet  -> open one.
#   - Something found, issue already open -> update its text (no new comment, so a problem that
#                                            stays open does not spam).
#   - All clean, an issue is open         -> say so and close it.
#   - All clean, no issue                 -> do nothing.
#
# It exits 1 when anything was found, so the workflow run itself turns red: that is what
# triggers GitHub's own failure email, in addition to the issue.
#
# Inputs (environment): NPM_OUTCOME, PIP_OUTCOME ("success" or "failure"), RUN_URL,
# and the files npm-audit.txt and pip-audit.txt in the current directory. `gh` must be
# authenticated (GH_TOKEN) with permission to write issues.
set -euo pipefail

LABEL="security-audit"
TITLE="Dependency audit found vulnerabilities"
MAX_LINES=60

open_issue() {
  gh issue list --label "$LABEL" --state open --json number --jq '.[0].number // empty'
}

section() { # heading, outcome, file
  local heading="$1" outcome="$2" file="$3"
  echo "### ${heading}"
  echo
  if [ "$outcome" = "failure" ]; then
    echo '```'
    head -n "$MAX_LINES" "$file"
    if [ "$(wc -l <"$file")" -gt "$MAX_LINES" ]; then
      echo "... (cut at ${MAX_LINES} lines; the full output is in the run)"
    fi
    echo '```'
  else
    echo "Nothing found."
  fi
  echo
}

existing="$(open_issue)"

if [ "${NPM_OUTCOME}" = "success" ] && [ "${PIP_OUTCOME}" = "success" ]; then
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --body "The audit is clean again (${RUN_URL}). Closing."
    gh issue close "$existing"
  fi
  echo "Audit clean."
  exit 0
fi

{
  echo "The scheduled dependency audit found vulnerabilities."
  echo
  echo "Run: ${RUN_URL}"
  echo
  section "Frontend: npm audit (high severity and above)" "$NPM_OUTCOME" npm-audit.txt
  section "Backend: pip-audit (any severity)" "$PIP_OUTCOME" pip-audit.txt
  echo "This issue is updated by the weekly audit and closes itself when the audit is clean."
  echo "Many of these will already have a Dependabot pull request."
} >report.md

if [ -n "$existing" ]; then
  gh issue edit "$existing" --body-file report.md
else
  gh label create "$LABEL" --color B60205 --description "Found by the scheduled dependency audit" 2>/dev/null || true
  gh issue create --title "$TITLE" --label "$LABEL" --body-file report.md
fi

echo "Audit found vulnerabilities."
exit 1
