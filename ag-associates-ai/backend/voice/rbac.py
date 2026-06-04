"""Per-tool RBAC config — lives in Postgres so admins can toggle tools live.

A missing row means "use the static default from the in-process registry".
Toggles are cached for 10 s to keep the hot path fast; admin UI bust via the
``invalidate()`` helper after writes.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional, Tuple

import psycopg2

from config import get_database_url

logger = logging.getLogger(__name__)

_CACHE: Dict[str, Tuple[float, Dict]] = {}
_CACHE_TTL = 10.0  # seconds


def _conn():
    return psycopg2.connect(get_database_url())


def invalidate() -> None:
    _CACHE.clear()


def get_config(tool_name: str) -> Optional[Dict]:
    """Return the current config row for ``tool_name`` or None when unset.

    Result shape: {enabled: bool, risk_override: str|None, allowed_roles: list[str]}.
    """
    now = time.time()
    cached = _CACHE.get(tool_name)
    if cached and (now - cached[0]) < _CACHE_TTL:
        return cached[1]

    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT enabled, risk_override, allowed_roles
                      FROM voice_tool_config
                     WHERE tool_name = %s
                    """,
                    (tool_name,),
                )
                row = cur.fetchone()
                if not row:
                    _CACHE[tool_name] = (now, None)  # type: ignore[assignment]
                    return None
                cfg = {
                    "enabled": bool(row[0]),
                    "risk_override": row[1],
                    "allowed_roles": row[2] or [],
                }
                _CACHE[tool_name] = (now, cfg)
                return cfg
    except Exception as exc:
        logger.warning("rbac lookup failed (fail-closed): %s", exc)
        return {"enabled": False, "risk_override": None, "allowed_roles": []}


def check(tool_name: str, default_risk: str, caller_roles: List[str]) -> Dict:
    """Return decision dict: {allowed, effective_risk, reason}."""
    cfg = get_config(tool_name)
    if cfg is None:
        # No config row → use registry default and let everyone through.
        return {"allowed": True, "effective_risk": default_risk, "reason": "default"}

    if not cfg["enabled"]:
        return {"allowed": False, "effective_risk": default_risk, "reason": "tool disabled by admin"}

    allowed_roles = cfg["allowed_roles"]
    if allowed_roles and not any(r in allowed_roles for r in caller_roles):
        return {
            "allowed": False,
            "effective_risk": default_risk,
            "reason": f"caller roles {caller_roles!r} not in {allowed_roles!r}",
        }

    return {
        "allowed": True,
        "effective_risk": (cfg["risk_override"] or default_risk).lower(),
        "reason": "ok",
    }


def upsert(tool_name: str, enabled: bool, risk_override: Optional[str], allowed_roles: List[str]) -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO voice_tool_config (tool_name, enabled, risk_override, allowed_roles)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (tool_name) DO UPDATE
                   SET enabled = EXCLUDED.enabled,
                       risk_override = EXCLUDED.risk_override,
                       allowed_roles = EXCLUDED.allowed_roles,
                       updated_at = now()
                """,
                (tool_name, enabled, risk_override, allowed_roles),
            )
    invalidate()
