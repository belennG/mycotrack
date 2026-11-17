"""The agent loop, written by hand.

The model never touches the database. It *asks* for a tool call, our code decides whether
and how to run it, and the result goes back to the model, until it answers in plain text:

    question -> model -> "call get_batch_summary(...)" -> we run it -> result -> model -> ...
                                                                              -> final answer

The client is passed in (anything with ``messages.create``) so tests can script the model
and the real ``anthropic.Anthropic`` client can be dropped in without changing this code.
"""

from dataclasses import dataclass, field
from typing import Any, Protocol

from sqlalchemy.orm import Session

from agent.prompts import SYSTEM_PROMPT
from agent.tools import run_tool, tool_schemas
from auth.tenancy import OrgContext

DEFAULT_MODEL = "claude-haiku-5-5"
MAX_TURNS = 6  # model calls per question: bounds both cost and runaway loops
MAX_TOKENS = 1024  # per model call
MAX_QUESTION_CHARS = 1000

FALLBACK_ANSWER = "I could not finish answering that. Try a more specific question."


class AgentInputError(ValueError):
    """The question is not acceptable (empty or too long)."""


class MessagesClient(Protocol):
    """The slice of ``anthropic.Anthropic`` the loop relies on."""

    @property
    def messages(self) -> Any: ...


@dataclass
class ToolCall:
    name: str
    input: Any
    is_error: bool


@dataclass
class AgentResult:
    answer: str
    completed: bool  # False when the turn limit or the token limit cut the answer short
    turns: int
    tool_calls: list[ToolCall] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0


def _text_of(response: Any) -> str:
    return "".join(
        block.text for block in response.content if getattr(block, "type", "") == "text"
    ).strip()


def run_agent(
    question: str,
    ctx: OrgContext,
    db: Session,
    client: MessagesClient,
    *,
    model: str = DEFAULT_MODEL,
    max_turns: int = MAX_TURNS,
) -> AgentResult:
    question = question.strip()
    if not question:
        raise AgentInputError("The question is empty.")
    if len(question) > MAX_QUESTION_CHARS:
        raise AgentInputError(
            f"The question is longer than {MAX_QUESTION_CHARS} characters."
        )

    tools = tool_schemas()
    messages: list[dict] = [{"role": "user", "content": question}]
    result = AgentResult(answer="", completed=False, turns=0)

    for _ in range(max_turns):
        response = client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        )
        result.turns += 1
        usage = getattr(response, "usage", None)
        result.input_tokens += getattr(usage, "input_tokens", 0) or 0
        result.output_tokens += getattr(usage, "output_tokens", 0) or 0

        requested = [
            block
            for block in response.content
            if getattr(block, "type", "") == "tool_use"
        ]
        if response.stop_reason != "tool_use" or not requested:
            result.answer = _text_of(response) or FALLBACK_ANSWER
            result.completed = response.stop_reason != "max_tokens"
            return result

        # Keep the model's own turn in the history, then answer every tool request in
        # a single user message.
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in requested:
            output = run_tool(block.name, block.input, ctx, db)
            result.tool_calls.append(ToolCall(block.name, block.input, output.is_error))
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output.content,
                    "is_error": output.is_error,
                }
            )
        messages.append({"role": "user", "content": tool_results})

    result.answer = FALLBACK_ANSWER
    return result
