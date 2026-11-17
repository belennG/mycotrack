"""Alert rules: thresholds by crop, the trend rule, and recording alerts when a reading is saved."""

from datetime import datetime, timedelta, timezone

import pytest

from models.alert import Alert
from models.organization import MemberRole
from models.tracking import Tracking
from services.alerts import (
    TREND_HORIZON_HOURS,
    detect_trend_alerts,
    generate_alerts,
    record_alerts,
)
from services.thresholds import DEFAULT_THRESHOLDS, preset_for, thresholds_for
from tests.conftest import as_user

START = datetime(2026, 11, 10, 8, 0)


def readings(humidity=None, temperature=None, hours_apart=12, batch_id=None):
    """Readings 12 hours apart, oldest first; each metric given as a list of values."""
    length = max(len(values or []) for values in (humidity, temperature))
    out = []
    for i in range(length):
        out.append(
            Tracking(
                batch_id=batch_id,
                tracking_date=START + timedelta(hours=hours_apart * i),
                humidity=humidity[i] if humidity else None,
                temperature=temperature[i] if temperature else None,
            )
        )
    return out


# --- thresholds by crop -------------------------------------------------------------------


@pytest.mark.parametrize(
    "crop, expected",
    [
        ("Oyster Mushroom", "oyster"),
        ("King Oyster", "oyster"),
        ("Shiitake", "shiitake"),
        ("SHIITAKE", "shiitake"),
        ("Lion's Mane", "lion's mane"),
        ("Melena de león", "lion's mane"),
        ("Reishi", "default (oyster)"),
        ("", "default (oyster)"),
        (None, "default (oyster)"),
    ],
)
def test_the_crop_type_chooses_the_preset(crop, expected):
    assert preset_for(crop)[0] == expected


def test_a_reading_is_judged_against_its_own_crops_range():
    reading = Tracking(
        batch_id=None, temperature=15.0, humidity=88, ph_level=6.0, moisture=60
    )

    on_oyster = generate_alerts(reading, thresholds_for("Oyster"))
    on_shiitake = generate_alerts(reading, thresholds_for("Shiitake"))

    assert {a["alert_type"] for a in on_oyster} == {
        "temperature_out_of_range",
        "moisture_level_critical",
    }
    assert on_shiitake == []  # 15 C and 60 % moisture are fine for shiitake


def test_without_a_preset_the_old_defaults_apply():
    assert thresholds_for("Reishi") == DEFAULT_THRESHOLDS


# --- trend rule ---------------------------------------------------------------------------


def types(alerts):
    return [alert["alert_type"] for alert in alerts]


def test_steady_fall_towards_the_lower_limit_warns():
    # 92 -> 86.4 over 36 h (1.4 per 12 h): reaches 85 in about 9 h.
    found = detect_trend_alerts(readings(humidity=[92.0, 90.6, 89.2, 87.8, 86.4][-4:]))

    assert types(found) == ["humidity_trending_low"]
    assert found[0]["severity"] == "warning"
    assert "fallen" in found[0]["message"] and "85" in found[0]["message"]


def test_steady_rise_towards_the_upper_limit_warns():
    found = detect_trend_alerts(readings(humidity=[90.0, 91.4, 92.8, 94.0]))

    assert types(found) == ["humidity_trending_high"]


def test_a_fall_that_would_take_longer_than_the_horizon_does_not_warn():
    # 0.5 per 12 h from 92: 85 is about 14 days away.
    found = detect_trend_alerts(readings(humidity=[93.5, 93.0, 92.5, 92.0]))

    assert found == []


def test_the_horizon_is_the_boundary():
    slow = readings(humidity=[93.0, 92.0, 91.0, 90.0])  # 1 per 12 h: 85 in 60 h
    assert detect_trend_alerts(slow) == []
    assert types(detect_trend_alerts(slow, horizon_hours=72)) == [
        "humidity_trending_low"
    ]
    assert TREND_HORIZON_HOURS == 48.0


