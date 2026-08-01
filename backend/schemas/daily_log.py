from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

class DailyLogBase(BaseModel):
    """Base schema with common fields and strict validation ranges."""
    temperature: Optional[float] = Field(None, description="Temperature reading")
    humidity: Optional[float] = Field(None, ge=0.0, le=100.0, description="Humidity percentage (0-100)")
    ph_level: Optional[float] = Field(None, ge=0.0, le=14.0, description="pH level (0-14)")
    moisture: Optional[float] = Field(None, ge=0.0, le=100.0, description="Moisture level percentage (0-100)")
    notes: Optional[str] = Field(None, description="Observation notes")

class DailyLogCreate(DailyLogBase):
    """Schema for POST requests."""
    batch_id: UUID = Field(..., description="ID of the associated crop batch")
    log_date: date = Field(default_factory=date.today, description="The date of the log entry")

class DailyLogUpdate(DailyLogBase):
    """Schema for PUT/PATCH requests (all fields optional)."""
    log_date: Optional[date] = None

class DailyLogResponse(DailyLogBase):
    """Schema for API responses."""
    id: UUID
    batch_id: UUID
    log_date: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DailyLogListResponse(BaseModel):
    """Schema for paginated list responses."""
    total: int
    items: List[DailyLogResponse]
"""
=============================================================================
MODEL USAGE EXAMPLE:
=============================================================================
from datetime import date
from models.daily_log import DailyLog

# Creating a new DailyLog instance in code:
new_log = DailyLog(
    batch_id="550e8400-e29b-41d4-a716-446655440000", # Must be a valid UUID from an existing Batch
    log_date=date(2026, 8, 1),
    temperature=24.5,
    humidity=85.0,
    ph_level=6.5,
    moisture=90.0,
    notes="Mycelium knotting observed. Increased humidity to trigger pinning."
)
=============================================================================
"""