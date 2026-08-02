from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
from uuid import UUID

from database import get_db
from models.alert import Alert
from schemas.alert import AlertResponse, AlertListResponse

router = APIRouter(
    prefix="/api/v1/alerts",
    tags=["Alerts"]
)

@router.get("/", response_model=AlertListResponse)
def list_alerts(
    batch_id: Optional[UUID] = None,
    alert_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """List active alerts with optional filtering and pagination."""
    query = db.query(Alert)
    
    if batch_id:
        query = query.filter(Alert.batch_id == batch_id)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
        
    total = query.count()
    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    
    return {"total": total, "items": alerts}

@router.get("/batch/{batch_id}", response_model=List[AlertResponse])
def get_batch_alerts(batch_id: UUID, db: Session = Depends(get_db)):
    """Get all alerts for a specific batch."""
    alerts = db.query(Alert).filter(Alert.batch_id == batch_id).order_by(Alert.created_at.desc()).all()
    return alerts

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: UUID, db: Session = Depends(get_db)):
    """Mark an alert as acknowledged by the user."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    if not alert.is_acknowledged:
        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(alert)
        
    return alert

@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(alert_id: UUID, db: Session = Depends(get_db)):
    """Delete (resolve) an alert from the system."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    db.delete(alert)
    db.commit()
    return None