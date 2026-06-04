"""Human-in-the-Loop (HITL) task queue for RPA circuit breaker fallback.

When a portal circuit breaker trips, pending RPA tasks are persisted here
so human operators can claim, review, and manually execute them. Tasks
expire after 7 days.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class HITLTaskStatus(Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class HITLQueue:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None

    async def _r(self) -> aioredis.Redis:
        if self._redis is None:
            url = os.environ.get("REDIS_URL", "redis://localhost:6379")
            pwd = os.environ.get("REDIS_PASSWORD")
            if pwd:
                url = url.replace("redis://", f"redis://:{pwd}@")
            self._redis = aioredis.from_url(url, decode_responses=True)
        return self._redis

    def _list_key(self) -> str:
        return "hitl:tasks"

    def _task_key(self, task_id: str) -> str:
        return f"hitl:task:{task_id}"

    async def add_task(
        self,
        portal: str,
        case_id: str,
        action: str,
        payload: dict,
        reason: str,
    ) -> dict:
        task = {
            "id": uuid4().hex[:12],
            "portal": portal,
            "case_id": case_id,
            "action": action,
            "payload": json.dumps(payload, default=str),
            "reason": reason,
            "status": HITLTaskStatus.PENDING.value,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "claimed_by": None,
            "claimed_at": None,
            "completed_at": None,
            "notes": None,
        }
        r = await self._r()
        pipeline = r.pipeline()
        pipeline.set(self._task_key(task["id"]), json.dumps(task), ex=86400 * 7)
        pipeline.lpush(self._list_key(), task["id"])
        await pipeline.execute()
        logger.warning("HITL task %s created: %s/%s — %s", task["id"], portal, case_id, reason)
        return task

    async def list_pending(self) -> List[dict]:
        r = await self._r()
        task_ids = await r.lrange(self._list_key(), 0, 99)
        tasks = []
        for tid in task_ids:
            raw = await r.get(self._task_key(tid))
            if raw:
                task = json.loads(raw)
                if task.get("status") in (HITLTaskStatus.PENDING.value, HITLTaskStatus.CLAIMED.value):
                    task["payload"] = json.loads(task["payload"]) if isinstance(task["payload"], str) else task["payload"]
                    tasks.append(task)
        return tasks

    async def claim_task(self, task_id: str, claimed_by: str) -> Optional[dict]:
        r = await self._r()
        raw = await r.get(self._task_key(task_id))
        if not raw:
            return None
        task = json.loads(raw)
        if task["status"] != HITLTaskStatus.PENDING.value:
            return None
        task["status"] = HITLTaskStatus.CLAIMED.value
        task["claimed_by"] = claimed_by
        task["claimed_at"] = datetime.now(timezone.utc).isoformat()
        await r.set(self._task_key(task_id), json.dumps(task), ex=86400 * 7, keepttl=True)
        task["payload"] = json.loads(task["payload"]) if isinstance(task["payload"], str) else task["payload"]
        return task

    async def complete_task(self, task_id: str, notes: str = "") -> Optional[dict]:
        r = await self._r()
        raw = await r.get(self._task_key(task_id))
        if not raw:
            return None
        task = json.loads(raw)
        task["status"] = HITLTaskStatus.COMPLETED.value
        task["completed_at"] = datetime.now(timezone.utc).isoformat()
        task["notes"] = notes
        await r.set(self._task_key(task_id), json.dumps(task), ex=86400, keepttl=True)
        await r.lrem(self._list_key(), 0, task_id)
        task["payload"] = json.loads(task["payload"]) if isinstance(task["payload"], str) else task["payload"]
        return task

    async def fail_task(self, task_id: str, error: str) -> Optional[dict]:
        r = await self._r()
        raw = await r.get(self._task_key(task_id))
        if not raw:
            return None
        task = json.loads(raw)
        task["status"] = HITLTaskStatus.FAILED.value
        task["notes"] = error
        task["completed_at"] = datetime.now(timezone.utc).isoformat()
        await r.set(self._task_key(task_id), json.dumps(task), ex=86400, keepttl=True)
        await r.lrem(self._list_key(), 0, task_id)
        return task


hitl_queue = HITLQueue()
