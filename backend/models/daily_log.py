from sqlalchemy import Column, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from models.base import BaseModel

class DailyLog(BaseModel):
    """
    SQLAlchemy model representing a daily environmental and observation log 
    for a specific crop batch.
    """
    __tablename__ = "daily_logs"

    # Links this log to exactly one Batch. 
    # ondelete="CASCADE" means if the batch is deleted, all its logs are deleted too.
    batch_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("batches.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    
    # Environmental metrics
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    co2_ppm = Column(Integer, nullable=True)
    
    # Text notes for the day
    observations = Column(Text, nullable=True)
    
    # When this reading was actually taken (defaults to right now)
    log_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)