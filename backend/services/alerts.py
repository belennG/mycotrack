from typing import List, Dict, Any
from models.daily_log import DailyLog

# Configurable default thresholds (e.g., ideal for Oyster mushrooms)
# These can easily be overridden by passing a custom dictionary to the function
DEFAULT_THRESHOLDS = {
    "temperature": {"min": 20.0, "max": 25.0},
    "humidity": {"min": 85.0, "max": 95.0},
    "ph_level": {"min": 6.0, "max": 7.5},
    "moisture": {"min": 75.0, "max": 90.0},
}


def generate_alerts(
    log: DailyLog, thresholds: Dict[str, Dict[str, float]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates a single daily log against environmental thresholds.
    Generates specific alert types for deviations and missing data.
    """
    if thresholds is None:
        thresholds = DEFAULT_THRESHOLDS

    alerts = []

    # Define the core metrics we need to monitor
    metrics = ["temperature", "humidity", "ph_level", "moisture"]

    for metric in metrics:
        value = getattr(log, metric, None)
        readable_metric = metric.replace("_", " ").title()

        # 1. Missing Data Alert
        if value is None:
            alerts.append(
                {
                    "batch_id": log.batch_id,
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
                    "batch_id": log.batch_id,
                    "alert_type": alert_type_mapping.get(metric, "unknown_anomaly"),
                    "severity": "critical",
                    "message": (
                        f"{readable_metric} is too {condition} ({value}). "
                        f"Safe range is {min_limit} to {max_limit}."
                    ),
                }
            )

    return alerts
