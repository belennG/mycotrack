from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from agent.loop import MAX_QUESTION_CHARS

MAX_HISTORY_MESSAGES = 6  # three question/answer pairs
# Per message. Must fit a full answer: the model may write up to 1024 tokens (~5000 characters),
# and that answer comes back as history on the next question.
MAX_HISTORY_CHARS = 6000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_HISTORY_CHARS)


class AskRequest(BaseModel):
    question: str = Field(max_length=MAX_QUESTION_CHARS)
    # Earlier turns of the conversation. The server keeps no state, so the client sends
    # them back; they are bounded and must alternate user/assistant, ending on the assistant.
    history: list[ChatMessage] = Field(
        default_factory=list, max_length=MAX_HISTORY_MESSAGES
    )

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The question is empty.")
        return value

    @model_validator(mode="after")
    def history_alternates(self) -> "AskRequest":
        for index, message in enumerate(self.history):
            expected = "user" if index % 2 == 0 else "assistant"
            if message.role != expected:
                raise ValueError(
                    "History must alternate user and assistant messages, starting with user."
                )
        if len(self.history) % 2 == 1:
            raise ValueError("History must end with an assistant message.")
        return self


class ToolCallInfo(BaseModel):
    name: str
    is_error: bool


class AskResponse(BaseModel):
    answer: str
    completed: bool
    tool_calls: list[ToolCallInfo]
    input_tokens: int
    output_tokens: int
