from dotenv import load_dotenv
import sentry_sdk
import os
from fastapi import FastAPI
from middleware.cors import setup_cors
from routers import analytics, alerts, batches, trackings, users

load_dotenv()

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    send_default_pii=True,
    enable_logs=True,
    traces_sample_rate=1.0,
    profile_session_sample_rate=1.0,
    profile_lifecycle="trace",
)

# Application factory pattern / initialization
app = FastAPI(
    title="MycoTrack API",
    description="Backend for the MycoTrack ClimateTech Dashboard",
    version="1.0.0",
)

# 1. Apply CORS middleware
setup_cors(app)

# 2. Include the routers. Every /api/v1 router except this one requires a valid
#    Auth0 access token (see auth.get_current_user).
app.include_router(users.router)
app.include_router(trackings.router)
app.include_router(analytics.router)
app.include_router(alerts.router)
app.include_router(batches.router)


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend works"}
