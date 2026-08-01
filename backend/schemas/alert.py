from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class AlertResponse(BaseModel):
    """Schema for a single alert response."""
    id: UUID
    batch_id: UUID
    alert_type: str
    severity: str
    message: str
    is_acknowledged: bool
    acknowledged_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AlertListResponse(BaseModel):
    """Schema for paginated alerts."""
    total: int
    items: List[AlertResponse]

# The ticket also asked to include the Analytics schemas here
class AnalyticsResponse(BaseModel):
    batch_id: UUID
    completeness_score: float
    statistics: dict

class BatchSummaryResponse(BaseModel):
    batch_id: UUID
    health_status: str
    alerts_count: int
    key_metrics: dict
    recent_alerts: List[dict]