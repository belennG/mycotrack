"""Authentication package.

Auth0 is used for *identity only*: it issues an RS256 access token that this
package validates on every request. Authorization and multi-tenancy live in our
own database (see issue #70).
"""

from auth.dependencies import (
    bearer_scheme,
    get_current_user,
    get_current_user_optional,
)

__all__ = ["bearer_scheme", "get_current_user", "get_current_user_optional"]
