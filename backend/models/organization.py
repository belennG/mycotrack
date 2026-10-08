import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import BaseModel


class MemberRole(str, enum.Enum):
    """What a member may do inside an organization, from most to least privileged."""

    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class Organization(BaseModel):
    """The tenant boundary: batches (and through them trackings and alerts) belong to one."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    memberships: Mapped[list["Membership"]] = relationship(
        "Membership", back_populates="organization", cascade="all, delete-orphan"
    )


class Membership(BaseModel):
    """A user's role within an organization."""

    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
    )
    role: Mapped[MemberRole] = mapped_column(
        SQLEnum(MemberRole, name="memberrole"), default=MemberRole.MEMBER
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    organization: Mapped[Organization] = relationship(
        "Organization", back_populates="memberships"
    )
