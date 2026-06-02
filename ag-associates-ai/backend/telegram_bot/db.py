import os
import psycopg2
import psycopg2.pool
from contextlib import contextmanager

DATABASE_HOST = os.environ.get("DATABASE_HOST", "postgres")
DATABASE_PORT = int(os.environ.get("DATABASE_PORT", "5432"))
DATABASE_NAME = os.environ.get("DATABASE_NAME", "agdb")
DATABASE_USER = os.environ.get("POSTGRES_USER", "agadmin")
DATABASE_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")

_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        dsn = f"host={DATABASE_HOST} port={DATABASE_PORT} dbname={DATABASE_NAME} user={DATABASE_USER} password={DATABASE_PASSWORD}"
        _pool = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=dsn)
    return _pool


@contextmanager
def get_conn():
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


# ── Cases ────────────────────────────────────────────────────────────────

def create_case(client_name: str, description: str = "", client_contact: str = "", telegram_group_id: int = 0) -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO noi_cases (client_name, description, client_contact, telegram_group_id, status)
                   VALUES (%s, %s, %s, %s, 'intake')
                   RETURNING id, client_name, status, created_at""",
                (client_name, description, client_contact, telegram_group_id or None),
            )
            row = cur.fetchone()
            return {"id": str(row[0]), "client_name": row[1], "status": row[2], "created_at": row[3].isoformat()}


def list_cases(status: str = None) -> list:
    with get_conn() as conn:
        with conn.cursor() as cur:
            if status:
                cur.execute("SELECT id, client_name, status, created_at FROM noi_cases WHERE status = %s ORDER BY created_at DESC LIMIT 20", (status,))
            else:
                cur.execute("SELECT id, client_name, status, created_at FROM noi_cases ORDER BY created_at DESC LIMIT 20")
            return [{"id": str(r[0]), "client_name": r[1], "status": r[2], "created_at": r[3].isoformat()} for r in cur.fetchall()]


def get_case(case_id: str) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, client_name, client_contact, description, property_details, status, telegram_group_id, created_at, updated_at FROM noi_cases WHERE id = %s", (case_id,))
            r = cur.fetchone()
            if not r:
                return None
            return {
                "id": str(r[0]), "client_name": r[1], "client_contact": r[2] or "",
                "description": r[3] or "", "property_details": r[4] or {},
                "status": r[5], "telegram_group_id": r[6],
                "created_at": r[7].isoformat(), "updated_at": r[8].isoformat(),
            }


def update_case_status(case_id: str, status: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE noi_cases SET status = %s WHERE id = %s", (status, case_id))
            return cur.rowcount > 0


# ── Tasks ────────────────────────────────────────────────────────────────

def create_task(case_id: str, agent: str, task_type: str, payload: dict = None) -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO noi_tasks (case_id, agent, task_type, status, payload)
                   VALUES (%s, %s, %s, 'pending', %s)
                   RETURNING id, case_id, agent, task_type, status""",
                (case_id, agent, task_type, json.dumps(payload) if payload else '{}'),
            )
            r = cur.fetchone()
            return {"id": str(r[0]), "case_id": str(r[1]), "agent": r[2], "task_type": r[3], "status": r[4]}


def list_tasks(case_id: str) -> list:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, agent, task_type, status, created_at, completed_at FROM noi_tasks WHERE case_id = %s ORDER BY created_at",
                (case_id,),
            )
            return [{"id": str(r[0]), "agent": r[1], "task_type": r[2], "status": r[3], "created_at": r[4].isoformat(), "completed_at": r[5].isoformat() if r[5] else None} for r in cur.fetchall()]


def update_task_status(task_id: str, status: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE noi_tasks SET status = %s WHERE id = %s", (status, task_id))
            return cur.rowcount > 0


# ── Challans ─────────────────────────────────────────────────────────────

def create_challan(case_id: str, amount: float, description: str = "") -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO challans (case_id, amount, description, status)
                   VALUES (%s, %s, %s, 'pending')
                   RETURNING id, amount, status""",
                (case_id, amount, description),
            )
            r = cur.fetchone()
            return {"id": str(r[0]), "amount": float(r[1]), "status": r[2]}


def list_challans(case_id: str) -> list:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, amount, description, status, created_at FROM challans WHERE case_id = %s ORDER BY created_at", (case_id,))
            return [{"id": str(r[0]), "amount": float(r[1]), "description": r[2] or "", "status": r[3], "created_at": r[4].isoformat()} for r in cur.fetchall()]


def approve_challan(challan_id: str, approved_by: str = "") -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE challans SET status = 'approved', approved_by = %s WHERE id = %s", (approved_by, challan_id))
            return cur.rowcount > 0


import json
