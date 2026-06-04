"""Google OAuth 2.0 — authorization-code flow with PKCE-less compact path.

Endpoints:
    GET /auth/login                 → redirects to Google's consent screen
    GET /auth/google/callback       → exchanges code, mints a session JWT,
                                       sets it as a Secure HttpOnly cookie,
                                       redirects to the office UI
    POST /auth/logout               → clears the cookie
    GET /auth/me                    → echo current user from the cookie

Env:
    GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET
    GOOGLE_REDIRECT_URI             e.g. https://api.luxor9/auth/google/callback
    AG_SESSION_SECRET               JWT signing secret (≥32 random bytes)
    AG_OFFICE_URL                   e.g. https://app.luxor9/office
    AG_ALLOWED_EMAIL_DOMAINS        comma list, e.g. "luxoranova.com,agassociates.in"
                                    Leave unset to allow any Google account.
"""
from __future__ import annotations

import os
import secrets
import time
from typing import Optional
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
AG_SESSION_SECRET = os.environ.get("AG_SESSION_SECRET", "dev-only-change-me")
AG_OFFICE_URL = os.environ.get("AG_OFFICE_URL", "http://localhost:3000/office")
SESSION_TTL_SECONDS = 60 * 60 * 12  # 12-hour day
COOKIE_NAME = "ag_session"

_ALLOWED_DOMAINS = [d.strip().lower() for d in os.environ.get("AG_ALLOWED_EMAIL_DOMAINS", "").split(",") if d.strip()]


IS_PRODUCTION = os.environ.get("ENVIRONMENT") == "production"

def _mint_session(email: str, name: str, picture: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": email, "name": name, "picture": picture, "iat": now, "exp": now + SESSION_TTL_SECONDS},
        AG_SESSION_SECRET,
        algorithm="HS256",
    )


def _decode_session(token: str) -> dict:
    return jwt.decode(token, AG_SESSION_SECRET, algorithms=["HS256"])


def require_user(ag_session: Optional[str] = Cookie(default=None)) -> dict:
    """FastAPI dependency — returns the signed-in user or raises 401."""
    if not ag_session:
        raise HTTPException(status_code=401, detail="not signed in")
    try:
        return _decode_session(ag_session)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"invalid session: {exc}")


@router.get("/login")
async def login(request: Request) -> RedirectResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    resp = RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")
    resp.set_cookie("ag_oauth_state", state, max_age=600, httponly=True, secure=IS_PRODUCTION, samesite="lax")
    return resp


@router.get("/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    ag_oauth_state: Optional[str] = Cookie(default=None),
):
    if error:
        raise HTTPException(status_code=400, detail=f"oauth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="missing code")
    if not ag_oauth_state or not state or not secrets.compare_digest(state, ag_oauth_state):
        raise HTTPException(status_code=400, detail="state mismatch (CSRF)")

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"token exchange failed: {token_resp.text}")
        access_token = token_resp.json().get("access_token")

        userinfo = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo.status_code != 200:
            raise HTTPException(status_code=400, detail="userinfo failed")
        u = userinfo.json()

    email = (u.get("email") or "").lower()
    if _ALLOWED_DOMAINS:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain not in _ALLOWED_DOMAINS:
            raise HTTPException(status_code=403, detail=f"domain {domain!r} not allowed")

    session = _mint_session(email, u.get("name", ""), u.get("picture", ""))
    resp = RedirectResponse(url=AG_OFFICE_URL)
    resp.set_cookie(
        COOKIE_NAME, session,
        max_age=SESSION_TTL_SECONDS,
        httponly=True, secure=IS_PRODUCTION, samesite="lax",
    )
    resp.delete_cookie("ag_oauth_state")
    return resp


@router.post("/logout")
async def logout() -> JSONResponse:
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE_NAME)
    return resp


@router.get("/me")
async def me(user: dict = Depends(require_user)) -> dict:
    return {"email": user["sub"], "name": user.get("name"), "picture": user.get("picture")}
