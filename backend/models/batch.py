import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Enum as SQLEnum
from models.base import BaseModel
from sqlalchemy.orm import relationship


class BatchStatus(str, enum.Enum):
    """Enumeration of possible crop batch statuses."""

    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"


class Batch(BaseModel):
    """
    SQLAlchemy model representing a crop batch (e.g., mushroom cultivation cycle).
    Inherits UUID primary key from BaseModel.
    """

    __tablename__ = "batches"

    batch_name = Column(String(100), unique=True, index=True, nullable=False)
    crop_type = Column(String(100), nullable=False)

    # Status uses the Python Enum mapped to a database string/enum
    status: str = Column(  # type: ignore
        SQLEnum(BatchStatus), default=BatchStatus.ACTIVE, nullable=False
    )

    start_date = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    expected_harvest_date = Column(DateTime, nullable=False)
    actual_harvest_date = Column(DateTime, nullable=True)

    location = Column(String(150), nullable=False)
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

    trackings = relationship(
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
