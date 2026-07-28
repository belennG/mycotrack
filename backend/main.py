from fastapi import FastAPI

# Application factory pattern / initialization
app = FastAPI(
    title="MycoTrack API",
    description="Backend for the MycoTrack ClimateTech Dashboard",
    version="1.0.0"
)

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend works"}