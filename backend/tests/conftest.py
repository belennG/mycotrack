"""Shared test fixtures.

Tenant isolation can only be verified against real rows, so tests run on an in-memory
SQLite database (created from the models) instead of a fake user. Authentication is
stubbed: a request acts as whichever user its ``X-Test-User`` header (an email) names.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from main import app
from models.alert import Alert
from models.batch import Batch, BatchStatus
from models.organization import Membership, MemberRole, Organization
from models.tracking import Tracking
from models.user import User


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)()
    yield session
    session.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


class Factory:
    """Builds rows directly in the test database."""

    def __init__(self, session: Session):
        self.db = session
        self._joined = 0

    def user(self, email: str, name: str = "Test User") -> User:
        user = User(auth0_sub=f"auth0|{uuid.uuid4().hex}", email=email, name=name)
        self.db.add(user)
        self.db.commit()
        return user

    def org(self, name: str = "Farm") -> Organization:
        org = Organization(name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:4]}")
        self.db.add(org)
        self.db.commit()
        return org

    def join(self, user: User, org: Organization, role: MemberRole) -> Membership:
        # Distinct, increasing timestamps so "oldest membership" is deterministic.
        self._joined += 1
        membership = Membership(
            user_id=user.id,
            organization_id=org.id,
            role=role,
            created_at=datetime.now(timezone.utc) + timedelta(seconds=self._joined),
        )
        self.db.add(membership)
        self.db.commit()
        return membership

    def member(self, email: str, role: MemberRole = MemberRole.OWNER, org=None):
        """A user with a membership in *org* (a new one if omitted). Returns (user, org)."""
        user = self.user(email)
        org = org or self.org(email.split("@")[0])
        self.join(user, org, role)
        return user, org

    def batch(self, org: Organization, name: str = "Batch 1") -> Batch:
        batch = Batch(
            organization_id=org.id,
            batch_name=name,
            crop_type="Oyster",
            status=BatchStatus.ACTIVE,
            expected_harvest_date=datetime(2026, 12, 1),
            location="Room A",
        )
        self.db.add(batch)
        self.db.commit()
        return batch

    def tracking(self, batch: Batch, temperature: float = 22.0) -> Tracking:
        tracking = Tracking(batch_id=batch.id, temperature=temperature, humidity=90.0)
        self.db.add(tracking)
        self.db.commit()
        return tracking

    def alert(self, batch: Batch) -> Alert:
        alert = Alert(
            batch_id=batch.id,
            alert_type="humidity_deviation",
            severity="warning",
            message="m",
        )
        self.db.add(alert)
        self.db.commit()
        return alert


@pytest.fixture
def make(db) -> Factory:
    return Factory(db)


def as_user(user: User) -> dict:
    """Headers that make a request act as *user*."""
    return {"X-Test-User": user.email}


@pytest.fixture
def client(db):
    """TestClient on the in-memory database with authentication stubbed by header."""

    def fake_current_user(request: Request) -> User:
        email = request.headers.get("x-test-user")
        user = db.query(User).filter(User.email == email).first() if email else None
        if user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = fake_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    """TestClient with no auth override — requests are genuinely unauthenticated."""
    with TestClient(app) as test_client:
        yield test_client
