"""The MycoTrack assistant: a small, read-only agent built on a manual tool-use loop.

See ``docs/agent.md`` for the design and the security model.
"""

from agent.loop import AgentInputError, AgentResult, run_agent

__all__ = ["AgentInputError", "AgentResult", "run_agent"]
