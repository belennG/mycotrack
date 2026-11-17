"""The rules against the shared cases that the in-browser demo's TypeScript copy also passes."""

import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from models.tracking import Tracking
from services.alerts import evaluate_alerts

FILE = Path(__file__).parent / "alert_cases.json"
CASES = json.loads(FILE.read_text())["cases"]
START = datetime(2026, 11, 10, 8, 0)


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_shared_case(case):
    readings = [
        Tracking(
            batch_id=None,
            tracking_date=START + timedelta(hours=row["hours"]),
            temperature=row.get("temperature"),
            humidity=row.get("humidity"),
            ph_level=row.get("ph_level"),
            moisture=row.get("moisture"),
        )
        for row in case["readings"]
    ]

    found = sorted(
        alert["alert_type"] for alert in evaluate_alerts(readings, case["crop"])
    )

    assert found == case["expected"]
