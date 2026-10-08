from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserResponse(BaseModel):
    """The authenticated user's profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: Optional[str] = Field(None, description="Email from the identity provider")
    name: Optional[str] = Field(None, description="Display name")
    picture: Optional[str] = Field(None, description="Avatar URL")
    created_at: datetime
    last_login_at: Optional[datetime] = None


class OrganizationSummary(BaseModel):
    """An organization the user belongs to, with their role in it."""

    id: UUID
    name: str
    slug: str
    role: str


class MeResponse(UserResponse):
    """The profile plus the organization the request acts on."""

    organization: OrganizationSummary
    organizations: list[OrganizationSummary]
