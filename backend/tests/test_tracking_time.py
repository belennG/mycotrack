"""Several readings per day: the time of day must be stored, shown and respected."""

from datetime import datetime

from tests.conftest import as_user


def _post(client, user, batch, when, **extra):
    payload = {
        "batch_id": str(batch.id),
        "tracking_date": when,
        "temperature": 22.0,
        **extra,
    }
    resp = client.post("/api/v1/trackings/", json=payload, headers=as_user(user))
    assert resp.status_code == 201
    return resp.json()


def test_time_of_day_of_a_reading_is_kept(client, make):
    user, org = make.member("a@example.com")
    batch = make.batch(org)

    created = _post(client, user, batch, "2026-10-08T14:35:00")
    assert created["tracking_date"].startswith("2026-10-08T14:35")

    fetched = client.get(
        f"/api/v1/trackings/{created['id']}", headers=as_user(user)
    ).json()
    assert fetched["tracking_date"].startswith("2026-10-08T14:35")


def test_readings_on_one_day_are_listed_by_reading_time_not_entry_time(client, make):
    user, org = make.member("a@example.com")
    batch = make.batch(org)

    # Entered out of order: the 18:00 reading is saved first, then 08:00 and 12:30.
    _post(client, user, batch, "2026-10-08T18:00:00")
    _post(client, user, batch, "2026-10-08T08:00:00")
    _post(client, user, batch, "2026-10-08T12:30:00")

    items = client.get("/api/v1/trackings/", headers=as_user(user)).json()["items"]
    assert [i["tracking_date"][11:16] for i in items] == ["18:00", "12:30", "08:00"]


def test_dashboard_latest_reading_is_the_most_recent_reading_taken(client, make):
    user, org = make.member("a@example.com")
    batch = make.batch(org)

    _post(client, user, batch, "2026-10-08T18:00:00", temperature=25.0)
    # Entered later but taken earlier (e.g. a back-dated reading) must not become "latest".
    _post(client, user, batch, "2026-10-08T06:00:00", temperature=19.0)

    dashboard = client.get("/api/v1/batches/dashboard", headers=as_user(user)).json()
    latest = dashboard["ACTIVE"][0]["latest_tracking"]
    assert latest["tracking_date"].startswith("2026-10-08T18:00")
    assert latest["temperature"] == 25.0


def test_date_to_includes_every_reading_on_that_day(client, make):
    user, org = make.member("a@example.com")
    batch = make.batch(org)
    _post(client, user, batch, "2026-10-07T23:59:00")
    _post(client, user, batch, "2026-10-08T00:05:00")
    _post(client, user, batch, "2026-10-08T22:10:00")
    _post(client, user, batch, "2026-10-09T00:00:00")

    def times(**params):
        query = "&".join(f"{k}={v}" for k, v in params.items())
        data = client.get(f"/api/v1/trackings/?{query}", headers=as_user(user)).json()
        return sorted(i["tracking_date"][:16] for i in data["items"])

    assert times(date_from="2026-10-08", date_to="2026-10-08") == [
        "2026-10-08T00:05",
        "2026-10-08T22:10",
    ]
    assert times(date_to="2026-10-07") == ["2026-10-07T23:59"]
    assert times(date_from="2026-10-09") == ["2026-10-09T00:00"]


def test_analytics_date_to_also_includes_the_whole_last_day(client, make):
    user, org = make.member("a@example.com")
    batch = make.batch(org)
    _post(client, user, batch, "2026-10-08T01:00:00", temperature=20.0)
    _post(client, user, batch, "2026-10-08T23:00:00", temperature=24.0)

    resp = client.get(
        f"/api/v1/analytics/batch/{batch.id}?date_from=2026-10-08&date_to=2026-10-08",
        headers=as_user(user),
    ).json()
    stats = resp["statistics"]["temperature"]
    assert (stats["min"], stats["max"]) == (20.0, 24.0)


def test_a_reading_without_a_date_defaults_to_now(client, make):
    user, org = make.member("a@example.com")
    batch = make.batch(org)

    resp = client.post(
        "/api/v1/trackings/", json={"batch_id": str(batch.id)}, headers=as_user(user)
    ).json()
    assert (
        abs(
            datetime.fromisoformat(resp["tracking_date"]).timestamp()
            - datetime.now().timestamp()
        )
        < 86400
    )
