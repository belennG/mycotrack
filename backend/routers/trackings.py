from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID
from auth.tenancy import OrgContext, read_access, write_access
from database import get_db
from models.tracking import Tracking
from models.batch import Batch
from schemas.tracking import (
    TrackingCreate,
    TrackingUpdate,
    TrackingResponse,
    TrackingListResponse,
)

router = APIRouter(
    prefix="/api/v1/trackings",
    tags=["Trackings"],
    dependencies=[Depends(read_access)],
)


def _org_trackings(db: Session, ctx: OrgContext):
    """Trackings of the active organization (scoped through their batch)."""
    return (
        db.query(Tracking)
        .join(Batch, Tracking.batch_id == Batch.id)
        .filter(Batch.organization_id == ctx.organization.id)
    )


@router.get("/", response_model=TrackingListResponse, status_code=status.HTTP_200_OK)
def list_trackings(
    skip: int = 0,
    limit: int = 10,
    batch_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    ctx: OrgContext = Depends(read_access),
    db: Session = Depends(get_db),
):
    """List all trackings with pagination and optional batch filtering."""
    query = _org_trackings(db, ctx)

    # Filter by batch_id if the user provided one in the URL
    if batch_id:
        query = query.filter(Tracking.batch_id == batch_id)
    # Filter by date range
    if date_from:
        query = query.filter(Tracking.tracking_date >= date_from)
    if date_to:
        query = query.filter(Tracking.tracking_date <= date_to)

    total = query.count()
    trackings = (
        query.order_by(Tracking.created_at.desc()).offset(skip).limit(limit).all()
    )

    return {"total": total, "items": trackings}


@router.get(
    "/{tracking_id}", response_model=TrackingResponse, status_code=status.HTTP_200_OK
)
def get_trackings(
    tracking_id: UUID,
    ctx: OrgContext = Depends(read_access),
    db: Session = Depends(get_db),
):
    """Retrieve a single tracking by its ID."""
    tracking = _org_trackings(db, ctx).filter(Tracking.id == tracking_id).first()
    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tracking not found"
        )
    return tracking


@router.post("/", response_model=TrackingResponse, status_code=status.HTTP_201_CREATED)
def create_trackings(
    tracking_data: TrackingCreate,
    ctx: OrgContext = Depends(write_access),
    db: Session = Depends(get_db),
):
    """Create a new tracking entry."""
    batch = (
        db.query(Batch)
        .filter(
            Batch.id == tracking_data.batch_id,
            Batch.organization_id == ctx.organization.id,
        )
        .first()
    )
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Associated Batch not found"
        )

    new_tracking = Tracking(**tracking_data.model_dump())
    db.add(new_tracking)

    batch.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    # @TODO change to mapped_column

    db.commit()
    db.refresh(new_tracking)
    return new_tracking


@router.put(
    "/{tracking_id}", response_model=TrackingResponse, status_code=status.HTTP_200_OK
)
def update_trackings(
    tracking_id: UUID,
    tracking_data: TrackingUpdate,
    ctx: OrgContext = Depends(write_access),
    db: Session = Depends(get_db),
):
    """Update a tracking entry."""
    tracking = _org_trackings(db, ctx).filter(Tracking.id == tracking_id).first()
    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tracking not found"
        )

    # Update only the fields that were provided in the request
    update_data = tracking_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tracking, key, value)

    db.commit()
    db.refresh(tracking)
    return tracking


@router.delete("/{tracking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trackings(
    tracking_id: UUID,
    ctx: OrgContext = Depends(write_access),
    db: Session = Depends(get_db),
):
    """Delete a tracking entry."""
    tracking = _org_trackings(db, ctx).filter(Tracking.id == tracking_id).first()
    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="tracking not found"
        )

    db.delete(tracking)
    db.commit()
    return None
