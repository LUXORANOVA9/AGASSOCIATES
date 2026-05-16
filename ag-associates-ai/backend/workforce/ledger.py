"""Append-only writer for `staff_activity` + `staff.last_heartbeat`.

Used by both agent code (LangGraph nodes, Executor, Accountant) and the
voice/mobile inbound handlers. Best-effort: a logging failure never blocks
the operation it's logging.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import psycopg2

from config import get_database_url

logger = logging.getLogger(__name__)


def _conn():
    return psycopg2.connect(get_database_url())


def _resolve_staff_id(kind: str, short_name: str) -> Optional[str]:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM staff WHERE kind = %s AND short_name = %s",
                    (kind, short_name),
                )
                row = cur.fetchone()
                return str(row[0]) if row else None
    except Exception as exc:
        logger.warning("staff lookup failed: %s", exc)
        return None


def record_activity(
    *,
    source: str,                       # 'agent' | 'human' | 'voice' | 'system'
    staff_short_name: Optional[str],   # 'aisha', 'suresh', None for system
    staff_kind: Optional[str] = None,  # required when short_name set
    capability_code: Optional[str] = None,
    case_id: Optional[str] = None,
    summary: str = "",
    payload: Optional[Dict[str, Any]] = None,
    status: str = "ok",
    org_id: Optional[str] = None,
) -> None:
    staff_id = None
    if staff_short_name and staff_kind:
        staff_id = _resolve_staff_id(staff_kind, staff_short_name)

    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO staff_activity
                        (staff_id, source, capability_code, case_id, summary, payload, status, org_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (staff_id, source, capability_code, case_id, summary,
                     json.dumps(payload or {}), status, org_id),
                )
                # Touch the staff heartbeat so the admin panel shows them as online.
                if staff_id and status == "ok":
                    cur.execute(
                        "UPDATE staff SET last_heartbeat = %s, state = 'online' WHERE id = %s AND state <> 'disabled'",
                        (datetime.now(timezone.utc), staff_id),
                    )
    except Exception as exc:
        logger.warning("activity insert failed: %s", exc)

    # On bad events run the anomaly check (best-effort).
    if status in ("error", "warn") and staff_id:
        try:
            from .anomaly import check_and_disable
            check_and_disable(staff_id)
        except Exception as exc:
            logger.warning("anomaly check call failed: %s", exc)


def heartbeat(staff_kind: str, short_name: str, state: str = "online") -> None:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE staff
                       SET last_heartbeat = %s,
                           state = %s,
                           updated_at = now()
                     WHERE kind = %s AND short_name = %s
                    """,
                    (datetime.now(timezone.utc), state, staff_kind, short_name),
                )
    except Exception as exc:
        logger.warning("heartbeat update failed: %s", exc)
