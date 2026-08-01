from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from models.base import BaseModel

class Alert(BaseModel):
    """SQLAlchemy model for storing system alerts and warnings."""
    __tablename__ = "alerts"

    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False) # e.g., 'warning', 'critical'
    message = Column(Text, nullable=False)
    
    # State tracking for the farmer's dashboard
    is_acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    batch = relationship("Batch")