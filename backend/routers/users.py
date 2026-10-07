from fastapi import APIRouter, Depends

from auth import get_current_user
from models.user import User
from schemas.user import UserResponse

router = APIRouter(prefix="/api/v1", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Return the profile of the currently authenticated user."""
    return current_user
