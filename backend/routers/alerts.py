from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from uuid import UUID

from auth.tenancy import OrgContext, read_access, write_access
from database import get_db
from models.alert import Alert
from models.batch import Batch
from schemas.alert import AlertResponse, AlertListResponse

router = APIRouter(
    prefix="/api/v1/alerts",
    tags=["Alerts"],
    dependencies=[Depends(read_access)],
)


def _org_alerts(db: Session, ctx: OrgContext):
    """Alerts of the active organization (scoped through their batch)."""
    return (
        db.query(Alert)
        .join(Batch, Alert.batch_id == Batch.id)
        .filter(Batch.organization_id == ctx.organization.id)
    )


@router.get("/", response_model=AlertListResponse)
def list_alerts(
    batch_id: Optional[UUID] = None,
    alert_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    ctx: OrgContext = Depends(read_access),
    db: Session = Depends(get_db),
):
    """List active alerts with optional filtering and pagination."""
    query = _org_alerts(db, ctx)

    if batch_id:
        query = query.filter(Alert.batch_id == batch_id)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)

    total = query.count()
    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "items": alerts}


@router.get("/batch/{batch_id}", response_model=List[AlertResponse])
def get_batch_alerts(
    batch_id: UUID,
    ctx: OrgContext = Depends(read_access),
    db: Session = Depends(get_db),
):
    """Get all alerts for a specific batch."""
    alerts = (
        _org_alerts(db, ctx)
        .filter(Alert.batch_id == batch_id)
        .order_by(Alert.created_at.desc())
        .all()
    )
    return alerts


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: UUID,
    ctx: OrgContext = Depends(write_access),
    db: Session = Depends(get_db),
):
    """Mark an alert as acknowledged by the user."""
    alert = _org_alerts(db, ctx).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if not alert.is_acknowledged:
        alert.is_acknowledged = True  # type: ignore
        alert.acknowledged_at = datetime.now(timezone.utc)  # type: ignore
        db.commit()
        db.refresh(alert)

    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: UUID,
    ctx: OrgContext = Depends(write_access),
    db: Session = Depends(get_db),
):
    """Delete (resolve) an alert from the system."""
    alert = _org_alerts(db, ctx).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()
    return None
