"""Shared test fixtures.

The auth layer is exercised directly in ``test_auth.py``. For endpoint tests we
override ``get_current_user`` so a test does not need a live Auth0 tenant.
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user
from main import app
from models.user import User


@pytest.fixture
def fake_user() -> User:
    user = User(
        auth0_sub="auth0|testuser",
        email="tester@example.com",
        name="Test User",
        picture=None,
        last_login_at=datetime.now(timezone.utc),
    )
    user.id = uuid.uuid4()
    user.created_at = datetime.now(timezone.utc)
    return user


@pytest.fixture
def client(fake_user: User):
    """TestClient with authentication stubbed to ``fake_user``."""
    app.dependency_overrides[get_current_user] = lambda: fake_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def anon_client():
    """TestClient with no auth override — requests are genuinely unauthenticated."""
    with TestClient(app) as test_client:
        yield test_client
