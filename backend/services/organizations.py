import re
import secrets

from sqlalchemy.orm import Session

from models.organization import Membership, MemberRole, Organization
from models.user import User


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:60] or "farm"


def _unique_slug(db: Session, base: str) -> str:
    """Append a short random suffix, retrying on the (unlikely) collision."""
    while True:
        candidate = f"{slugify(base)}-{secrets.token_hex(2)}"
        if not db.query(Organization.id).filter(Organization.slug == candidate).first():
            return candidate


def create_personal_org(db: Session, user: User) -> Membership:
    """Give *user* their own organization with an OWNER membership.

    Adds to the session and flushes but does not commit, so the caller decides the
    transaction boundary (first login creates the user and the organization atomically).
    """
    label = user.name or (user.email or "").split("@")[0] or "My"
    org = Organization(name=f"{label}'s Farm", slug=_unique_slug(db, label))
    db.add(org)
    db.flush()

    membership = Membership(
        user_id=user.id, organization_id=org.id, role=MemberRole.OWNER
    )
    db.add(membership)
    db.flush()
    return membership
