from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
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


class AnalyticsResponse(BaseModel):
    """Schema for returning processed analytics data."""

    batch_id: UUID
    completeness_score: float
    statistics: Dict[str, Dict[str, Any]]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "batch_id": "550e8400-e29b-41d4-a716-446655440000",
                "completeness_score": 95.5,
                "statistics": {
                    "temperature": {
                        "min": 20.5,
                        "max": 24.0,
                        "avg": 22.1,
                        "trend": "increasing",
                    },
                    "humidity": {
                        "min": 80.0,
                        "max": 88.0,
                        "avg": 84.5,
                        "trend": "stable",
                    },
                },
            }
        }
    )


class BatchSummaryResponse(BaseModel):
    """Schema for a high-level batch health summary."""

    batch_id: UUID
    health_status: str
    alerts_count: int
    key_metrics: Dict[str, float]
    recent_alerts: List[Dict[str, Any]]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "batch_id": "550e8400-e29b-41d4-a716-446655440000",
                "health_status": "Warning",
                "alerts_count": 1,
                "key_metrics": {
                    "temperature": 22.1,
                    "humidity": 84.5,
                    "ph_level": 6.5,
                    "moisture": 85.0,
                },
                "recent_alerts": [
                    {
                        "alert_type": "humidity_deviation",
                        "severity": "critical",
                        "message": "Humidity is too low (72.0). Safe range is 85.0 to 95.0.",
                    }
                ],
            }
        }
    )
