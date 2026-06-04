"""Lightweight auth module — Google OAuth + session JWTs + RBAC.

Deliberately tiny: no Authlib, no FastAPI-Users, no SQLAlchemy. Just httpx +
PyJWT against Google's discovery endpoints. Stores nothing locally; the
session JWT is the only state.
"""

from .google_oauth import router as oauth_router, require_user
from .deps import require_auth, require_permission
from .rbac import AuthContext, Role, Permission, can

__all__ = [
    "oauth_router", "require_user",
    "require_auth", "require_permission",
    "AuthContext", "Role", "Permission", "can",
]
