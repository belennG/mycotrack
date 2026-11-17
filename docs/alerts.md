# Alerts

How MycoTrack decides that a batch needs attention. Everything here is plain code, tested and
explainable. **No model decides whether an alert is raised.**

## Status

| Piece | State |
| --- | --- |
| Safe ranges by crop type | Done |
| Threshold and trend rules, alerts saved when a reading is saved | Done |
| Alerts page and Dashboard marker in the app | Next |
| The assistant explaining an alert that has fired | Planned |
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
