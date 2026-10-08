"""add organizations, memberships and tenant-scope batches

Revision ID: c3a9e5d7b1f2
Revises: b7f1a2c3d4e5
Create Date: 2026-10-08 00:00:00.000000

Existing batches (created before multi-tenancy) are moved into a "Legacy" organization
owned by the earliest user, so the first person to sign in keeps their data. If there are
batches but no user yet the organization is created without a member; the batches stay in it.
"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3a9e5d7b1f2"
down_revision: Union[str, Sequence[str], None] = "b7f1a2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

memberrole = sa.Enum("OWNER", "ADMIN", "MEMBER", "VIEWER", name="memberrole")


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "organizations",
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_organizations_id"), "organizations", ["id"], unique=False)
    op.create_index(
        op.f("ix_organizations_slug"), "organizations", ["slug"], unique=True
    )

    op.create_table(
        "memberships",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("role", memberrole, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "organization_id", name="uq_membership_user_org"
        ),
    )
    op.create_index(op.f("ix_memberships_id"), "memberships", ["id"], unique=False)
    op.create_index(
        op.f("ix_memberships_user_id"), "memberships", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_memberships_organization_id"),
        "memberships",
        ["organization_id"],
        unique=False,
    )

    # batches.organization_id: add nullable, backfill, then enforce NOT NULL.
    op.add_column("batches", sa.Column("organization_id", sa.UUID(), nullable=True))

    bind = op.get_bind()
    batch_count = bind.execute(sa.text("SELECT count(*) FROM batches")).scalar()
    if batch_count:
        org_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO organizations (id, name, slug, created_at, updated_at) "
                "VALUES (:id, 'Legacy', 'legacy', now(), now())"
            ),
            {"id": org_id},
        )
        bind.execute(
            sa.text("UPDATE batches SET organization_id = :org"), {"org": org_id}
        )
        owner_id = bind.execute(
            sa.text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
        ).scalar()
        if owner_id:
            bind.execute(
                sa.text(
                    "INSERT INTO memberships (id, user_id, organization_id, role, created_at) "
                    "VALUES (:id, :user, :org, 'OWNER', now())"
                ),
                {"id": uuid.uuid4(), "user": owner_id, "org": org_id},
            )

    op.alter_column("batches", "organization_id", nullable=False)
    op.create_foreign_key(
        "fk_batches_organization_id",
        "batches",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_batches_organization_id"), "batches", ["organization_id"], unique=False
    )

    # Batch names are now unique per organization, not globally.
    op.drop_index("ix_batches_batch_name", table_name="batches")
    op.create_index(
        op.f("ix_batches_batch_name"), "batches", ["batch_name"], unique=False
    )
    op.create_unique_constraint(
        "uq_batches_org_name", "batches", ["organization_id", "batch_name"]
    )


def downgrade() -> None:
    """Downgrade schema.

    Restoring the global unique batch name fails if two organizations now share a name.
    """
    op.drop_constraint("uq_batches_org_name", "batches", type_="unique")
    op.drop_index(op.f("ix_batches_batch_name"), table_name="batches")
    op.create_index("ix_batches_batch_name", "batches", ["batch_name"], unique=True)

    op.drop_index(op.f("ix_batches_organization_id"), table_name="batches")
    op.drop_constraint("fk_batches_organization_id", "batches", type_="foreignkey")
    op.drop_column("batches", "organization_id")

    op.drop_index(op.f("ix_memberships_organization_id"), table_name="memberships")
    op.drop_index(op.f("ix_memberships_user_id"), table_name="memberships")
    op.drop_index(op.f("ix_memberships_id"), table_name="memberships")
    op.drop_table("memberships")
    op.drop_index(op.f("ix_organizations_slug"), table_name="organizations")
    op.drop_index(op.f("ix_organizations_id"), table_name="organizations")
    op.drop_table("organizations")
    memberrole.drop(op.get_bind(), checkfirst=True)
