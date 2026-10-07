"""Fetch and cache Auth0's JSON Web Key Set (JWKS).

Auth0 publishes the public keys used to sign access tokens at
``https://<domain>/.well-known/jwks.json``. Keys rotate rarely, so the document
is cached in-process with a TTL and refetched on demand when a token references
an unknown ``kid`` (key id).
"""

import threading
import time
from typing import Optional

import httpx

from auth.config import settings

_HTTP_TIMEOUT = 5.0

_lock = threading.Lock()


class _Cache:
    jwks: Optional[dict] = None
    fetched_at: float = 0.0


_cache = _Cache()


def _fetch() -> dict:
    if not settings.jwks_url:
        raise RuntimeError(
            "AUTH0_DOMAIN is not set; cannot fetch JWKS. "
            "See docs/auth0.md for configuration."
        )
    response = httpx.get(settings.jwks_url, timeout=_HTTP_TIMEOUT)
    response.raise_for_status()
    return response.json()


def _is_fresh(now: float) -> bool:
    return (
        _cache.jwks is not None
        and (now - _cache.fetched_at) < settings.jwks_cache_seconds
    )


def get_jwks(*, force_refresh: bool = False) -> dict:
    """Return the cached JWKS document, fetching it if stale or forced."""
    cached = _cache.jwks
    if not force_refresh and cached is not None and _is_fresh(time.time()):
        return cached

    with _lock:
        # Re-check inside the lock: another thread may have just refreshed.
        cached = _cache.jwks
        if not force_refresh and cached is not None and _is_fresh(time.time()):
            return cached

        fetched = _fetch()
        _cache.jwks = fetched
        _cache.fetched_at = time.time()
        return fetched


def reset_cache() -> None:
    """Clear the cache. Intended for tests."""
    with _lock:
        _cache.jwks = None
        _cache.fetched_at = 0.0
