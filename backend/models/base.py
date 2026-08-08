import uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from database import Base


class BaseModel(Base):
    """
    Abstract base class for all database models.
    Automatically assigns a unique UUID primary key to every table.
    """

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
