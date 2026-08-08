from typing import Optional
import uuid
from models.batch import Batch
from sqlalchemy.orm._orm_constructors import mapped_column
from sqlalchemy.orm.base import Mapped
from sqlalchemy import Float, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from models.base import BaseModel


class Tracking(BaseModel):
    """
    SQLAlchemy model representing an environmental tracking for a batch.
    Includes constraints for valid measurement ranges.
    """

    __tablename__ = "trackings"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("batches.id", ondelete="CASCADE"),
        index=True,
    )

    tracking_date: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    humidity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ph_level: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    moisture: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    batch: Mapped["Batch"] = relationship("Batch", back_populates="trackings")

    # Database-level constraints to prevent invalid data from ever being saved
    __table_args__ = (
        CheckConstraint(
            "humidity >= 0 AND humidity <= 100", name="check_humidity_range"
        ),
        CheckConstraint("ph_level >= 0 AND ph_level <= 14", name="check_ph_range"),
        CheckConstraint(
            "moisture >= 0 AND moisture <= 100", name="check_moisture_range"
        ),
    )
