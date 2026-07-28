import uuid
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import UUID
from database import Base

class BaseModel(Base):
    """
    Abstract base class for all database models.
    Automatically assigns a unique UUID primary key to every table.
    """
    __abstract__ = True

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )