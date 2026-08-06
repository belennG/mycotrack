from sqlalchemy.orm._orm_constructors import mapped_column

from sqlalchemy.orm.base import Mapped

from sqlalchemy import Column, Date, Float, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import date, datetime, timezone
from models.base import BaseModel


class Tracking(BaseModel):
    """
    SQLAlchemy model representing an environmental tracking for a batch.
    Includes constraints for valid measurement ranges.
    """

    __tablename__ = "trackings"

    batch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tracking_date: Mapped[date] = mapped_column(
        Date,
        default=lambda: datetime.now(timezone.utc).date(),
        nullable=False,
        index=True,
    )

    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    ph_level = Column(Float, nullable=True)
    moisture = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Sets up a two-way relationship with the Batch model
    batch = relationship("Batch", back_populates="trackings")

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
