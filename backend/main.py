from fastapi import FastAPI
from middleware.cors import setup_cors
from routers import daily_logs, analytics, alerts, batches

# Application factory pattern / initialization
app = FastAPI(
    title="MycoTrack API",
    description="Backend for the MycoTrack ClimateTech Dashboard",
    version="1.0.0",
)

# 1. Apply CORS middleware
setup_cors(app)

# 2. Include the daily logs router
app.include_router(daily_logs.router)
app.include_router(analytics.router)
app.include_router(alerts.router)
app.include_router(batches.router)


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend works"}
