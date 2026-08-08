from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI) -> None:
    """
    Configures Cross-Origin Resource Sharing (CORS) for the FastAPI application.
    Allows the frontend to securely communicate with the backend API.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://mycotrack-frontend-prod-2026.s3-website.eu-north-1.amazonaws.com",
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=600,
    )
