# Alerts

How MycoTrack decides that a batch needs attention. Everything here is plain code, tested and
explainable. **No model decides whether an alert is raised.**

## Status

| Piece | State |
| --- | --- |
| Safe ranges by crop type | Done |
| Threshold and trend rules, alerts saved when a reading is saved | Done |
| Alerts page, header count, Dashboard marker, acknowledging an alert | Done |
| The assistant judging each batch by its crop's ranges | Done |
| The assistant knowing about, and explaining, the alerts that have fired | Next |
| Email | Planned |

## Safe ranges by crop type

`backend/services/thresholds.py` holds one table: oyster, shiitake and lion's mane, with the
oyster ranges as the default for any other crop. The numbers are approximate fruiting-stage
values from common growing guides, not agronomic advice; a grower's substrate and strain shift
them. Keeping them in one reviewed table (and not in a model's head) is the point.

## The two rules (`backend/services/alerts.py`)

- **Threshold**: the latest reading of a metric is outside the safe range. Severity *critical*.
- **Trend**: the metric is still inside the range, but on each of the last 4 readings it moved
  the same way, by at least 5 % of the range in total, and at that pace it would cross a limit
  within 48 hours. Severity *warning*. This is the "humidity is dropping" alert: it fires while
  there is still time to act.

Both are evaluated when a reading is saved (`POST /api/v1/trackings/`). An alert of a kind that
is still unacknowledged for a batch is not raised twice. A reading with only some of the metrics
does not produce "missing data" alerts, which would be noise; the batch summary still reports
them.

## What it does not do yet

- Editing a reading does not re-evaluate alerts.
- Nothing notices that a batch *stopped* receiving readings: that needs a scheduled job, because
  no reading arrives to trigger the check.
- Alerts are not resolved automatically when a batch goes back in range; they are acknowledged
  by a person.

## In the app and in the demo

The Alerts page lists open alerts (and, on another tab, acknowledged ones). The header shows how
many are open and each batch card on the Dashboard shows its own count: red when any of them is
already out of range, orange when it is only heading there.

The demo has no backend, so `frontend/src/demo/alertRules.ts` is a TypeScript copy of the rules.
Two copies of rules can drift, so both are run against the same cases in
`backend/tests/alert_cases.json` (`test_alert_cases.py` and `alertRules.test.ts`): change a rule
in one place and the other suite fails until it is changed too.