def test_a_zigzag_is_not_a_trend():
    assert detect_trend_alerts(readings(humidity=[92.0, 88.0, 90.0, 86.0])) == []


def test_a_flat_series_is_not_a_trend():
    assert detect_trend_alerts(readings(humidity=[90.0, 90.0, 90.0, 90.0])) == []


def test_jitter_smaller_than_five_percent_of_the_range_is_ignored():
    # The range is 10 wide, so a total move of 0.3 is below the 0.5 minimum.
    assert detect_trend_alerts(readings(humidity=[85.5, 85.4, 85.3, 85.2])) == []


def test_fewer_than_four_readings_is_not_enough():
    assert detect_trend_alerts(readings(humidity=[92.0, 90.0, 87.0])) == []


def test_a_metric_already_out_of_range_is_left_to_the_threshold_rule():
    assert detect_trend_alerts(readings(humidity=[88.0, 86.0, 84.0, 82.0])) == []


def test_a_fall_away_from_the_nearest_limit_is_not_a_warning():
    # Falling, but towards 85 from 94 is 6 days away; and rising readings fall nowhere.
    assert detect_trend_alerts(readings(humidity=[94.6, 94.4, 94.2, 94.0])) == []


def test_each_metric_is_judged_on_its_own():
    found = detect_trend_alerts(
        readings(
            humidity=[92.0, 90.6, 89.2, 87.8], temperature=[22.0, 22.0, 22.0, 22.0]
        )
    )

    assert types(found) == ["humidity_trending_low"]


def test_readings_in_any_order_give_the_same_answer():
    series = readings(humidity=[92.0, 90.6, 89.2, 87.8])

    assert types(detect_trend_alerts(list(reversed(series)))) == [
        "humidity_trending_low"
    ]


def test_readings_with_and_without_a_timezone_can_be_mixed():
    # A reading just saved carries a timezone; the ones read back from the database do not.
    series = readings(humidity=[92.0, 90.6, 89.2, 87.8])
    series[-1].tracking_date = series[-1].tracking_date.replace(tzinfo=timezone.utc)

    assert types(detect_trend_alerts(series)) == ["humidity_trending_low"]


def test_readings_missing_a_metric_are_skipped_for_that_metric():
    series = readings(humidity=[92.0, 90.6, 89.2, 87.8, 86.4])
    series[2].humidity = None  # 4 left of 5, still a falling run

    assert types(detect_trend_alerts(series)) == ["humidity_trending_low"]


# --- recording alerts ---------------------------------------------------------------------


def add_readings(db, batch, humidity):
    for i, value in enumerate(humidity):
        db.add(
            Tracking(
                batch_id=batch.id,
                tracking_date=START + timedelta(hours=12 * i),
                temperature=22.0,
                humidity=value,
                ph_level=6.8,
                moisture=80.0,
            )
        )
    db.flush()


def test_recording_saves_the_trend_warning_once(db, make):
    _, org = make.member("grower@example.com")
    batch = make.batch(org)
    add_readings(db, batch, [92.0, 90.6, 89.2, 87.8])

    first = record_alerts(db, batch)
    second = record_alerts(db, batch)
    db.commit()

    assert [a.alert_type for a in first] == ["humidity_trending_low"]
    assert second == []  # still open: not raised again
    assert db.query(Alert).filter(Alert.batch_id == batch.id).count() == 1


def test_after_it_is_acknowledged_the_same_kind_can_be_raised_again(db, make):
    _, org = make.member("grower@example.com")
    batch = make.batch(org)
    add_readings(db, batch, [92.0, 90.6, 89.2, 87.8])
    record_alerts(db, batch)
    db.query(Alert).update({"is_acknowledged": True})
    db.flush()

    again = record_alerts(db, batch)

    assert [a.alert_type for a in again] == ["humidity_trending_low"]


