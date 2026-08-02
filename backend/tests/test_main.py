from fastapi.testclient import TestClient
from main import app

# Create a fake web browser to test our app
client = TestClient(app)

def test_app_boots_successfully():
    """
    Test that the FastAPI application initializes correctly
    and the Swagger UI documentation is accessible.
    """
    response = client.get("/docs")
    
    # Assert checks if a condition is True. If it's False, the test fails.
    assert response.status_code == 200