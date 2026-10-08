"""Multi-tenancy: data isolation between organizations and role enforcement."""

import uuid

import pytest

from models.organization import MemberRole
from tests.conftest import as_user

BATCH_PAYLOAD = {
    "batch_name": "New batch",
    "crop_type": "Shiitake",
    "expected_harvest_date": "2026-12-01T00:00:00",
    "location": "Room B",
}


@pytest.fixture
def two_tenants(make):
    """Alice and Bob each own an organization with a batch, a tracking and an alert."""
    alice, alice_org = make.member("alice@example.com")
    bob, bob_org = make.member("bob@example.com")
    data = {}
    for key, org in (("alice", alice_org), ("bob", bob_org)):
        batch = make.batch(org, name=f"{key} batch")
        data[key] = {
            "org": org,
            "batch": batch,
            "tracking": make.tracking(batch),
            "alert": make.alert(batch),
        }
    return alice, bob, data


# --- isolation ------------------------------------------------------------------


def test_batch_list_and_dashboard_only_show_own_organization(client, two_tenants):
    alice, _, data = two_tenants

    listing = client.get("/api/v1/batches", headers=as_user(alice)).json()
    assert [b["id"] for b in listing["items"]] == [str(data["alice"]["batch"].id)]
    assert listing["total"] == 1

    dashboard = client.get("/api/v1/batches/dashboard", headers=as_user(alice)).json()
    ids = [b["id"] for status in dashboard.values() for b in status]
    assert ids == [str(data["alice"]["batch"].id)]


def test_other_organizations_batch_is_404_not_403(client, two_tenants):
    alice, _, data = two_tenants
    bob_batch = data["bob"]["batch"].id

    assert (
        client.get(f"/api/v1/batches/{bob_batch}", headers=as_user(alice)).status_code
        == 404
    )
    assert (
        client.put(
            f"/api/v1/batches/{bob_batch}", json={"notes": "x"}, headers=as_user(alice)
        ).status_code
        == 404
    )


def test_tracking_isolation(client, two_tenants):
    alice, _, data = two_tenants
    bob_batch = data["bob"]["batch"]
    bob_tracking = data["bob"]["tracking"]

    listing = client.get("/api/v1/trackings/", headers=as_user(alice)).json()
    assert [t["id"] for t in listing["items"]] == [str(data["alice"]["tracking"].id)]

    # Filtering by another organization's batch id reveals nothing.
    other = client.get(
        f"/api/v1/trackings/?batch_id={bob_batch.id}", headers=as_user(alice)
    ).json()
    assert other == {"total": 0, "items": []}

    url = f"/api/v1/trackings/{bob_tracking.id}"
    assert client.get(url, headers=as_user(alice)).status_code == 404
    assert (
        client.put(url, json={"notes": "x"}, headers=as_user(alice)).status_code == 404
    )
    assert client.delete(url, headers=as_user(alice)).status_code == 404

    created = client.post(
        "/api/v1/trackings/",
        json={"batch_id": str(bob_batch.id)},
        headers=as_user(alice),
    )
    assert created.status_code == 404


def test_alert_isolation(client, two_tenants):
    alice, _, data = two_tenants
    bob_alert = data["bob"]["alert"]

    listing = client.get("/api/v1/alerts/", headers=as_user(alice)).json()
    assert [a["id"] for a in listing["items"]] == [str(data["alice"]["alert"].id)]

    assert (
        client.get(
            f"/api/v1/alerts/batch/{data['bob']['batch'].id}", headers=as_user(alice)
        ).json()
        == []
    )
    assert (
        client.post(
            f"/api/v1/alerts/{bob_alert.id}/acknowledge", headers=as_user(alice)
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/alerts/{bob_alert.id}", headers=as_user(alice)
        ).status_code
        == 404
    )


def test_analytics_isolation(client, two_tenants):
    alice, _, data = two_tenants
    bob_batch = data["bob"]["batch"].id

    for suffix in ("", "/summary"):
        resp = client.get(
            f"/api/v1/analytics/batch/{bob_batch}{suffix}", headers=as_user(alice)
        )
        assert resp.status_code == 404

    own = data["alice"]["batch"].id
    assert (
        client.get(
            f"/api/v1/analytics/batch/{own}/summary", headers=as_user(alice)
        ).status_code
        == 200
    )


def test_created_batch_belongs_to_callers_organization(client, make):
    alice, org = make.member("alice@example.com")

    resp = client.post("/api/v1/batches", json=BATCH_PAYLOAD, headers=as_user(alice))
    assert resp.status_code == 201

    from models.batch import Batch

    batch = make.db.query(Batch).filter(Batch.id == uuid.UUID(resp.json()["id"])).one()
    assert batch.organization_id == org.id


# --- batch names are unique per organization ---------------------------------------------


def test_batch_name_may_repeat_across_organizations_but_not_within_one(client, make):
    alice, _ = make.member("alice@example.com")
    bob, _ = make.member("bob@example.com")

    assert (
        client.post(
            "/api/v1/batches", json=BATCH_PAYLOAD, headers=as_user(alice)
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/batches", json=BATCH_PAYLOAD, headers=as_user(bob)
        ).status_code
        == 201
    )

    duplicate = client.post(
        "/api/v1/batches", json=BATCH_PAYLOAD, headers=as_user(alice)
    )
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "Batch name already exists"


