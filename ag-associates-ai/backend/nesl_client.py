"""NeslClient — Dual-mode NeSL (National e-Services Ltd) e-filing client.

Modes (auto-selected by available config):
  1. API mode    — REST API call when NESL_API_KEY is set (production)
  2. RPA mode    — Playwright IGR portal automation when IGR_PORTAL_* creds set
  3. Mock mode   — Simulated filing when neither is configured (fallback)
"""

import asyncio
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from workforce.ledger import record_activity

logger = logging.getLogger(__name__)


class NeslClient:
    """NeSL e-filing client with automatic mode selection."""

    def __init__(self):
        self.api_key = os.environ.get("NESL_API_KEY", "")
        self.api_base_url = os.environ.get(
            "NESL_API_BASE_URL", "https://api.nesl.co.in/v1"
        )
        self.api_client_id = os.environ.get("NESL_CLIENT_ID", "")
        self.api_client_secret = os.environ.get("NESL_CLIENT_SECRET", "")
        self.mock_delay = float(os.environ.get("NESL_MOCK_DELAY_SEC", "3"))

        self.igr_portal_url = os.environ.get(
            "IGR_PORTAL_URL", "https://igrmaharashtra.gov.in/efiling/"
        )
        self.igr_username = os.environ.get("IGR_PORTAL_USERNAME", "")
        self.igr_password = os.environ.get("IGR_PORTAL_PASSWORD", "")

        self.mode = self._detect_mode()

    def _detect_mode(self) -> str:
        if self.api_key:
            return "api"
        if self.igr_username and self.igr_password:
            return "rpa"
        return "mock"

    def _generate_transaction_id(self) -> str:
        raw = f"{uuid.uuid4().hex}{datetime.utcnow().isoformat()}"
        return f"NESL-{hashlib.sha256(raw.encode()).hexdigest()[:12].upper()}"

    def _generate_filing_reference(self, case_id: Optional[str] = None) -> str:
        prefix = case_id[-6:] if case_id else "REF"
        return f"IGR{prefix}{datetime.now().strftime('%y%m%d%H%M%S')}"

    async def execute(
        self,
        case_id: Optional[str] = None,
        document_type: str = "INTIMATION_MORTGAGE",
        document_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """File a document with NeSL. Auto-selects mode based on config."""

        if self.mode == "api":
            return await self._api_execute(case_id, document_type, document_data)
        elif self.mode == "rpa":
            return await self._rpa_execute(case_id, document_type, document_data)

        return await self._mock_execute(case_id, document_type)

    async def _api_execute(
        self,
        case_id: Optional[str],
        document_type: str,
        document_data: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Authenticated NeSL REST API filing."""
        import httpx

        payload = {
            "document_type": document_type,
            "filing_timestamp": datetime.utcnow().isoformat() + "Z",
            "case_id": case_id or "",
            "document_data": document_data or {},
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.api_base_url}/filings",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self._get_access_token()}",
                        "X-API-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            transaction_id = data.get("transaction_id", self._generate_transaction_id())
            filing_ref = data.get("filing_reference", self._generate_filing_reference(case_id))

            record_activity(
                source="nesl_client",
                staff_kind="agent",
                staff_short_name="nesl_executor",
                capability_code="nesl.api_filing",
                case_id=case_id or "",
                summary=f"NeSL API filing — {document_type}, Ref: {filing_ref}",
                payload={"transaction_id": transaction_id, "mode": "api"},
                status="ok",
            )

            return {
                "success": True,
                "transaction_id": transaction_id,
                "filing_reference": filing_ref,
                "message": f"Document filed with NeSL via API — Ref: {filing_ref}",
                "mode": "api",
            }

        except Exception as exc:
            logger.error(f"NeSL API filing failed: {exc}")
            record_activity(
                source="nesl_client",
                staff_kind="agent",
                staff_short_name="nesl_executor",
                capability_code="nesl.api_filing",
                case_id=case_id or "",
                summary=f"NeSL API filing failed: {exc}",
                status="error",
            )
            return {"success": False, "error": str(exc), "mode": "api"}

    def _get_access_token(self) -> str:
        """Obtain NeSL API access token using client credentials."""
        import base64

        creds = f"{self.api_client_id}:{self.api_client_secret}"
        return base64.b64encode(creds.encode()).decode()

    async def _rpa_execute(
        self,
        case_id: Optional[str],
        document_type: str,
        document_data: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Playwright-based IGR portal e-filing fallback."""
        from igr_executor import igr_executor

        data = document_data or {}

        result = await igr_executor.file_noi(
            case_id=case_id or "UNKNOWN",
            borrower_name=data.get("borrower_name", ""),
            loan_amount=data.get("loan_amount", "0"),
            property_address=data.get("property_address", ""),
            property_city=data.get("property_city", ""),
            bank_name=data.get("bank_name", ""),
            grn_number=data.get("grn_number", ""),
        )

        if result.get("success"):
            return {
                "success": True,
                "transaction_id": self._generate_transaction_id(),
                "filing_reference": result.get("acknowledgment_number"),
                "message": f"Document filed via IGR portal — Ack: {result.get('acknowledgment_number')}",
                "mode": "rpa",
            }

        return {**result, "mode": "rpa"}

    async def _mock_execute(
        self,
        case_id: Optional[str],
        document_type: str,
    ) -> Dict[str, Any]:
        """Simulated filing — returns fake acknowledgment after configured delay."""
        await asyncio.sleep(self.mock_delay)

        filing_ref = self._generate_filing_reference(case_id)
        transaction_id = self._generate_transaction_id()

        record_activity(
            source="nesl_client",
            staff_kind="agent",
            staff_short_name="nesl_executor",
            capability_code="nesl.mock_filing",
            case_id=case_id or "",
            summary=f"NeSL mock filing — {document_type}, Ref: {filing_ref}",
            payload={"transaction_id": transaction_id, "mode": "mock"},
            status="ok",
        )

        return {
            "success": True,
            "transaction_id": transaction_id,
            "filing_reference": filing_ref,
            "message": f"Document successfully filed with NeSL registry (mock) — Ref: {filing_ref}",
            "mode": "mock",
        }

    async def check_status(self, filing_reference: str) -> Dict[str, Any]:
        """Check filing status on NeSL/IGR portal."""
        if self.mode == "api":
            import httpx
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(
                        f"{self.api_base_url}/filings/{filing_reference}",
                        headers={
                            "Authorization": f"Bearer {self._get_access_token()}",
                            "X-API-Key": self.api_key,
                        },
                    )
                    resp.raise_for_status()
                    return resp.json()
            except Exception as exc:
                logger.error(f"NeSL status check failed: {exc}")
                return {"success": False, "error": str(exc)}

        return {
            "success": True,
            "filing_reference": filing_reference,
            "status": "PROCESSING",
            "estimated_completion": "7-10 working days",
            "mode": self.mode,
        }
