"""Validate Auth0 access tokens (RS256, verified against the JWKS)."""

from typing import Any, cast

from joserfc import jwt
from joserfc.errors import (
    ExpiredTokenError,
    InvalidClaimError,
    JoseError,
    MissingClaimError,
)
from joserfc.jwk import KeySet

from auth.config import settings
from auth.jwks import get_jwks

_LEEWAY_SECONDS = 60

# Restrict accepted algorithms explicitly so a token with ``alg: none`` or a
# symmetric algorithm can never be accepted.
_ALGORITHMS = settings.algorithms or ["RS256"]

# Errors that mean "this token is bad" — never worth retrying.
_CLAIM_ERRORS = (ExpiredTokenError, InvalidClaimError, MissingClaimError)


class TokenError(Exception):
    """Raised when an access token is missing, malformed, or invalid."""


class _RetryableKeyError(Exception):
    """Internal: decode failed in a way a fresh JWKS fetch might fix."""


def _claims_registry() -> "jwt.JWTClaimsRegistry":
    return jwt.JWTClaimsRegistry(
        leeway=_LEEWAY_SECONDS,
        iss={"essential": True, "value": settings.issuer},
        aud={"essential": True, "value": settings.api_audience},
        exp={"essential": True},
        sub={"essential": True},
    )


def _decode(token: str, *, force_refresh: bool) -> dict[str, Any]:
    key_set = KeySet.import_key_set(cast(Any, get_jwks(force_refresh=force_refresh)))

    try:
        decoded = jwt.decode(token, key_set, algorithms=_ALGORITHMS)
    except _CLAIM_ERRORS as exc:  # pragma: no cover - decode rarely raises these
        raise TokenError(str(exc)) from exc
    except (JoseError, ValueError, KeyError) as exc:
        # Bad signature or unknown ``kid`` — worth one retry with a fresh JWKS.
        raise _RetryableKeyError(str(exc)) from exc

    try:
        _claims_registry().validate(decoded.claims)
    except _CLAIM_ERRORS as exc:
        raise TokenError(str(exc)) from exc
    except JoseError as exc:
        raise TokenError(str(exc)) from exc

    return dict(decoded.claims)


def verify_token(token: str) -> dict[str, Any]:
    """Return the validated claims for *token*, or raise :class:`TokenError`.

    Checks the RS256 signature against Auth0's JWKS and validates ``iss``,
    ``aud``, ``sub`` and ``exp``. On a signing-key miss the JWKS is refetched
    once (handles key rotation).
    """
    if not settings.is_configured:
        raise TokenError("Authentication is not configured on the server")
    if not token:
        raise TokenError("Missing bearer token")

    try:
        return _decode(token, force_refresh=False)
    except _RetryableKeyError:
        pass

    try:
        return _decode(token, force_refresh=True)
    except _RetryableKeyError as exc:
        raise TokenError(f"Could not validate token signature ({exc})") from exc
