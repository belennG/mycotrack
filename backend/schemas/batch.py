from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from models.batch import BatchStatus


class BatchBase(BaseModel):
    """Base schema with shared fields for creation and updates."""

    batch_name: str = Field(  # type: ignore
        ..., min_index=1, max_length=100, description="Unique identifier for the batch"
    )
    crop_type: str = Field(
        ..., min_length=1, max_length=100, description="Species or type of crop"
    )
    status: BatchStatus = Field(
        default=BatchStatus.ACTIVE, description="Current lifecycle status"
    )
    expected_harvest_date: datetime = Field(..., description="Projected harvest date")
    location: str = Field(..., max_length=150, description="Physical location or room")
    notes: Optional[str] = Field(None, description="Optional cultivation notes")


class BatchCreate(BatchBase):
    """Schema for POST requests when creating a new batch."""

    start_date: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Start date of the batch",
    )


class BatchUpdate(BaseModel):
    """Schema for PUT/PATCH requests (all fields optional for partial updates)."""

    batch_name: Optional[str] = Field(None, max_length=100)
    crop_type: Optional[str] = Field(None, max_length=100)
    status: Optional[BatchStatus] = None
    expected_harvest_date: Optional[datetime] = None
    actual_harvest_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=150)
    notes: Optional[str] = None


class BatchResponse(BatchBase):
    """Schema for returning a single batch in API responses."""

    id: str  # Will map from UUID
    start_date: datetime
    actual_harvest_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # This tells Pydantic to read data even if it's coming from a SQLAlchemy object (orm mode)
    model_config = ConfigDict(from_attributes=True)


class BatchListResponse(BaseModel):
    """Schema for returning a paginated list of batches."""

    total: int
    items: List[BatchResponse]
