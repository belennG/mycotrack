"""The assistant's tools: read-only functions over the caller's own organization.

Design rules (they are what keeps the agent safe, so each has a test):

- **The model never chooses the tenant.** No tool accepts an organization id; every query
  is filtered by ``ctx.organization`` which the server resolved from the authenticated
  user. Input models forbid unknown fields, so an ``organization_id`` the model invents is
  rejected rather than ignored.
- **Another organization's data looks exactly like data that does not exist.** Same
  "not found" answer as the REST API.
- **Read-only.** Nothing here writes. (Writing, later, goes through a proposal that a
  person confirms; the model gets no tool that executes it.)
- **Tools never raise into the loop.** Every failure becomes an error result the model can
  read, and internal details are logged, not shown.
- **Output is bounded** and all user-written text goes through ``agent.sanitize``.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from agent.sanitize import clean, wrap_note
from auth.tenancy import OrgContext
from models.batch import Batch
from models.tracking import Tracking
from services.alerts import generate_alerts
from services.thresholds import preset_for
from services.analytics import analyze_trends, calculate_averages

logger = logging.getLogger(__name__)

MAX_TOOL_RESULT_CHARS = 6000
MAX_BATCHES_LISTED = 50
SUMMARY_WINDOW = 50
MAX_READINGS = 20


class ToolError(Exception):
    """A failure whose message is safe to show the model."""


class _Input(BaseModel):
    # Unknown fields are an error: a made-up ``organization_id`` must not be silently dropped.
    model_config = ConfigDict(extra="forbid")


class ListBatchesInput(_Input):
    status: Literal["ACTIVE", "COMPLETED", "FAILED", "ARCHIVED"] | None = Field(
        default=None, description="Only batches in this status. Omit to list all."
    )


class BatchIdInput(_Input):
    batch_id: UUID = Field(
        description="The id of the batch, as returned by list_batches."
    )


class RecentReadingsInput(_Input):
    batch_id: UUID = Field(
        description="The id of the batch, as returned by list_batches."
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=MAX_READINGS,
        description="How many readings, newest first.",
    )


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_model: type[_Input]
    handler: Callable[[Any, OrgContext, Session], dict]

    def schema(self) -> dict:
        """The definition sent to the model. The input schema comes from the Pydantic model,
        so what the model is told and what is validated cannot drift apart."""
        json_schema = self.input_model.model_json_schema()
        json_schema.pop("title", None)
        for prop in json_schema.get("properties", {}).values():
            prop.pop("title", None)
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": json_schema,
        }


def _get_batch(db: Session, ctx: OrgContext, batch_id: UUID) -> Batch:
    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id, Batch.organization_id == ctx.organization.id)
        .first()
    )
    if batch is None:
        raise ToolError("Batch not found.")
    return batch


def _reading(tracking: Tracking) -> dict:
    return {
        "recorded_at": tracking.tracking_date.isoformat(),
        "temperature_c": tracking.temperature,
        "humidity_pct": tracking.humidity,
        "ph": tracking.ph_level,
        "moisture_pct": tracking.moisture,
        "notes": wrap_note(tracking.notes),
    }


def _latest_readings(db: Session, batch: Batch, limit: int) -> list[Tracking]:
    return (
        db.query(Tracking)
        .filter(Tracking.batch_id == batch.id)
        .order_by(Tracking.tracking_date.desc(), Tracking.created_at.desc())
        .limit(limit)
        .all()
    )


def _list_batches(args: ListBatchesInput, ctx: OrgContext, db: Session) -> dict:
    query = db.query(Batch).filter(Batch.organization_id == ctx.organization.id)
    if args.status:
        query = query.filter(Batch.status == args.status)
    total = query.count()
    batches = query.order_by(Batch.created_at.desc()).limit(MAX_BATCHES_LISTED).all()

    items = []
    for batch in batches:
        latest = _latest_readings(db, batch, 1)
        items.append(
            {
                "id": str(batch.id),
                "name": clean(batch.batch_name),
                "crop_type": clean(batch.crop_type),
                "status": batch.status.value,
                "location": clean(batch.location),
                "latest_reading": _reading(latest[0]) if latest else None,
            }
        )
    return {"total": total, "shown": len(items), "batches": items}


def _get_batch_summary(args: BatchIdInput, ctx: OrgContext, db: Session) -> dict:
    batch = _get_batch(db, ctx, args.batch_id)
    readings = _latest_readings(db, batch, SUMMARY_WINDOW)

    summary: dict = {
        "id": str(batch.id),
        "name": clean(batch.batch_name),
        "crop_type": clean(batch.crop_type),
        "status": batch.status.value,
        "location": clean(batch.location),
        "started": batch.start_date.isoformat(),
        "expected_harvest": batch.expected_harvest_date.isoformat(),
        "notes": wrap_note(batch.notes),
        "readings_considered": len(readings),
    }
    if not readings:
        summary["health"] = "No readings recorded yet."
        return summary

    preset, thresholds = preset_for(batch.crop_type)
    issues = generate_alerts(readings[0], thresholds)
    summary.update(
        {
            "averages": calculate_averages(readings),
            "trends": analyze_trends(readings),
            "latest_reading": _reading(readings[0]),
            "health": "Needs attention" if issues else "Within range",
            "current_issues": [issue["message"] for issue in issues],
            "thresholds_used": thresholds,
            "thresholds_note": (
                f"Safe ranges for this batch's crop type ({preset}). They are approximate "
                "guide values, not advice for a particular strain or room."
                if not preset.startswith("default")
                else "This crop type has no ranges of its own, so the oyster mushroom ranges "
                "are used as a default; treat the comparison as rough."
            ),
        }
    )
    return summary


def _get_recent_readings(
    args: RecentReadingsInput, ctx: OrgContext, db: Session
) -> dict:
    batch = _get_batch(db, ctx, args.batch_id)
    readings = _latest_readings(db, batch, args.limit)
    return {
        "batch": clean(batch.batch_name),
        "count": len(readings),
        "readings": [_reading(reading) for reading in readings],
    }


TOOLS: dict[str, Tool] = {
    tool.name: tool
    for tool in (
        Tool(
            name="list_batches",
            description=(
                "List the cultivation batches of the user's organization, with each batch's "
                "id, name, crop type, status, location and latest reading. Call this first "
                "whenever you need a batch id or want an overview of all batches."
            ),
            input_model=ListBatchesInput,
            handler=_list_batches,
        ),
        Tool(
            name="get_batch_summary",
            description=(
                "Summarize one batch: details, averages and trends over its recent readings, "
                "and whether its latest reading is outside the safe ranges. Use it to answer "
                "'how is batch X doing?' or to compare batches. Needs a batch id."
            ),
            input_model=BatchIdInput,
            handler=_get_batch_summary,
        ),
        Tool(
            name="get_recent_readings",
            description=(
                "Get the most recent environmental readings (temperature, humidity, pH, "
                "moisture, with date and time) of one batch, newest first. Use it when the "
                "user asks about specific values or how something changed over time."
            ),
            input_model=RecentReadingsInput,
            handler=_get_recent_readings,
        ),
    )
}


def tool_schemas() -> list[dict]:
    return [tool.schema() for tool in TOOLS.values()]


@dataclass(frozen=True)
class ToolOutput:
    content: str
    is_error: bool = False


def _truncate(text: str) -> str:
    if len(text) <= MAX_TOOL_RESULT_CHARS:
        return text
    return text[:MAX_TOOL_RESULT_CHARS] + "\n[result truncated]"


def run_tool(name: str, tool_input: Any, ctx: OrgContext, db: Session) -> ToolOutput:
    """Run one tool call requested by the model. Never raises."""
    tool = TOOLS.get(name)
    if tool is None:
        return ToolOutput(f"Unknown tool '{clean(name, 60)}'.", is_error=True)

    try:
        args = tool.input_model.model_validate(tool_input)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc']) or 'input'}: {err['msg']}"
            for err in exc.errors()
        )
        return ToolOutput(f"Invalid input. {problems}", is_error=True)

    try:
        result = tool.handler(args, ctx, db)
    except ToolError as exc:
        return ToolOutput(str(exc), is_error=True)
    except Exception:  # noqa: BLE001 - the loop must survive any tool failure
        logger.exception("Assistant tool %s failed", name)
        return ToolOutput("The tool failed internally.", is_error=True)

    return ToolOutput(_truncate(json.dumps(result, default=str, ensure_ascii=False)))
