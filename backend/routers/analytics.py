from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from uuid import UUID

from database import get_db
from mycotrack.backend.models.tracking import Tracking
from models.batch import Batch
from services.analytics import (
    calculate_averages,
    analyze_trends,
    calculate_completeness,
)
from services.alerts import generate_alerts
from schemas.alert import AnalyticsResponse, BatchSummaryResponse

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/batch/{batch_id}", response_model=AnalyticsResponse)
def get_batch_analytics(
    batch_id: UUID,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    metric_type: Optional[str] = Query(
        None, description="Filter by specific metric (e.g., temperature)"
    ),
    db: Session = Depends(get_db),
):
    """
    Get analytics (min, max, avg, trend) for a specific batch.

    This endpoint handles missing data by skipping null values in calculations.
    Returns a completeness_score (0-100%) indicating how many expected sensor readings were recorded
    """
    # 1. Verify batch exists
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found"
        )

    # 2. Fetch trackings and apply date filters
    query = db.query(Tracking).filter(Tracking.batch_id == batch_id)
    if date_from:
        query = query.filter(Tracking.tracking_date >= date_from)
    if date_to:
        query = query.filter(Tracking.tracking_date <= date_to)

    trackings = query.order_by(Tracking.tracking_date.asc()).all()

    if not trackings:
        return {
            "message": "No data available for this batch in the specified date range."
        }

    # 3. Calculate metrics via services
    averages = calculate_averages(trackings)
    trends = analyze_trends(trackings)

    # 4. Filter by specific metric if requested
    metrics_list = ["temperature", "humidity", "ph_level", "moisture"]
    if metric_type and metric_type in metrics_list:
        metrics_list = [metric_type]

    # 5. Compile statistics
    statistics = {}
    for metric in metrics_list:
        # Extract all non-null values for the current metric to find min/max
        values = [
            getattr(tracking, metric)
            for tracking in trackings
            if getattr(tracking, metric) is not None
        ]

        statistics[metric] = {
            "min": min(values) if values else None,
            "max": max(values) if values else None,
            "avg": averages.get(metric, 0.0),
            "trend": trends.get(metric, "stable"),
        }

    return {
        "batch_id": batch_id,
        "completeness_score": calculate_completeness(trackings),
        "statistics": statistics,
    }


@router.get("/batch/{batch_id}/summary", response_model=BatchSummaryResponse)
def get_batch_summary(batch_id: UUID, db: Session = Depends(get_db)):
    """
    Get overall health status, key metrics, and active alerts count for a batch.

    ### Alert Threshold Documentation:
    Alerts are generated based on the following default safe ranges:
    * **Temperature:** 20.0°C to 25.0°C
    * **Humidity:** 85.0% to 95.0%
    * **pH Level:** 6.0 to 7.5
    * **Moisture:** 75.0% to 90.0%

    If data is missing entirely for a day, a `missing_data` warning is generated.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found"
        )

    trackings = (
        db.query(Tracking)
        .filter(Tracking.batch_id == batch_id)
        .order_by(Tracking.tracking_date.asc())
        .all()
    )

    key_metrics = calculate_averages(trackings)

    alerts_count = 0
    health_status = "Healthy"
    active_alerts = []

    # Evaluate health based on the most recent tracking
    if trackings:
        latest_tracking = trackings[-1]
        active_alerts = generate_alerts(latest_tracking)
        alerts_count = len(active_alerts)

        if alerts_count > 0:
            # Check severity to determine overall health status
            if any(alert.get("severity") == "critical" for alert in active_alerts):
                health_status = "Critical"
            else:
                health_status = "Warning"
    else:
        health_status = "Unknown (No Data)"

    return {
        "batch_id": batch_id,
        "health_status": health_status,
        "alerts_count": alerts_count,
        "key_metrics": key_metrics,
        "recent_alerts": active_alerts,
    }
