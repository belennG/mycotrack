from fastapi import FastAPI
from middleware.cors import setup_cors
from routers import analytics, alerts, batches, trackings

# Application factory pattern / initialization
app = FastAPI(
    title="MycoTrack API",
    description="Backend for the MycoTrack ClimateTech Dashboard",
    version="1.0.0",
)

# 1. Apply CORS middleware
setup_cors(app)

# 2. Include the trackings router
app.include_router(trackings.router)
app.include_router(analytics.router)
app.include_router(alerts.router)
app.include_router(batches.router)


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend works"}
