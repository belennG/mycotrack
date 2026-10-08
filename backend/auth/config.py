"""Auth0 configuration, read from the environment.

Mirrors the plain ``os.getenv`` style used in ``database.py`` rather than
introducing pydantic-settings for a handful of values.
"""

import os

from dotenv import load_dotenv

# main.py imports the routers (and therefore this module) before it calls load_dotenv(), so
# load the .env file here, like database.py does, or AUTH0_* would be read as empty.
load_dotenv()


class AuthSettings:
    """Resolved Auth0 settings for token validation."""

    def __init__(self) -> None:
        self.domain: str = os.getenv("AUTH0_DOMAIN", "").strip()
        self.api_audience: str = os.getenv("AUTH0_API_AUDIENCE", "").strip()

        # Auth0's issuer is always ``https://<domain>/`` (trailing slash); allow
        # an explicit override for custom domains.
        self.issuer: str = os.getenv("AUTH0_ISSUER", "").strip() or (
            f"https://{self.domain}/" if self.domain else ""
        )

        self.algorithms: list[str] = [
            alg.strip()
            for alg in os.getenv("AUTH0_ALGORITHMS", "RS256").split(",")
            if alg.strip()
        ]

        # Namespace for custom claims added by the Auth0 post-login Action.
        # Access tokens do not carry profile fields (email/name/picture) unless
        # an Action copies them in under a non-Auth0 namespace.
        self.claim_namespace: str = os.getenv(
            "AUTH0_CLAIM_NAMESPACE", "https://mycotrack.app/"
        )

        # How long a fetched JWKS document is trusted before a refetch.
        self.jwks_cache_seconds: int = int(
            os.getenv("AUTH0_JWKS_CACHE_SECONDS", "3600")
        )

    @property
    def jwks_url(self) -> str:
        return f"https://{self.domain}/.well-known/jwks.json" if self.domain else ""

    @property
    def is_configured(self) -> bool:
        """True when enough is set to validate tokens."""
        return bool(self.domain and self.api_audience)

    def claim(self, name: str) -> str:
        """Full key for a namespaced custom claim, e.g. ``email``."""
        return f"{self.claim_namespace}{name}"


settings = AuthSettings()
