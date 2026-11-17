"""A small in-memory sliding-window rate limiter.

Every assistant question costs real money, and sign-up is open, so the endpoint is capped
twice: per user (a normal person never notices it) and globally (a hard ceiling on the
bill however many accounts someone creates).

In memory means per process: it resets on restart and is not shared between several
workers. That is acceptable for one small API server and is the first thing to replace
(for example with Redis) if the API ever runs on more than one.
"""

import threading
import time
from collections import deque
from typing import Callable


class RateLimiter:
    """Allows at most ``limit`` events per key in any ``window_seconds`` window."""

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = {}

    def _recent(self, key: str) -> deque[float]:
        events = self._events.setdefault(key, deque())
        cutoff = self._clock() - self.window
        while events and events[0] <= cutoff:
            events.popleft()
        if not events:
            del self._events[key]
            return deque()
        return events

    def retry_after(self, key: str) -> float:
        """Seconds until one more event is allowed for *key* (0 if allowed now)."""
        events = self._recent(key)
        if len(events) < self.limit:
            return 0.0
        return events[0] + self.window - self._clock()

    def record(self, key: str) -> None:
        self._events.setdefault(key, deque()).append(self._clock())

    def reset(self) -> None:
        self._events.clear()


_lock = threading.Lock()


def acquire(*checks: tuple[str, RateLimiter, str]) -> tuple[str, float] | None:
    """Count one event against every limiter, or against none.

    *checks* are ``(name, limiter, key)``. If any limiter is full, nothing is recorded and
    ``(name, seconds_to_wait)`` of the first full one is returned. Otherwise the event is
    recorded on all of them and ``None`` is returned. A lock makes check-then-record atomic
    across the request threads.
    """
    with _lock:
        for name, limiter, key in checks:
            wait = limiter.retry_after(key)
            if wait > 0:
                return name, wait
        for _name, limiter, key in checks:
            limiter.record(key)
    return None
