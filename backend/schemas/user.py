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
