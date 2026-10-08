"""FastAPI dependencies that turn a bearer token into a ``User`` row."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth.config import settings
from auth.verify import TokenError, verify_token
from database import get_db
from models.user import User
from services.organizations import create_personal_org

# ``auto_error=False`` so a missing/!bearer header reaches our code and returns a
# consistent 401 (FastAPI's built-in would raise 403). Still detected as a
# security scheme, so Swagger keeps its Authorize button.
bearer_scheme = HTTPBearer(description="Auth0 access token", auto_error=False)
_bearer_optional = bearer_scheme

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired authentication token",
    headers={"WWW-Authenticate": "Bearer"},
)


def _claim(claims: dict, name: str) -> Optional[str]:
    """Read a profile claim, preferring the namespaced custom claim."""
    return claims.get(settings.claim(name)) or claims.get(name)


def _provision_user(db: Session, claims: dict) -> User:
    """Find the ``User`` for these claims, creating/refreshing it as needed."""
    sub = claims.get("sub")
    if not sub:
        raise _UNAUTHENTICATED

    email = _claim(claims, "email")
    name = _claim(claims, "name")
    picture = _claim(claims, "picture")
    now = datetime.now(timezone.utc)

    user = db.query(User).filter(User.auth0_sub == sub).first()

    if user is None:
        user = User(
            auth0_sub=sub,
            email=email,
            name=name,
            picture=picture,
            last_login_at=now,
        )
        db.add(user)
        try:
            db.flush()
            # The user and their personal organization are created in one transaction.
            create_personal_org(db, user)
            db.commit()
        except IntegrityError:
            # Two first requests for the same new user raced; the other one won and its
            # whole transaction (user + organization) is intact. Use that row.
            db.rollback()
            user = db.query(User).filter(User.auth0_sub == sub).first()
            if user is None:
                raise
    else:
        if email and user.email != email:
            user.email = email
        if name and user.name != name:
            user.name = name
        if picture and user.picture != picture:
            user.picture = picture
        user.last_login_at = now
        db.commit()

    db.refresh(user)
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate the bearer token and return the matching ``User`` row.

    The row is created on first sight of an Auth0 ``sub`` and its profile fields
    are refreshed on every call.
    """
    if credentials is None:
        raise _UNAUTHENTICATED
    try:
        claims = verify_token(credentials.credentials)
    except TokenError:
        raise _UNAUTHENTICATED
    return _provision_user(db, claims)


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like :func:`get_current_user` but returns ``None`` when unauthenticated.

    For endpoints that are usable anonymously but behave differently when signed
    in. Present now so #70 has it; unused by the current routers.
    """
    if credentials is None:
        return None
    try:
        claims = verify_token(credentials.credentials)
    except TokenError:
        return None
    return _provision_user(db, claims)
