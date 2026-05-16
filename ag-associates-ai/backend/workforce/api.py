"""Admin Workforce API — roster, capability matrix, live activity feed.

Mounted at /workforce and gated by the same X-Voice-Admin-Key the voice
console uses. Eventually this should move to a proper Supabase JWT + admin
role check; see ARCHITECTURE.md.
"""
from __future__ import annotations

import json
import logging
import os
import secrets
from typing import Any, Dict, List, Optional

import psycopg2
from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from psycopg2.extras import RealDictCursor

from config import get_database_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workforce", tags=["Workforce"])

ADMIN_KEY = os.environ.get("VOICE_ADMIN_KEY", "")


def _verify_admin(
    x_voice_admin_key: Optional[str] = Header(default=None, alias="x-voice-admin-key"),
) -> None:
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail="admin auth not configured")
    if not x_voice_admin_key or not secrets.compare_digest(x_voice_admin_key, ADMIN_KEY):
        raise HTTPException(status_code=401, detail="invalid admin key")


def _query(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with psycopg2.connect(get_database_url()) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def _exec(sql: str, params: tuple = ()) -> None:
    with psycopg2.connect(get_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)


# ----- Roster ------------------------------------------------------------

@router.get("/staff", dependencies=[Depends(_verify_admin)])
def list_staff(kind: Optional[str] = None) -> List[Dict[str, Any]]:
    sql = "SELECT id, kind, display_name, short_name, agent_module, phone, email, state, last_heartbeat, metadata FROM staff"
    params: tuple = ()
    if kind:
        sql += " WHERE kind = %s"
        params = (kind,)
    sql += " ORDER BY kind, display_name"
    return _query(sql, params)


@router.post("/staff", dependencies=[Depends(_verify_admin)])
def upsert_staff(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    required = {"kind", "display_name", "short_name"}
    if not required.issubset(payload):
        raise HTTPException(status_code=400, detail=f"missing fields: {required - set(payload)}")
    if payload["kind"] not in ("agent", "human"):
        raise HTTPException(status_code=400, detail="kind must be 'agent' or 'human'")

    _exec(
        """
        INSERT INTO staff (kind, display_name, short_name, agent_module, phone, email, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (kind, short_name) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               agent_module = EXCLUDED.agent_module,
               phone        = EXCLUDED.phone,
               email        = EXCLUDED.email,
               metadata     = EXCLUDED.metadata,
               updated_at   = now()
        """,
        (
            payload["kind"], payload["display_name"], payload["short_name"],
            payload.get("agent_module"), payload.get("phone"), payload.get("email"),
            json.dumps(payload.get("metadata") or {}),
        ),
    )
    return {"ok": True}


@router.post("/staff/{staff_id}/state", dependencies=[Depends(_verify_admin)])
def set_staff_state(staff_id: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    state = payload.get("state")
    if state not in ("online", "idle", "offline", "disabled"):
        raise HTTPException(status_code=400, detail="invalid state")
    _exec("UPDATE staff SET state = %s, updated_at = now() WHERE id = %s", (state, staff_id))
    return {"ok": True, "staff_id": staff_id, "state": state}


# ----- Capability matrix -------------------------------------------------

@router.get("/capabilities", dependencies=[Depends(_verify_admin)])
def list_capabilities() -> List[Dict[str, Any]]:
    return _query("SELECT code, label, category, risk FROM capability ORDER BY category, code")


@router.get("/matrix", dependencies=[Depends(_verify_admin)])
def capability_matrix() -> Dict[str, Any]:
    staff = _query("SELECT id, kind, display_name, short_name FROM staff ORDER BY kind, display_name")
    caps = _query("SELECT code, label, category, risk FROM capability ORDER BY category, code")
    grants = _query("SELECT staff_id, capability_code, enabled FROM staff_capability")
    granted = {(g["staff_id"], g["capability_code"]): g["enabled"] for g in grants}
    return {
        "staff": staff,
        "capabilities": caps,
        "grants": [
            {"staff_id": s["id"], "capability_code": c["code"],
             "enabled": granted.get((s["id"], c["code"]), False)}
            for s in staff for c in caps
        ],
    }


@router.post("/matrix/grant", dependencies=[Depends(_verify_admin)])
def grant_capability(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    staff_id = payload.get("staff_id")
    code = payload.get("capability_code")
    enabled = bool(payload.get("enabled", True))
    granted_by = payload.get("granted_by", "admin")
    if not staff_id or not code:
        raise HTTPException(status_code=400, detail="staff_id and capability_code required")
    _exec(
        """
        INSERT INTO staff_capability (staff_id, capability_code, enabled, granted_by)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (staff_id, capability_code) DO UPDATE
           SET enabled = EXCLUDED.enabled,
               granted_by = EXCLUDED.granted_by,
               granted_at = now()
        """,
        (staff_id, code, enabled, granted_by),
    )
    return {"ok": True}


# ----- Activity feed -----------------------------------------------------

@router.get("/activity", dependencies=[Depends(_verify_admin)])
def list_activity(
    limit: int = 50,
    staff_id: Optional[str] = None,
    case_id: Optional[str] = None,
    source: Optional[str] = None,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 500))
    where = ["TRUE"]
    params: list = []
    if staff_id:
        where.append("a.staff_id = %s"); params.append(staff_id)
    if case_id:
        where.append("a.case_id = %s"); params.append(case_id)
    if source:
        where.append("a.source = %s"); params.append(source)

    sql = f"""
        SELECT a.id, a.source, a.capability_code, a.case_id, a.summary,
               a.payload, a.status, a.occurred_at,
               s.short_name AS staff_short, s.display_name AS staff_label, s.kind AS staff_kind
          FROM staff_activity a
          LEFT JOIN staff s ON s.id = a.staff_id
         WHERE {' AND '.join(where)}
         ORDER BY a.occurred_at DESC
         LIMIT %s
    """
    params.append(limit)
    return _query(sql, tuple(params))


@router.get("/summary", dependencies=[Depends(_verify_admin)])
def summary() -> Dict[str, Any]:
    """Top-line KPIs for the admin dashboard header."""
    counts = _query(
        """
        SELECT kind, state, COUNT(*) AS n
          FROM staff
         GROUP BY kind, state
        """
    )
    today = _query(
        """
        SELECT source, COUNT(*) AS n
          FROM staff_activity
         WHERE occurred_at > now() - interval '24 hours'
         GROUP BY source
        """
    )
    anomalies = _query(
        """
        SELECT a.staff_id, a.bad_events, a.total_events, s.short_name, s.display_name, s.state
          FROM staff_anomaly_window a
          JOIN staff s ON s.id = a.staff_id
         WHERE a.bad_events >= 3
         ORDER BY a.bad_events DESC
         LIMIT 10
        """
    )
    return {
        "staff_by_state": counts,
        "activity_24h_by_source": today,
        "anomalies": anomalies,
    }


# ----- Case timeline drill-down -----------------------------------------

@router.get("/case/{case_id}/timeline", dependencies=[Depends(_verify_admin)])
def case_timeline(case_id: str, limit: int = 200) -> Dict[str, Any]:
    """Every step taken on a case, across all agentic + human staff."""
    limit = max(1, min(limit, 500))
    rows = _query(
        """
        SELECT a.id, a.source, a.capability_code, a.summary, a.payload, a.status, a.occurred_at,
               s.short_name AS staff_short, s.display_name AS staff_label, s.kind AS staff_kind
          FROM staff_activity a
          LEFT JOIN staff s ON s.id = a.staff_id
         WHERE a.case_id = %s
         ORDER BY a.occurred_at ASC
         LIMIT %s
        """,
        (case_id, limit),
    )
    return {"case_id": case_id, "timeline": rows}


# ----- Tasks -------------------------------------------------------------

@router.post("/tasks/assign", dependencies=[Depends(_verify_admin)])
def assign_task(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    required = {"staff_id", "description"}
    if not required.issubset(payload):
        raise HTTPException(status_code=400, detail=f"missing fields: {required - set(payload)}")
    
    staff_id = payload["staff_id"]
    description = payload["description"]
    priority = payload.get("priority", "med")
    case_id = payload.get("case_id")
    
    # 1. Log the task assignment in the database (staff_activity)
    _exec(
        """
        INSERT INTO staff_activity (staff_id, case_id, summary, status, occurred_at)
        VALUES (%s, %s, %s, %s, now())
        """,
        (staff_id, case_id, f"TASK ASSIGNED: {description}", "pending")
    )
    
    # 2. Trigger Agentic Workflow if staff is an agent
    staff = _query("SELECT kind, short_name, agent_module FROM staff WHERE id = %s", (staff_id,))
    if staff and staff[0]["kind"] == "agent":
        logger.info(f"Triggering agent {staff[0]['short_name']} for task: {description}")
        # Here you would typically dispatch to a celery/redis queue or call the agent directly
        # For now, we'll just log it.
    
    return {"ok": True, "message": f"Task assigned to {staff[0]['display_name'] if staff else 'unknown'}"}

@router.post("/capability/{code}/limit", dependencies=[Depends(_verify_admin)])
def set_capability_limit(code: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    limit = payload.get("per_hour_limit")
    if limit is not None and (not isinstance(limit, int) or limit < 0):
        raise HTTPException(status_code=400, detail="per_hour_limit must be a non-negative integer or null")
    _exec("UPDATE capability SET per_hour_limit = %s WHERE code = %s", (limit, code))
    return {"ok": True, "code": code, "per_hour_limit": limit}
