from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class DailyLogBase(BaseModel):
    """Base schema with shared fields for daily logs."""
    temperature: Optional[float] = Field(None, description="Temperature reading")
    humidity: Optional[float] = Field(None, description="Humidity percentage")
    co2_ppm: Optional[int] = Field(None, description="CO2 concentration in parts per million")
    observations: Optional[str] = Field(None, description="Visual observations or notes")
    log_date: Optional[datetime] = Field(None, description="Date and time of the log")

class DailyLogCreate(DailyLogBase):
    """Schema for POST requests. Requires a batch_id."""
    batch_id: UUID = Field(..., description="ID of the crop batch this log belongs to")

class DailyLogUpdate(BaseModel):
    """Schema for PUT/PATCH requests (all fields optional)."""
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    co2_ppm: Optional[int] = None
    observations: Optional[str] = None
    log_date: Optional[datetime] = None

class DailyLogResponse(DailyLogBase):
    """Schema for returning a log in API responses."""
    id: UUID
    batch_id: UUID
    log_date: datetime

    model_config = ConfigDict(from_attributes=True)

class DailyLogListResponse(BaseModel):
    """Schema for returning a paginated list of logs."""
    total: int
    items: List[DailyLogResponse]