def test_an_out_of_range_reading_raises_a_critical_alert(db, make):
    _, org = make.member("grower@example.com")
    batch = make.batch(org)
    add_readings(db, batch, [90.0, 88.0, 86.0, 82.0])

    created = record_alerts(db, batch)

    assert [(a.alert_type, a.severity) for a in created] == [
        ("humidity_deviation", "critical")
    ]


def test_a_healthy_batch_raises_nothing(db, make):
    _, org = make.member("grower@example.com")
    batch = make.batch(org)
    add_readings(db, batch, [90.0, 90.5, 90.0, 90.5])

    assert record_alerts(db, batch) == []


def test_a_partial_reading_does_not_save_missing_data_alerts(db, make):
    _, org = make.member("grower@example.com")
    batch = make.batch(org)
    db.add(Tracking(batch_id=batch.id, temperature=22.0))
    db.flush()

    assert record_alerts(db, batch) == []


def test_a_batch_without_readings_raises_nothing(db, make):
    _, org = make.member("grower@example.com")

    assert record_alerts(db, make.batch(org)) == []


def test_the_crop_decides_what_counts_as_out_of_range(db, make):
    _, org = make.member("grower@example.com")
    shiitake = make.batch(org, "Shiitake room")
    shiitake.crop_type = "Shiitake"
    add_readings(db, shiitake, [85.0])  # fine for shiitake? 85 is inside 80-90
    db.query(Tracking).filter(Tracking.batch_id == shiitake.id).update(
        {"temperature": 15.0, "ph_level": 6.0, "moisture": 60.0}
    )
    db.flush()

    assert record_alerts(db, shiitake) == []


# --- saving a reading through the API -----------------------------------------------------


def post_reading(client, user, batch, hours, humidity):
    return client.post(
        "/api/v1/trackings/",
        headers=as_user(user),
        json={
            "batch_id": str(batch.id),
            "tracking_date": (START + timedelta(hours=hours)).isoformat(),
            "temperature": 22.0,
            "humidity": humidity,
            "ph_level": 6.8,
            "moisture": 80.0,
        },
    )


def test_saving_the_fourth_falling_reading_raises_the_alert(client, make):
    user, org = make.member("grower@example.com")
    batch = make.batch(org)

    for hours, humidity in [(0, 92.0), (12, 90.6), (24, 89.2)]:
        assert post_reading(client, user, batch, hours, humidity).status_code == 201
    assert client.get("/api/v1/alerts/", headers=as_user(user)).json()["total"] == 0

    assert post_reading(client, user, batch, 36, 87.8).status_code == 201

    body = client.get("/api/v1/alerts/", headers=as_user(user)).json()
    assert [a["alert_type"] for a in body["items"]] == ["humidity_trending_low"]
    assert body["items"][0]["batch_id"] == str(batch.id)


def test_another_organization_never_sees_the_alert(client, make):
    user, org = make.member("grower@example.com")
    outsider, _ = make.member("rival@example.com")
    batch = make.batch(org)
    for hours, humidity in [(0, 92.0), (12, 90.6), (24, 89.2), (36, 87.8)]:
        post_reading(client, user, batch, hours, humidity)

    seen_by_rival = client.get("/api/v1/alerts/", headers=as_user(outsider)).json()

    assert seen_by_rival["total"] == 0
    assert (
        client.get(f"/api/v1/alerts/batch/{batch.id}", headers=as_user(outsider)).json()
        == []
    )


def test_a_viewer_cannot_create_readings_so_cannot_raise_alerts(client, make):
    owner, org = make.member("grower@example.com")
    viewer, _ = make.member("viewer@example.com", MemberRole.VIEWER, org)
    batch = make.batch(org)

    assert post_reading(client, viewer, batch, 0, 90.0).status_code == 403
    assert db_count(make) == 0


def db_count(make):
    return make.db.query(Alert).count()
