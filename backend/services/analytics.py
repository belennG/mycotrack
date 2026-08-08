from typing import List, Dict, Any
from models.tracking import Tracking


def calculate_averages(trackings: List[Tracking]) -> Dict[str, float]:
    """
    Calculates the average of temperature, humidity and ph level and substrate humidity (moisture)
    """
    if not trackings:
        return {"temperature": 0.0, "humidity": 0.0, "ph_level": 0.0, "moisture": 0.0}

    metrics: dict = {
        "temperature": [],
        "humidity": [],
        "ph_level": [],
        "moisture": [],
    }

    for tracking in trackings:
        if tracking.temperature is not None:
            metrics["temperature"].append(tracking.temperature)
        if tracking.humidity is not None:
            metrics["humidity"].append(tracking.humidity)
        if tracking.ph_level is not None:
            metrics["ph_level"].append(tracking.ph_level)
        if tracking.moisture is not None:
            metrics["moisture"].append(tracking.moisture)

    averages = {}
    for key, values in metrics.items():
        averages[key] = round(sum(values) / len(values), 2) if values else 0.0

    return averages


def analyze_trends(trackings: List[Tracking]) -> Dict[str, str]:
    """
    Compare the averages for the first half of the period with those for the second half
    to determine whether the trend is increasing, decreasing or stable.
    """
    if len(trackings) < 2:
        return {
            "temperature": "stable",
            "humidity": "stable",
            "ph_level": "stable",
            "moisture": "stable",
        }

    # Sort the trackings by date in ascending order
    sorted_trackings = sorted(trackings, key=lambda x: x.tracking_date)  # type: ignore
    midpoint = len(sorted_trackings) // 2

    first_half = sorted_trackings[:midpoint]
    second_half = sorted_trackings[midpoint:]

    avg_first = calculate_averages(first_half)
    avg_second = calculate_averages(second_half)

    trends = {}
    for key in avg_first.keys():
        diff = avg_second[key] - avg_first[key]
        if diff > 0.5:  # Sensitivity threshold for determining that it is rising
            trends[key] = "increasing"
        elif diff < -0.5:
            trends[key] = "decreasing"
        else:
            trends[key] = "stable"

    return trends


def calculate_completeness(trackings: List[Tracking]) -> float:
    """
    Calculate the percentage of data entered.
    Check how many of the expected fields were actually filled in.
    """
    if not trackings:
        return 0.0

    expected_fields_per_tracking = 4  # temp, humidity, ph_level, moisture
    total_expected = len(trackings) * expected_fields_per_tracking
    actual_filled = 0

    for tracking in trackings:
        actual_filled += sum(
            1
            for field in [
                tracking.temperature,
                tracking.humidity,
                tracking.ph_level,
                tracking.moisture,
            ]
            if field is not None
        )

    return round((actual_filled / total_expected) * 100, 2)


def detect_anomalies(
    trackings: List[Tracking], thresholds: Dict[str, Dict[str, float]]
) -> List[Dict[str, Any]]:
    """
    Detects whether any recent values fall outside the safe ranges (thresholds).
    Example of thresholds: {'temperature': {'min': 20.0, 'max': 25.0}}
    """
    anomalies: list[dict] = []
    if not trackings:
        return anomalies

    # We only check the most recent tracking to detect current anomalies
    latest_tracking = sorted(trackings, key=lambda x: x.tracking_date, reverse=True)[0]

    for metric, limits in thresholds.items():
        value = getattr(latest_tracking, metric, None)
        if value is not None:
            if value < limits.get("min", -float("inf")):
                anomalies.append(
                    {
                        "metric": metric,
                        "issue": "too_low",
                        "value": value,
                        "threshold": limits["min"],
                    }
                )
            elif value > limits.get("max", float("inf")):
                anomalies.append(
                    {
                        "metric": metric,
                        "issue": "too_high",
                        "value": value,
                        "threshold": limits["max"],
                    }
                )

    return anomalies
