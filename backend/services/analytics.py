from typing import List, Dict, Any, Optional
from models.daily_log import DailyLog

def calculate_averages(logs: List[DailyLog]) -> Dict[str, float]:
    """
    Calculates the average of temperature, humidity and ph level and substrate humidity (moisture)
    """
    if not logs:
        return {"temperature": 0.0, "humidity": 0.0, "ph_level": 0.0, "moisture": 0.0}

    metrics = {"temperature": [], "humidity": [], "ph_level": [], "moisture": []}
    
    for log in logs:
        if log.temperature is not None: metrics["temperature"].append(log.temperature)
        if log.humidity is not None: metrics["humidity"].append(log.humidity)
        if log.ph_level is not None: metrics["ph_level"].append(log.ph_level)
        if log.moisture is not None: metrics["moisture"].append(log.moisture)

    averages = {}
    for key, values in metrics.items():
        averages[key] = round(sum(values) / len(values), 2) if values else 0.0
        
    return averages

def analyze_trends(logs: List[DailyLog]) -> Dict[str, str]:
    """
    Compare the averages for the first half of the period with those for the second half
    to determine whether the trend is increasing, decreasing or stable.
    """
    if len(logs) < 2:
        return {"temperature": "stable", "humidity": "stable", "ph_level": "stable", "moisture": "stable"}

    # Sort the logs by date in ascending order
    sorted_logs = sorted(logs, key=lambda x: x.log_date)
    midpoint = len(sorted_logs) // 2
    
    first_half = sorted_logs[:midpoint]
    second_half = sorted_logs[midpoint:]

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

def calculate_completeness(logs: List[DailyLog]) -> float:
    """
    Calculate the percentage of data entered.
    Check how many of the expected fields were actually filled in.
    """
    if not logs:
        return 0.0

    expected_fields_per_log = 4  # temp, humidity, ph_level, moisture
    total_expected = len(logs) * expected_fields_per_log
    actual_filled = 0

    for log in logs:
        actual_filled += sum(1 for field in [log.temperature, log.humidity, log.ph_level, log.moisture] if field is not None)

    return round((actual_filled / total_expected) * 100, 2)

def detect_anomalies(logs: List[DailyLog], thresholds: Dict[str, Dict[str, float]]) -> List[Dict[str, Any]]:
    """
    Detects whether any recent values fall outside the safe ranges (thresholds).
    Example of thresholds: {'temperature': {'min': 20.0, 'max': 25.0}}
    """
    anomalies = []
    if not logs:
        return anomalies
        
    # We only check the most recent log to detect current anomalies
    latest_log = sorted(logs, key=lambda x: x.log_date, reverse=True)[0]

    for metric, limits in thresholds.items():
        value = getattr(latest_log, metric, None)
        if value is not None:
            if value < limits.get('min', -float('inf')):
                anomalies.append({
                    "metric": metric,
                    "issue": "too_low",
                    "value": value,
                    "threshold": limits['min']
                })
            elif value > limits.get('max', float('inf')):
                anomalies.append({
                    "metric": metric,
                    "issue": "too_high",
                    "value": value,
                    "threshold": limits['max']
                })
                
    return anomalies