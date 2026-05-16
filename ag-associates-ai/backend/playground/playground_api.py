"""Playground API — admin-driven live browser sessions.

Mounted at /playground. Requires the AG session cookie issued by /auth/login.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException

from auth import require_user

from .browser_session import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/playground", tags=["Playground"])

try:
    from workforce.ledger import record_activity as _record_activity
except Exception:
    def _record_activity(**_kwargs):  # type: ignore
        return None


@router.get("/sessions")
async def list_sessions(user: dict = Depends(require_user)):
    return await session_manager.list()


@router.post("/sessions")
async def create_session(
    payload: Dict[str, Any] = Body(default={}),
    user: dict = Depends(require_user),
):
    label = (payload or {}).get("label", "tab")
    start_url = (payload or {}).get("url")
    session = await session_manager.create(label=label, owner=user["sub"], start_url=start_url)
    _record_activity(
        source="system", staff_kind=None, staff_short_name=None,
        capability_code=None,
        summary=f"{user['sub']} opened playground session {session.id[:8]} → {start_url or 'about:blank'}",
        payload={"session_id": session.id, "url": start_url},
    )
    return {"id": session.id, "label": session.label, "url": start_url}


@router.delete("/sessions/{sid}")
async def kill_session(sid: str, user: dict = Depends(require_user)):
    await session_manager.close(sid)
    return {"ok": True}


@router.post("/sessions/{sid}/action")
async def session_action(
    sid: str,
    payload: Dict[str, Any] = Body(...),
    user: dict = Depends(require_user),
):
    kind = payload.get("kind")
    if not kind:
        raise HTTPException(status_code=400, detail="missing 'kind'")
    args = {k: v for k, v in payload.items() if k != "kind"}
    try:
        result = await session_manager.action(sid, kind, **args)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    return result


@router.get("/sessions/{sid}/screenshot")
async def session_screenshot(sid: str, quality: int = 55, user: dict = Depends(require_user)):
    try:
        b64 = await session_manager.screenshot(sid, quality=quality)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    return {"image": b64, "mime": "image/jpeg"}


@router.get("/sessions/{sid}/history")
async def session_history(sid: str, user: dict = Depends(require_user)):
    try:
        s = await session_manager.get(sid)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    return s.history[-100:]
