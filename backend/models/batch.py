import enum
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import BaseModel

if TYPE_CHECKING:
    from models.tracking import Tracking


class BatchStatus(str, enum.Enum):
    """Enumeration of possible crop batch statuses."""

    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"


class Batch(BaseModel):
    __tablename__ = "batches"

    batch_name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    crop_type: Mapped[str] = mapped_column(String(100))

    status: Mapped[BatchStatus] = mapped_column(
        SQLEnum(BatchStatus), default=BatchStatus.ACTIVE
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    expected_harvest_date: Mapped[datetime] = mapped_column(DateTime)

    # Use Optional for nullable fields
    actual_harvest_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    location: Mapped[str] = mapped_column(String(150))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # string "Tracking" to prevent circular import issues
    trackings: Mapped[List["Tracking"]] = relationship(
        "Tracking",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="desc(Tracking.created_at)",
    )


"""
=============================================================================
MODEL USAGE EXAMPLE:
=============================================================================
from datetime import datetime, timezone
from models.batch import Batch, BatchStatus

# Creating a new Batch instance in code:
new_batch = Batch(
    batch_name="Oyster-Block-01",
    crop_type="Oyster Mushroom",
    status=BatchStatus.ACTIVE,
    expected_harvest_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
    location="Greenhouse Room A",
    notes="Inoculated on rye grain substrate."
)
=============================================================================
"""
