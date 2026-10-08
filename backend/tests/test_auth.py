"""Tests for Auth0 access-token validation and JIT user provisioning."""

import time

import pytest
from joserfc import jwt
from joserfc.jwk import RSAKey

import auth.jwks as jwks_module
from auth.config import settings
from auth.dependencies import _provision_user
from auth.verify import TokenError, verify_token
from models.organization import Membership, MemberRole, Organization
from models.user import User

ISSUER = "https://mycotrack-test.eu.auth0.com/"
AUDIENCE = "https://api.mycotrack.app"
NAMESPACE = "https://mycotrack.app/"


@pytest.fixture(autouse=True)
def _configure_auth(monkeypatch):
    monkeypatch.setattr(settings, "domain", "mycotrack-test.eu.auth0.com")
    monkeypatch.setattr(settings, "api_audience", AUDIENCE)
    monkeypatch.setattr(settings, "issuer", ISSUER)
    monkeypatch.setattr(settings, "claim_namespace", NAMESPACE)
    jwks_module.reset_cache()
    yield
    jwks_module.reset_cache()


@pytest.fixture
def signing_key() -> RSAKey:
    return RSAKey.generate_key(2048, parameters={"kid": "test-key-1"}, private=True)


@pytest.fixture(autouse=True)
def _stub_jwks(monkeypatch, signing_key: RSAKey):
    public_jwks = {"keys": [signing_key.as_dict(private=False)]}
    monkeypatch.setattr(jwks_module, "_fetch", lambda: public_jwks)


def _make_token(key: RSAKey, **claim_overrides) -> str:
    claims = {
        "sub": "auth0|abc123",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        f"{NAMESPACE}email": "grower@example.com",
        f"{NAMESPACE}name": "Belen G",
    }
    claims.update(claim_overrides)
    header = {"alg": "RS256", "kid": key.kid}
    return jwt.encode(header, claims, key)


def test_valid_token_returns_claims(signing_key):
    claims = verify_token(_make_token(signing_key))
    assert claims["sub"] == "auth0|abc123"
    assert claims[f"{NAMESPACE}email"] == "grower@example.com"


def test_audience_may_be_a_list(signing_key):
    token = _make_token(signing_key, aud=[AUDIENCE, f"{ISSUER}userinfo"])
    assert verify_token(token)["sub"] == "auth0|abc123"


def test_expired_token_rejected(signing_key):
    token = _make_token(signing_key, exp=int(time.time()) - 300)
    with pytest.raises(TokenError):
        verify_token(token)


def test_wrong_audience_rejected(signing_key):
    with pytest.raises(TokenError):
        verify_token(_make_token(signing_key, aud="https://evil.example.com"))


def test_wrong_issuer_rejected(signing_key):
    with pytest.raises(TokenError):
        verify_token(_make_token(signing_key, iss="https://evil.example.com/"))


def test_signature_from_unknown_key_rejected(signing_key):
    other_key = RSAKey.generate_key(2048, parameters={"kid": "attacker"}, private=True)
    with pytest.raises(TokenError):
        verify_token(_make_token(other_key))


def test_missing_sub_rejected(signing_key):
    token = _make_token(signing_key, sub=None)
    with pytest.raises(TokenError):
        verify_token(token)


def test_unconfigured_server_rejects(monkeypatch, signing_key):
    monkeypatch.setattr(settings, "api_audience", "")
    with pytest.raises(TokenError):
        verify_token(_make_token(signing_key))


# --- endpoint gating -------------------------------------------------------


def test_me_requires_authentication(anon_client):
    assert anon_client.get("/api/v1/me").status_code == 401


def test_batches_requires_authentication(anon_client):
    assert anon_client.get("/api/v1/batches").status_code == 401


def test_garbage_token_rejected(anon_client):
    resp = anon_client.get("/api/v1/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401


# --- JIT provisioning ----------------------------------------------------------


def _claims(**over):
    base = {
        "sub": "auth0|new-user",
        f"{NAMESPACE}email": "new@example.com",
        f"{NAMESPACE}name": "New Grower",
        f"{NAMESPACE}picture": "https://img.example/a.png",
    }
    base.update(over)
    return base


def test_provision_creates_user_with_personal_org_on_first_login(db):
    user = _provision_user(db, _claims())

    assert user.auth0_sub == "auth0|new-user"
    assert user.email == "new@example.com"
    assert user.last_login_at is not None

    memberships = db.query(Membership).filter(Membership.user_id == user.id).all()
    assert len(memberships) == 1
    assert memberships[0].role == MemberRole.OWNER
    assert memberships[0].organization.name == "New Grower's Farm"


def test_provision_refreshes_existing_user_without_new_org(db):
    first = _provision_user(db, _claims())
    before = first.last_login_at

    again = _provision_user(db, _claims(**{f"{NAMESPACE}name": "Renamed"}))

    assert again.id == first.id
    assert again.name == "Renamed"
    assert again.last_login_at >= before
    assert db.query(User).count() == 1
    assert db.query(Organization).count() == 1
