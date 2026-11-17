"""POST /api/v1/assistant/ask: ask the assistant a question about the caller's own data.

Safety lives in ``agent/`` (read-only tools bound to the caller's organization). What this
router adds is everything around it: who may ask, how often, and what happens when the
model API is misconfigured or down. None of those failures reveal details to the caller.
"""

import logging
import math
import os
from functools import lru_cache

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from agent import AgentInputError, run_agent
from agent.loop import DEFAULT_MODEL, MessagesClient
from agent.ratelimit import RateLimiter, acquire
from auth.tenancy import OrgContext, read_access
from database import get_db
from schemas.assistant import AskRequest, AskResponse, ToolCallInfo

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/assistant",
    tags=["Assistant"],
    dependencies=[Depends(read_access)],
)


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


# Per user: generous for a person, useless for a script. Global: a ceiling on the bill.
user_limiter = RateLimiter(_int_env("ASSISTANT_USER_LIMIT_PER_HOUR", 20), 3600)
global_limiter = RateLimiter(_int_env("ASSISTANT_GLOBAL_LIMIT_PER_DAY", 500), 86400)


@lru_cache
def _real_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(timeout=30.0)


def get_assistant_client() -> MessagesClient:
    """The Anthropic client, or 503 when the server has no API key configured."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The assistant is not available."
        )
    return _real_client()


@router.post("/ask", response_model=AskResponse)
def ask(
    body: AskRequest,
    ctx: OrgContext = Depends(read_access),
    db: Session = Depends(get_db),
    client: MessagesClient = Depends(get_assistant_client),
) -> AskResponse:
    limited = acquire(
        ("user", user_limiter, str(ctx.user.id)),
        ("global", global_limiter, "all"),
    )
    if limited is not None:
        scope, wait = limited
        detail = (
            "You have asked too many questions. Try again later."
            if scope == "user"
            else "The assistant is busy right now. Try again later."
        )
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail,
            headers={"Retry-After": str(max(1, math.ceil(wait)))},
        )

    try:
        result = run_agent(
            body.question,
            ctx,
            db,
            client,
            history=[message.model_dump() for message in body.history],
            model=os.getenv("ASSISTANT_MODEL", DEFAULT_MODEL),
        )
    except AgentInputError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError):
        # Our key is wrong or revoked: an operator problem, not something to explain.
        logger.error("Assistant API credentials were rejected")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The assistant is not available."
        )
    except anthropic.APIError:
        logger.exception("Assistant model call failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "The assistant is temporarily unavailable. Try again in a moment.",
        )

    logger.info(
        "assistant user=%s org=%s turns=%d tools=%d tokens_in=%d tokens_out=%d",
        ctx.user.id,
        ctx.organization.id,
        result.turns,
        len(result.tool_calls),
        result.input_tokens,
        result.output_tokens,
    )
    return AskResponse(
        answer=result.answer,
        completed=result.completed,
        tool_calls=[
            ToolCallInfo(name=call.name, is_error=call.is_error)
            for call in result.tool_calls
        ],
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
