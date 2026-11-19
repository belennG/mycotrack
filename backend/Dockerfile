# The MycoTrack API as a container image.
#
# Build (from the repository root):   docker build -t mycotrack-api backend
# Run:                                docker run --env-file backend/.env -p 8000:8000 mycotrack-api
#
# No secrets are baked into the image: the database URL, Auth0 and Anthropic settings all
# arrive as environment variables when the container starts (see backend/.env.example).
#
# Python 3.13 is what requirements.txt was compiled with and what CI tests.
FROM python:3.13-slim

# No .pyc files in the image, and logs go straight to the container's output.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first: this layer is rebuilt only when requirements.txt changes, not on every
# code edit. psycopg2-binary ships a wheel, so no compiler or libpq is needed.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Only what the API needs at runtime. Tests, evals, scripts and the dev tools stay out.
COPY main.py database.py alembic.ini ./
COPY agent ./agent
COPY alembic ./alembic
COPY auth ./auth
COPY middleware ./middleware
COPY models ./models
COPY routers ./routers
COPY schemas ./schemas
COPY services ./services

# Do not run as root.
RUN useradd --no-create-home --uid 10001 app
USER app

EXPOSE 8000

# Reports healthy once /health answers (the app does not need the database for this).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"]

# Migrations are deliberately not run here: with several containers starting at once they
# would race. Run them as a separate one-off command:
#   docker run --rm --env-file backend/.env mycotrack-api alembic upgrade head
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
