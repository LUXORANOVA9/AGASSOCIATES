"""Lightweight auth module — Google OAuth + session JWTs.

Deliberately tiny: no Authlib, no FastAPI-Users, no SQLAlchemy. Just httpx +
PyJWT against Google's discovery endpoints. Stores nothing locally; the
session JWT is the only state.
"""

from .google_oauth import router as oauth_router, require_user

__all__ = ["oauth_router", "require_user"]
