"""store the time of day of tracking readings

Revision ID: d4e8f1a6c2b9
Revises: c3a9e5d7b1f2
Create Date: 2026-10-08 00:00:00.000000

``trackings.tracking_date`` was created as a DATE although the model, the API schema and
both forms use a date *and time*, so the time of every reading was being discarded. This
makes the column a timestamp. Existing rows keep their date and get midnight as the time:
the original time of day was never stored and cannot be recovered. Naive timestamp,
as for every other timestamp column in the schema.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4e8f1a6c2b9"
down_revision: Union[str, Sequence[str], None] = "c3a9e5d7b1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "trackings",
        "tracking_date",
        existing_type=sa.Date(),
        type_=sa.DateTime(),
        existing_nullable=False,
        postgresql_using="tracking_date::timestamp",
    )


def downgrade() -> None:
    """Downgrade schema. Drops the time of day of every reading."""
    op.alter_column(
        "trackings",
        "tracking_date",
        existing_type=sa.DateTime(),
        type_=sa.Date(),
        existing_nullable=False,
        postgresql_using="tracking_date::date",
    )