def test_renaming_to_an_existing_name_in_the_same_organization_is_rejected(
    client, make
):
    alice, org = make.member("alice@example.com")
    make.batch(org, name="taken")
    other = make.batch(org, name="other")

    resp = client.put(
        f"/api/v1/batches/{other.id}",
        json={"batch_name": "taken"},
        headers=as_user(alice),
    )
    assert resp.status_code == 400


# --- roles -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "role,can_write",
    [
        (MemberRole.VIEWER, False),
        (MemberRole.MEMBER, True),
        (MemberRole.ADMIN, True),
        (MemberRole.OWNER, True),
    ],
)
def test_roles_gate_writes_but_everyone_can_read(client, make, role, can_write):
    _, org = make.member("owner@example.com")
    batch = make.batch(org)
    tracking = make.tracking(batch)
    alert = make.alert(batch)
    user, _ = make.member("user@example.com", role=role, org=org)
    headers = as_user(user)

    assert client.get("/api/v1/batches", headers=headers).status_code == 200
    assert client.get("/api/v1/trackings/", headers=headers).status_code == 200
    assert client.get("/api/v1/alerts/", headers=headers).status_code == 200

    writes = [
        client.post("/api/v1/batches", json=BATCH_PAYLOAD, headers=headers),
        client.put(f"/api/v1/batches/{batch.id}", json={"notes": "n"}, headers=headers),
        client.post(
            "/api/v1/trackings/", json={"batch_id": str(batch.id)}, headers=headers
        ),
        client.put(
            f"/api/v1/trackings/{tracking.id}", json={"notes": "n"}, headers=headers
        ),
        client.post(f"/api/v1/alerts/{alert.id}/acknowledge", headers=headers),
        client.delete(f"/api/v1/trackings/{tracking.id}", headers=headers),
        client.delete(f"/api/v1/alerts/{alert.id}", headers=headers),
    ]
    codes = {r.status_code for r in writes}
    if can_write:
        assert 403 not in codes
    else:
        assert codes == {403}


# --- choosing the active organization --------------------------------------------------


def test_x_org_id_selects_among_a_users_organizations(client, make):
    user, first = make.member("alice@example.com")
    second = make.org("Second")
    make.join(user, second, MemberRole.MEMBER)
    make.batch(first, name="in first")
    make.batch(second, name="in second")

    default = client.get("/api/v1/batches", headers=as_user(user)).json()
    assert [b["batch_name"] for b in default["items"]] == [
        "in first"
    ]  # oldest membership

    chosen = client.get(
        "/api/v1/batches", headers={**as_user(user), "X-Org-Id": str(second.id)}
    ).json()
    assert [b["batch_name"] for b in chosen["items"]] == ["in second"]


def test_x_org_id_for_an_organization_you_are_not_in_is_404(client, make):
    alice, _ = make.member("alice@example.com")
    _, bobs_org = make.member("bob@example.com")

    resp = client.get(
        "/api/v1/batches", headers={**as_user(alice), "X-Org-Id": str(bobs_org.id)}
    )
    assert resp.status_code == 404


def test_account_without_any_membership_gets_a_personal_org_on_first_request(
    client, make
):
    legacy_user = make.user(
        "old@example.com", name="Old Timer"
    )  # predates multi-tenancy

    resp = client.get("/api/v1/batches", headers=as_user(legacy_user))
    assert resp.status_code == 200

    me = client.get("/api/v1/me", headers=as_user(legacy_user)).json()
    assert me["organization"]["name"] == "Old Timer's Farm"
    assert me["organization"]["role"] == "OWNER"


def test_me_reports_active_organization_role_and_all_memberships(client, make):
    user, first = make.member("alice@example.com", role=MemberRole.OWNER)
    second = make.org("Second")
    make.join(user, second, MemberRole.VIEWER)

    me = client.get("/api/v1/me", headers=as_user(user)).json()
    assert me["email"] == "alice@example.com"
    assert me["organization"]["id"] == str(first.id)
    assert me["organization"]["role"] == "OWNER"
    assert {(o["name"], o["role"]) for o in me["organizations"]} == {
        (first.name, "OWNER"),
        ("Second", "VIEWER"),
    }


# --- everything requires authentication --------------------------------------------------

PROTECTED = [
    ("get", "/api/v1/me"),
    ("get", "/api/v1/batches"),
    ("get", "/api/v1/batches/dashboard"),
    ("post", "/api/v1/batches"),
    ("get", f"/api/v1/batches/{uuid.uuid4()}"),
    ("get", "/api/v1/trackings/"),
    ("post", "/api/v1/trackings/"),
    ("get", "/api/v1/alerts/"),
    ("get", f"/api/v1/analytics/batch/{uuid.uuid4()}"),
]


@pytest.mark.parametrize("method,path", PROTECTED)
def test_every_route_rejects_anonymous_requests(anon_client, method, path):
    assert getattr(anon_client, method)(path).status_code == 401
