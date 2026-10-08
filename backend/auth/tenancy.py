"""Tenant scoping and role checks.

Every data route depends on one of ``read_access`` / ``write_access`` / ``admin_access``.
They resolve which organization the request is for and enforce the caller's role there.
Routes then filter by ``ctx.organization.id``; anything in another organization is reported
as 404 (not 403) so its existence is not revealed.
"""

from dataclasses import dataclass
from typing import Callable, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from models.organization import Membership, MemberRole, Organization
from models.user import User
from services.organizations import create_personal_org

ROLE_RANK = {
    MemberRole.VIEWER: 1,
    MemberRole.MEMBER: 2,
    MemberRole.ADMIN: 3,
    MemberRole.OWNER: 4,
}


@dataclass
class OrgContext:
    user: User
    organization: Organization
    membership: Membership

    @property
    def role(self) -> MemberRole:
        return self.membership.role


def get_org_context(
    x_org_id: Optional[UUID] = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrgContext:
    """Resolve the organization this request acts on.

    ``X-Org-Id`` picks one the user belongs to (404 if they don't); without it the user's
    oldest membership is used. A user with no membership at all (an account created before
    multi-tenancy) gets a personal organization on the spot.
    """
    memberships = db.query(Membership).filter(Membership.user_id == user.id)

    if x_org_id is not None:
        membership = memberships.filter(Membership.organization_id == x_org_id).first()
        if membership is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    else:
        membership = memberships.order_by(Membership.created_at.asc()).first()
        if membership is None:
            membership = create_personal_org(db, user)
            db.commit()

    return OrgContext(
        user=user, organization=membership.organization, membership=membership
    )


def require_role(minimum: MemberRole) -> Callable[..., OrgContext]:
    """Dependency factory: the caller must hold at least *minimum* in the active org."""

    def dependency(ctx: OrgContext = Depends(get_org_context)) -> OrgContext:
        if ROLE_RANK[ctx.role] < ROLE_RANK[minimum]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Your role does not allow this action"
            )
        return ctx

    return dependency


read_access = require_role(MemberRole.VIEWER)
write_access = require_role(MemberRole.MEMBER)
admin_access = require_role(MemberRole.ADMIN)
