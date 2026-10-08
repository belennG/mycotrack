from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.tenancy import OrgContext, read_access
from database import get_db
from models.organization import Membership
from schemas.user import MeResponse, OrganizationSummary

router = APIRouter(prefix="/api/v1", tags=["Users"])


def _summary(membership: Membership) -> OrganizationSummary:
    org = membership.organization
    return OrganizationSummary(
        id=org.id, name=org.name, slug=org.slug, role=membership.role.value
    )


@router.get("/me", response_model=MeResponse)
def read_current_user(
    ctx: OrgContext = Depends(read_access), db: Session = Depends(get_db)
) -> MeResponse:
    """The authenticated user's profile, the active organization, and all their organizations."""
    memberships = (
        db.query(Membership)
        .filter(Membership.user_id == ctx.user.id)
        .order_by(Membership.created_at.asc())
        .all()
    )
    return MeResponse(
        **{
            c: getattr(ctx.user, c)
            for c in ("id", "email", "name", "picture", "created_at", "last_login_at")
        },
        organization=_summary(ctx.membership),
        organizations=[_summary(m) for m in memberships],
    )
