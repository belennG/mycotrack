"""Handling of user-written text before it reaches the model.

Batch names, locations and notes are typed by users, so anything the assistant reads
from them is *untrusted*: it may contain instructions aimed at the model ("ignore the
above and..."). This cannot be fully prevented, only contained (see docs/agent.md), and
the first layer is making that text unable to look like anything but data:

- angle brackets are escaped, so text cannot close or fake a delimiter tag;
- length is capped, so a long note cannot smuggle in a wall of instructions;
- notes are wrapped in an explicit tag that the system prompt declares to be data.
"""

NOTE_TAG = "user_note"
MAX_FIELD_CHARS = 150
MAX_NOTE_CHARS = 500


def clean(text: str | None, limit: int = MAX_FIELD_CHARS) -> str | None:
    """Make a short user-written value (a name, a location) safe to show the model."""
    if text is None:
        return None
    escaped = text.replace("<", "&lt;").replace(">", "&gt;")
    if len(escaped) > limit:
        return escaped[:limit] + "…"
    return escaped


def wrap_note(text: str | None) -> str | None:
    """Wrap free-form notes in a delimiter the system prompt treats as data."""
    if not text:
        return None
    return f"<{NOTE_TAG}>{clean(text, MAX_NOTE_CHARS)}</{NOTE_TAG}>"
