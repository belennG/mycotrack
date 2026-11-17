"""The sliding-window limiter that caps what the assistant can cost."""

from agent.ratelimit import RateLimiter, acquire


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def make_limiter(limit=2, window=60.0):
    clock = Clock()
    return RateLimiter(limit, window, clock), clock


def test_allows_up_to_the_limit_then_says_how_long_to_wait():
    limiter, clock = make_limiter(limit=2, window=60)
    for _ in range(2):
        assert limiter.retry_after("u") == 0
        limiter.record("u")
        clock.now += 10
    assert (
        limiter.retry_after("u") == 60 - 20
    )  # the oldest event leaves the window in 40 s


def test_events_expire_after_the_window():
    limiter, clock = make_limiter(limit=1, window=60)
    limiter.record("u")
    assert limiter.retry_after("u") > 0
    clock.now += 61
    assert limiter.retry_after("u") == 0


def test_keys_are_independent():
    limiter, _ = make_limiter(limit=1)
    limiter.record("alice")
    assert limiter.retry_after("alice") > 0
    assert limiter.retry_after("bob") == 0


def test_acquire_records_on_every_limiter_when_allowed():
    user, _ = make_limiter(limit=2)
    overall, _ = make_limiter(limit=2)
    assert acquire(("user", user, "u"), ("global", overall, "all")) is None
    assert user.retry_after("u") == 0 and overall.retry_after("all") == 0
    assert acquire(("user", user, "u"), ("global", overall, "all")) is None
    assert user.retry_after("u") > 0 and overall.retry_after("all") > 0


def test_a_refused_acquire_records_nothing_anywhere():
    """A user who is over their own limit must not use up the shared global budget."""
    user, _ = make_limiter(limit=1)
    overall, _ = make_limiter(limit=10)
    assert acquire(("user", user, "u"), ("global", overall, "all")) is None
    refused = acquire(("user", user, "u"), ("global", overall, "all"))
    assert refused is not None and refused[0] == "user"
    # Nine slots of the global budget remain: only the first, successful call used one.
    for _ in range(9):
        assert acquire(("global", overall, "all")) is None
    assert acquire(("global", overall, "all")) is not None


def test_reset_forgets_everything():
    limiter, _ = make_limiter(limit=1)
    limiter.record("u")
    limiter.reset()
    assert limiter.retry_after("u") == 0
