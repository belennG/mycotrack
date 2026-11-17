"""Alert rules, and recording the alerts they raise.

Two kinds of rule, both plain code so they can be tested and explained:

* **Threshold**: the latest reading of a metric is outside the safe range for the crop.
* **Trend**: the metric is still inside the range but has moved the same way on each of the last
  few readings, and at that pace it would cross a limit within the next two days.

Nothing here calls a model. An assistant may *explain* an alert that was raised, but whether one
is raised is decided by these rules.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Sequence

from sqlalchemy.orm import Session

from models.alert import Alert
from models.batch import Batch
from models.tracking import Tracking
from services.thresholds import DEFAULT_THRESHOLDS, Thresholds, thresholds_for

__all__ = [
    "DEFAULT_THRESHOLDS",
    "generate_alerts",
    "detect_trend_alerts",
    "record_alerts",
]

METRICS = ["temperature", "humidity", "ph_level", "moisture"]

# Trend rule: this many readings in a row, all moving the same way, ...
TREND_WINDOW = 4
# ... by at least this share of the safe range in total (so sensor jitter does not count), ...
MIN_MOVE_FRACTION = 0.05
# ... and crossing a limit within this many hours at the pace of those readings.
TREND_HORIZON_HOURS = 48.0


def generate_alerts(
    tracking: Tracking, thresholds: Thresholds | None = None
) -> List[Dict[str, Any]]:
    """
    Evaluates a single daily tracking against environmental thresholds.
    Generates specific alert types for deviations and missing data.
    """
    if thresholds is None:
        thresholds = DEFAULT_THRESHOLDS

    alerts = []

    for metric in METRICS:
        value = getattr(tracking, metric, None)
        readable_metric = metric.replace("_", " ").title()

        # 1. Missing Data Alert
        if value is None:
            alerts.append(
                {
                    "batch_id": tracking.batch_id,
                    "alert_type": "missing_data",
                    "severity": "warning",
                    "message": f"Missing data alert: No reading recorded for {readable_metric}.",
                }
            )
            continue

        # 2. Value Deviation Alerts
        metric_limits = thresholds.get(metric, {})
        min_limit = metric_limits.get("min", -float("inf"))
        max_limit = metric_limits.get("max", float("inf"))

        if value < min_limit or value > max_limit:
            # Map the exact alert types requested in the ticket
            alert_type_mapping = {
                "temperature": "temperature_out_of_range",
                "humidity": "humidity_deviation",
                "ph_level": "ph_level_anomaly",
                "moisture": "moisture_level_critical",
            }

            condition = "low" if value < min_limit else "high"

            alerts.append(
                {
                    "batch_id": tracking.batch_id,
                    "alert_type": alert_type_mapping.get(metric, "unknown_anomaly"),
                    "severity": "critical",
                    "message": (
                        f"{readable_metric} is too {condition} ({value}). "
                        f"Safe range is {min_limit} to {max_limit}."
                    ),
                }
            )

    return alerts


def _naive_utc(moment: datetime) -> datetime:
    """The database returns naive datetimes; a reading just created may carry a timezone."""
    if moment.tzinfo is not None:
        return moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment


def detect_trend_alerts(
    readings: Sequence[Tracking],
    thresholds: Thresholds | None = None,
    horizon_hours: float = TREND_HORIZON_HOURS,
) -> List[Dict[str, Any]]:
    """Warn about metrics that are heading out of range, before they get there.

    ``readings`` may be in any order. A metric needs ``TREND_WINDOW`` readings with a value;
    only the most recent ones count.
    """
    thresholds = thresholds or DEFAULT_THRESHOLDS
    ordered = sorted(readings, key=lambda reading: _naive_utc(reading.tracking_date))
    alerts: List[Dict[str, Any]] = []

    for metric in METRICS:
        points = [
            (_naive_utc(reading.tracking_date), getattr(reading, metric))
            for reading in ordered
            if getattr(reading, metric, None) is not None
        ][-TREND_WINDOW:]
        if len(points) < TREND_WINDOW:
            continue

        limits = thresholds.get(metric, {})
        low, high = limits.get("min"), limits.get("max")
        if low is None or high is None:
            continue

        values = [value for _, value in points]
        latest = values[-1]
        if not low <= latest <= high:
            continue  # already out of range: the threshold rule covers it

        steps = [later - earlier for earlier, later in zip(values, values[1:])]
        if all(step < 0 for step in steps):
            direction, limit = "low", low
        elif all(step > 0 for step in steps):
            direction, limit = "high", high
        else:
            continue

        if abs(latest - values[0]) < MIN_MOVE_FRACTION * (high - low):
            continue

        span_hours = (points[-1][0] - points[0][0]).total_seconds() / 3600
        if span_hours <= 0:
            continue
        rate = (latest - values[0]) / span_hours  # per hour, signed
        hours_to_limit = (limit - latest) / rate
        if hours_to_limit > horizon_hours:
            continue

        name = metric.replace("_", " ").title()
        verb = "fallen" if direction == "low" else "risen"
        bound = "below" if direction == "low" else "above"
        alerts.append(
            {
                "batch_id": ordered[-1].batch_id,
                "alert_type": f"{metric}_trending_{direction}",
                "severity": "warning",
                "message": (
                    f"{name} has {verb} on each of the last {TREND_WINDOW} readings "
                    f"({values[0]:g} to {latest:g}). At this pace it would go {bound} "
                    f"{limit:g} in about {max(hours_to_limit, 0):.0f} hours."
                ),
            }
        )

    return alerts


def record_alerts(
    db: Session, batch: Batch, now: datetime | None = None
) -> List[Alert]:
    """Evaluate a batch's latest readings and save the alerts that should be raised.

    Called after a reading is saved (the caller commits). A kind of alert that is still
    unacknowledged for the batch is not raised twice. Missing-data notices are not saved: a
    reading with only some of the metrics is normal.
    """
    db.flush()  # the reading that was just added has to be visible to the queries below
    readings: List[Tracking] = (
        db.query(Tracking)
        .filter(Tracking.batch_id == batch.id)
        .order_by(Tracking.tracking_date.desc())
        .limit(TREND_WINDOW * 2)
        .all()
    )
    if not readings:
        return []

    thresholds = thresholds_for(batch.crop_type)
    candidates = [
        alert
        for alert in generate_alerts(readings[0], thresholds)
        if alert["alert_type"] != "missing_data"
    ]
    candidates += detect_trend_alerts(readings, thresholds)

    open_types = {
        alert_type
        for (alert_type,) in db.query(Alert.alert_type).filter(
            Alert.batch_id == batch.id, Alert.is_acknowledged.is_(False)
        )
    }
    created: List[Alert] = []
    for candidate in candidates:
        if candidate["alert_type"] in open_types:
            continue
        alert = Alert(**candidate)
        if now is not None:
            alert.created_at = now
        db.add(alert)
        created.append(alert)
        open_types.add(candidate["alert_type"])
    db.flush()
    return created
