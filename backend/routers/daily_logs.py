from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from uuid import UUID
from database import get_db
from models.daily_log import DailyLog
from models.batch import Batch
from schemas.daily_log import (
    DailyLogCreate, 
    DailyLogUpdate, 
    DailyLogResponse, 
    DailyLogListResponse
)

router = APIRouter(
    prefix="/api/v1/daily-logs",
    tags=["Daily Logs"]
)

@router.get("/", response_model=DailyLogListResponse, status_code=status.HTTP_200_OK)
def list_daily_logs(
    skip: int = 0, 
    limit: int = 10, 
    batch_id: Optional[UUID] = None,
    date_from: Optional[date] = None, 
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """List all daily logs with pagination and optional batch filtering."""
    query = db.query(DailyLog)
    
    # Filter by batch_id if the user provided one in the URL
    if batch_id:
        query = query.filter(DailyLog.batch_id == batch_id)
    # Filter by date range
    if date_from:
        query = query.filter(DailyLog.log_date >= date_from)
    if date_to:
        query = query.filter(DailyLog.log_date <= date_to)
        
    total = query.count()
    logs = query.offset(skip).limit(limit).all()
    
    return {"total": total, "items": logs}

@router.get("/{log_id}", response_model=DailyLogResponse, status_code=status.HTTP_200_OK)
def get_daily_log(log_id: UUID, db: Session = Depends(get_db)):
    """Retrieve a single daily log by its ID."""
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily log not found")
    return log

@router.post("/", response_model=DailyLogResponse, status_code=status.HTTP_201_CREATED)
def create_daily_log(log_data: DailyLogCreate, db: Session = Depends(get_db)):
    """Create a new daily log entry."""
    # 1. Validate that the associated batch actually exists
    batch = db.query(Batch).filter(Batch.id == log_data.batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated Batch not found")
        
    # 2. Create the log
    new_log = DailyLog(**log_data.model_dump())
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.put("/{log_id}", response_model=DailyLogResponse, status_code=status.HTTP_200_OK)
def update_daily_log(log_id: UUID, log_data: DailyLogUpdate, db: Session = Depends(get_db)):
    """Update a daily log entry."""
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily log not found")
        
    # Update only the fields that were provided in the request
    update_data = log_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)
        
    db.commit()
    db.refresh(log)
    return log

@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_daily_log(log_id: UUID, db: Session = Depends(get_db)):
    """Delete a daily log entry."""
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily log not found")
        
    db.delete(log)
    db.commit()
    return None