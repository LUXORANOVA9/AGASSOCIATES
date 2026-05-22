"""NOIAgent — Orchestrates the full Notice of Intimation workflow.

Connects Aisha → RPA → OTP Bridge → Case DB → Notifications.

NOI States: DOCUMENTS_RECEIVED → CHALLAN_GENERATED → CHALLAN_PAID → VERIFIED
            → NOI_DROP_RECEIVED → RECTIFY → NOI_FILED → ACKNOWLEDGED → COMPLETED
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from workforce.ledger import record_activity

logger = logging.getLogger(__name__)

NOI_STATES = [
    "DOCUMENTS_RECEIVED",
    "CHALLAN_GENERATED",
    "CHALLAN_PAID",
    "VERIFIED",
    "NOI_DROP_RECEIVED",
    "NOI_FILED",
    "ACKNOWLEDGED",
    "COMPLETED",
]

NOI_EXCEPTION_STATES = ["MISMATCH", "REJECTED"]


NOI_REDIS_PREFIX = "noi:case:"

class NOIAgent:
    """Orchestrates the NOI workflow across RPA executors, OTP bridge,
    case database, and notification dispatch."""

    def __init__(self):
        self._redis = None
        self._local_cases: Dict[str, Dict[str, Any]] = {}

    def _use_local_store(self) -> bool:
        """Returns True if Supabase is not configured (fallback to Redis/in-memory)."""
        return not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    async def _get_redis(self):
        if self._redis is None:
            import redis.asyncio as aioredis
            url = os.environ.get("REDIS_URL", "redis://localhost:6379")
            password = os.environ.get("REDIS_PASSWORD", "")
            if password and "redis://" in url:
                url = url.replace("redis://", f"redis://:{password}@")
            self._redis = aioredis.from_url(url, decode_responses=True)
        return self._redis

    async def _local_get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Read case from Redis hash (shared across workers), fallback to in-memory."""
        try:
            r = await self._get_redis()
            raw = await r.hgetall(f"{NOI_REDIS_PREFIX}{case_id}")
            if raw:
                return {k: v for k, v in raw.items()}
        except Exception:
            pass
        return self._local_cases.get(case_id)

    async def _local_set_case(self, case_id: str, data: Dict[str, Any]) -> bool:
        """Write case to Redis hash (shared across workers), also update in-memory."""
        self._local_cases[case_id] = data
        try:
            r = await self._get_redis()
            await r.hset(f"{NOI_REDIS_PREFIX}{case_id}", mapping=data)
            return True
        except Exception:
            return True

    async def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Fetch case details from Supabase (or Redis/in-memory fallback)."""
        if self._use_local_store():
            return await self._local_get_case(case_id)

        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{supabase_url}/rest/v1/cases?id=eq.{case_id}",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data[0] if isinstance(data, list) and data else None
        except Exception as exc:
            logger.warning("Failed to fetch case %s: %s", case_id, exc)
            return None

    async def update_noi_status(
        self, case_id: str, new_status: str, notes: Optional[str] = None
    ) -> bool:
        """Update the NOI status of a case in Supabase + record timeline."""
        if self._use_local_store():
            case = await self._local_get_case(case_id)
            if case:
                case["noi_status"] = new_status
                case["updated_at"] = datetime.utcnow().isoformat()
                await self._local_set_case(case_id, case)
                logger.info("Local status update: %s → %s (%s)", case_id, new_status, notes or "")
                return True
            return False

        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.patch(
                    f"{supabase_url}/rest/v1/cases?id=eq.{case_id}",
                    json={
                        "noi_status": new_status,
                        "updated_at": datetime.utcnow().isoformat(),
                    },
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    },
                )
                resp.raise_for_status()

            await self._log_timeline(case_id, "noi_status", new_status, notes)

            record_activity(
                source="noi_agent",
                staff_kind="agent",
                staff_short_name="noi_agent",
                capability_code="noi.status_update",
                case_id=case_id,
                summary=f"NOI status → {new_status}",
                payload={"notes": notes},
                status="ok",
            )
            return True
        except Exception as exc:
            logger.error("Failed to update NOI status for %s: %s", case_id, exc)
            return False

    async def seed_test_case(self, case_data: Dict[str, Any]) -> str:
        """Seed a test case in Redis (shared across workers) for development/testing.
        Returns the case_id. Only works when Supabase is not configured."""
        case_id = case_data.get("case_id", f"TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
        case = {
            "id": case_id,
            "case_id": case_id,
            "noi_status": "DOCUMENTS_RECEIVED",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "borrower_name": case_data.get("borrower_name", "Test Borrower"),
            "bank_name": case_data.get("bank_name", "Test Bank"),
            "loan_amount": case_data.get("loan_amount", "500000"),
            "property_address": case_data.get("property_address", "123 Test Street, Mumbai"),
            "property_city": case_data.get("property_city", "Mumbai"),
            "grn_number": case_data.get("grn_number", ""),
            "acknowledgment_number": case_data.get("acknowledgment_number", ""),
        }
        await self._local_set_case(case_id, case)
        logger.info("Seeded test case: %s", case_id)
        return case_id

    async def _log_timeline(self, case_id: str, field: str, new_value: str, notes: Optional[str] = None):
        """Append to case_timeline table."""
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not supabase_url or not supabase_key:
            return

        import httpx
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{supabase_url}/rest/v1/case_timeline",
                    json={
                        "case_id": case_id,
                        "field": field,
                        "new_value": new_value,
                        "notes": notes or "",
                        "changed_by": "noi_agent",
                    },
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                    },
                )
        except Exception as exc:
            logger.warning("Timeline log failed: %s", exc)

    async def generate_challan(self, case_id: str) -> Dict[str, Any]:
        """Step 1: Generate GRAS challan for the NOI case.
        Returns challan details including GRN."""
        case = await self.get_case(case_id)
        if not case:
            return {"success": False, "error": f"Case {case_id} not found"}

        try:
            from executor_agent import executor_agent

            loan_amount_str = case.get("loan_amount", "0")
            bank_name = case.get("bank_name", "Unknown")
            borrower = case.get("borrower_name", "Unknown")

            result = await executor_agent.generate_noi_challan(
                case_id=case_id,
                loan_amount=loan_amount_str,
                borrower_name=borrower,
                bank_name=bank_name,
                property_address=case.get("property_address", ""),
            )

            if result.get("success"):
                await self.update_noi_status(
                    case_id, "CHALLAN_GENERATED",
                    notes=f"GRN: {result.get('grn_number')}, Amount: ₹{result.get('amount_paid')}",
                )
                await self._notify(
                    case_id, "CHALLAN_GENERATED",
                    f"Challan generated for {borrower} — GRN: {result.get('grn_number')}, "
                    f"Amount: ₹{result.get('amount_paid')}. Bank to pay and send NOI drop."
                )

            return result
        except Exception as exc:
            logger.error("Challan generation failed for %s: %s", case_id, exc)
            return {"success": False, "error": str(exc)}

    async def verify_documents(self, case_id: str) -> Dict[str, Any]:
        """Step 2: Verify documents against NOI checklist."""
        case = await self.get_case(case_id)
        if not case:
            return {"success": False, "error": f"Case {case_id} not found"}

        checklist = [
            "sanction_letter",
            "borrower_kyc",
            "property_docs",
            "stamp_duty_receipt",
        ]

        results = {}
        all_present = True
        for doc in checklist:
            doc_status = await self._check_document(case_id, doc)
            results[doc] = doc_status
            if doc_status != "PRESENT":
                all_present = False

        if all_present:
            await self.update_noi_status(case_id, "VERIFIED", notes="All documents verified")

        return {
            "success": all_present,
            "documents": results,
            "missing": [k for k, v in results.items() if v != "PRESENT"],
        }

    async def _check_document(self, case_id: str, doc_type: str) -> str:
        """Check if a required document exists for this case.
        Returns PRESENT, MISSING, or UNCLEAR."""
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not supabase_url or not supabase_key:
            return "UNCLEAR"

        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{supabase_url}/rest/v1/documents",
                    params={
                        "case_id": f"eq.{case_id}",
                        "document_type": f"eq.{doc_type}",
                        "select": "id,file_path,verification_status",
                    },
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                    },
                )
                resp.raise_for_status()
                docs = resp.json()
                if not docs:
                    return "MISSING"
                for doc in docs:
                    if doc.get("verification_status") == "VERIFIED":
                        return "PRESENT"
                return "UNCLEAR"
        except Exception:
            return "UNCLEAR"

    async def file_noi(self, case_id: str) -> Dict[str, Any]:
        """Step 3: File NOI on IGR portal.
        Requires: challan paid, NOI drop received from bank."""
        case = await self.get_case(case_id)
        if not case:
            return {"success": False, "error": f"Case {case_id} not found"}

        noi_status = case.get("noi_status", "")
        if noi_status not in ("NOI_DROP_RECEIVED", "CHALLAN_PAID", "VERIFIED"):
            return {
                "success": False,
                "error": f"Cannot file NOI — current status is {noi_status}. "
                         f"Requires CHALLAN_PAID, VERIFIED, or NOI_DROP_RECEIVED.",
            }

        try:
            from igr_executor import igr_executor

            result = await igr_executor.file_noi(
                case_id=case_id,
                borrower_name=case.get("borrower_name", ""),
                loan_amount=case.get("loan_amount", "0"),
                property_address=case.get("property_address", ""),
                property_city=case.get("property_city", ""),
                bank_name=case.get("bank_name", ""),
                grn_number=case.get("grn_number", ""),
            )

            if result.get("success"):
                await self.update_noi_status(
                    case_id, "NOI_FILED",
                    notes=f"Acknowledgment: {result.get('acknowledgment_number')}",
                )
                await self._notify(
                    case_id, "NOI_FILED",
                    f"NOI filed successfully for {case.get('borrower_name')} — "
                    f"Acknowledgment: {result.get('acknowledgment_number')}",
                )

            return result
        except Exception as exc:
            logger.error("NOI filing failed for %s: %s", case_id, exc)
            return {"success": False, "error": str(exc)}

    async def acknowledge(self, case_id: str, acknowledgment_number: str) -> Dict[str, Any]:
        """Step 4: Mark NOI as acknowledged and case as completed."""
        success = await self.update_noi_status(
            case_id, "ACKNOWLEDGED",
            notes=f"Acknowledgment: {acknowledgment_number}",
        )
        if success:
            await self._notify(
                case_id, "ACKNOWLEDGED",
                f"NOI acknowledged — Acknowledgment #{acknowledgment_number}. Case completed.",
            )
        return {"success": success}

    async def _notify(self, case_id: str, event: str, message: str):
        """Dispatch notification via AutoComms."""
        try:
            from auto_comms import dispatcher
            await dispatcher.dispatch(case_id, event, message)
        except Exception as exc:
            logger.warning("Notification dispatch failed: %s", exc)

    async def run_workflow(self, case_id: str, action: str, **kwargs) -> Dict[str, Any]:
        """Run a specific NOI workflow action.
        Actions: generate_challan, verify_docs, file_noi, acknowledge, status"""
        action_map = {
            "generate_challan": self.generate_challan,
            "verify_docs": self.verify_documents,
            "file_noi": self.file_noi,
            "acknowledge": self.acknowledge,
        }

        handler = action_map.get(action)
        if not handler:
            return {"success": False, "error": f"Unknown NOI action: {action}"}

        if action == "acknowledge":
            return await handler(case_id, kwargs.get("acknowledgment_number", ""))

        return await handler(case_id)


noi_agent = NOIAgent()
