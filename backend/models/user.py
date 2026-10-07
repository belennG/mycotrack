from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class User(BaseModel):
    """A person authenticated through Auth0.

    Rows are created just-in-time on the first authenticated request for a given
    Auth0 ``sub`` (see ``auth.dependencies.get_current_user``). Profile fields
    are refreshed from the token on subsequent logins.

    Account linking is out of scope: the same human logging in through two
    different Auth0 connections (e.g. Google and username/password) produces two
    ``sub`` values and therefore two rows, so ``email`` is indexed but not unique.
    """

    __tablename__ = "users"

    auth0_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    email: Mapped[Optional[str]] = mapped_column(String(320), index=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    picture: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
