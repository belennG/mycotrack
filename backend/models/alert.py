import uuid
from typing import Optional
from models.batch import Batch
from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from models.base import BaseModel


class Alert(BaseModel):
    """SQLAlchemy model for storing system alerts and warnings."""

    __tablename__ = "alerts"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("batches.id", ondelete="CASCADE"),
        index=True,
    )

    alert_type: Mapped[str] = mapped_column(String, index=True)
    severity: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)

    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    batch: Mapped["Batch"] = relationship("Batch")
