from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from models.batch import Batch
from schemas.batch import BatchCreate, BatchUpdate, BatchResponse, BatchListResponse
from database import get_db

router = APIRouter(prefix="/api/batches", tags=["Batches"])


@router.get("", response_model=BatchListResponse)
def get_batches(page: int = 1, limit: int = 10, db: Session = Depends(get_db)):
    """Retrieve a paginated list of batches."""
    skip = (page - 1) * limit

    total = db.query(Batch).count()
    items = (
        db.query(Batch)
        .order_by(Batch.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"total": total, "items": items}


@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: UUID, db: Session = Depends(get_db)):
    """Get a single batch by ID."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(batch_in: BatchCreate, db: Session = Depends(get_db)):
    """Create a new batch."""
    existing_batch = (
        db.query(Batch).filter(Batch.batch_name == batch_in.batch_name).first()
    )
    if existing_batch:
        raise HTTPException(status_code=400, detail="Batch name already exists")

    db_batch = Batch(**batch_in.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@router.put("/{batch_id}", response_model=BatchResponse)
def update_batch(batch_id: UUID, batch_in: BatchUpdate, db: Session = Depends(get_db)):
    """Update an existing batch."""
    db_batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    update_data = batch_in.model_dump(exclude_unset=True)

    if "batch_name" in update_data and update_data["batch_name"] != db_batch.batch_name:
        existing_batch = (
            db.query(Batch)
            .filter(Batch.batch_name == update_data["batch_name"])
            .first()
        )
        if existing_batch:
            raise HTTPException(status_code=400, detail="Batch name already exists")

    for field, value in update_data.items():
        setattr(db_batch, field, value)
    db.commit()
    db.refresh(db_batch)

    return db_batch
