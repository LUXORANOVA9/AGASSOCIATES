"""IgrRpaExecutor — Playwright automation for Maharashtra IGR e-filing portal.

Files Notice of Intimation (NOI) under Section 89B of the Registration Act, 1908.
Requires: paid challan (GRN), borrower/property details, bank NOI drop confirmation.

All DOM selectors are configurable via env vars prefixed with IGR_SEL_ so the
automation can adapt to portal changes without code modifications.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from playwright.async_api import async_playwright

from workforce.ledger import record_activity

logger = logging.getLogger(__name__)


class IgrRpaExecutor:
    """Automates NOI filing on the IGR Maharashtra e-filing portal.

    Flow:
      1. Navigate to IGR portal → login/OTP
      2. Fill NOI form (borrower, property, loan, bank details)
      3. Upload documents (sanction letter, KYC, property docs, challan receipt)
      4. Submit → capture acknowledgment number

    All Playwright selectors are read from env vars (IGR_SEL_*) with sensible
    defaults for the current IGR Maharashtra portal DOM. Override any selector
    in production .env without touching code.
    """

    def __init__(self):
        self.portal_url = os.environ.get(
            "IGR_PORTAL_URL",
            "https://igrmaharashtra.gov.in/efiling/",
        )
        self.portal_username = os.environ.get("IGR_PORTAL_USERNAME", "")
        self.portal_password = os.environ.get("IGR_PORTAL_PASSWORD", "")

        self._load_selectors()

    def _load_selectors(self):
        """Load Playwright selectors from env vars with production defaults."""
        self.sel = {
            # Login
            "username_input": os.environ.get("IGR_SEL_USERNAME", "input[name='username']"),
            "password_input": os.environ.get("IGR_SEL_PASSWORD", "input[name='password']"),
            "login_button": os.environ.get("IGR_SEL_LOGIN_BTN", "button[type='submit']"),
            "otp_input": os.environ.get("IGR_SEL_OTP", "input[id='otp']"),
            "otp_verify_button": os.environ.get("IGR_SEL_OTP_VERIFY", "button[id='verify']"),
            "dashboard_indicator": os.environ.get("IGR_SEL_DASHBOARD", "text=Dashboard"),
            # NOI filing
            "file_noi_link": os.environ.get("IGR_SEL_FILE_NOI", "text=File Intimation Mortgage"),
            "noi_form": os.environ.get("IGR_SEL_NOI_FORM", "form#noi-form"),
            "borrower_name_input": os.environ.get("IGR_SEL_BORROWER", "input[name='borrower_name']"),
            "loan_amount_input": os.environ.get("IGR_SEL_LOAN_AMOUNT", "input[name='loan_amount']"),
            "property_address_input": os.environ.get("IGR_SEL_PROP_ADDR", "input[name='property_address']"),
            "property_city_input": os.environ.get("IGR_SEL_PROP_CITY", "input[name='property_city']"),
            "bank_name_input": os.environ.get("IGR_SEL_BANK_NAME", "input[name='bank_name']"),
            "grn_input": os.environ.get("IGR_SEL_GRN", "input[name='grn_number']"),
            "sanction_letter_upload": os.environ.get("IGR_SEL_SANCTION_UPLOAD", "input[name='sanction_letter']"),
            "borrower_kyc_upload": os.environ.get("IGR_SEL_KYC_UPLOAD", "input[name='borrower_kyc']"),
            "stamp_duty_upload": os.environ.get("IGR_SEL_STAMP_UPLOAD", "input[name='stamp_duty_receipt']"),
            "submit_button": os.environ.get("IGR_SEL_SUBMIT", "button[type='submit']"),
            "success_indicator": os.environ.get("IGR_SEL_SUCCESS", "text=Filing Successful"),
            "acknowledgment_span": os.environ.get("IGR_SEL_ACK_SPAN", "span#acknowledgment_number"),
        }

    def _upload_path(self, doc_type: str, case_id: str) -> str:
        """Resolve document upload path from env var or default convention."""
        env_key = f"IGR_DOC_PATH_{doc_type.upper()}"
        default = f"/srv/ag/documents/{case_id}/{doc_type}.pdf"
        return os.environ.get(env_key, default)

    async def file_noi(
        self,
        case_id: str,
        borrower_name: str,
        loan_amount: str,
        property_address: str,
        property_city: str,
        bank_name: str,
        grn_number: str,
    ) -> Dict[str, Any]:
        """File NOI on IGR portal. Returns acknowledgment on success.

        Uses configurable selectors from env vars (IGR_SEL_*) — override any
        selector in production .env without touching code.
        """
        logger.info(f"🚀 [IGR] Starting NOI filing for case: {case_id}")

        if not grn_number:
            return {"success": False, "error": "GRN number required — generate challan first"}

        browser = None
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                page = await context.new_page()

                logger.info("🌐 [IGR] Navigating to IGR e-filing portal...")
                await page.goto(self.portal_url)

                await page.fill(self.sel["username_input"], self.portal_username)
                await page.fill(self.sel["password_input"], self.portal_password)
                await page.click(self.sel["login_button"])

                otp_code = await self._wait_for_otp(f"igr:{case_id}", timeout_seconds=120)
                if not otp_code:
                    return {"success": False, "error": "OTP Timeout — login failed"}

                await page.fill(self.sel["otp_input"], otp_code)
                await page.click(self.sel["otp_verify_button"])
                await page.wait_for_selector(self.sel["dashboard_indicator"])

                await page.click(self.sel["file_noi_link"])
                await page.wait_for_selector(self.sel["noi_form"])

                await page.fill(self.sel["borrower_name_input"], borrower_name)
                await page.fill(self.sel["loan_amount_input"], loan_amount)
                await page.fill(self.sel["property_address_input"], property_address)
                await page.fill(self.sel["property_city_input"], property_city)
                await page.fill(self.sel["bank_name_input"], bank_name)
                await page.fill(self.sel["grn_input"], grn_number)

                sanction_path = self._upload_path("sanction_letter", case_id)
                kyc_path = self._upload_path("borrower_kyc", case_id)
                stamp_path = self._upload_path("stamp_duty_receipt", case_id)

                await page.set_input_files(self.sel["sanction_letter_upload"], sanction_path)
                await page.set_input_files(self.sel["borrower_kyc_upload"], kyc_path)
                await page.set_input_files(self.sel["stamp_duty_upload"], stamp_path)

                await page.click(self.sel["submit_button"])
                await page.wait_for_selector(self.sel["success_indicator"])
                ack = await page.inner_text(self.sel["acknowledgment_span"])

                await self._store_filing_result(case_id, ack)

                record_activity(
                    source="igr_rpa",
                    staff_kind="agent",
                    staff_short_name="igr_executor",
                    capability_code="rpa.run_igr",
                    case_id=case_id,
                    summary=f"NOI filed — Acknowledgment: {ack}",
                    payload={"grn": grn_number, "ack": ack},
                    status="ok",
                )

                return {
                    "success": True,
                    "acknowledgment_number": ack,
                    "case_id": case_id,
                    "agent": "IgrRpaExecutor",
                }

        except Exception as e:
            logger.error(f"❌ [IGR] NOI filing failed: {str(e)}")
            record_activity(
                source="igr_rpa",
                staff_kind="agent",
                staff_short_name="igr_executor",
                capability_code="rpa.run_igr",
                case_id=case_id,
                summary=f"NOI filing failed: {str(e)}",
                status="error",
            )
            return {"success": False, "error": str(e)}
        finally:
            if browser is not None:
                try:
                    await browser.close()
                except Exception:
                    pass

    async def _wait_for_otp(self, key: str, timeout_seconds: int = 120) -> Optional[str]:
        """Poll Redis for OTP delivered via Telegram bot."""
        import redis.asyncio as aioredis
        r = aioredis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))
        try:
            start = asyncio.get_event_loop().time()
            while (asyncio.get_event_loop().time() - start) < timeout_seconds:
                otp = await r.get(f"otp:{key}")
                if otp:
                    await r.delete(f"otp:{key}")
                    return otp
                await asyncio.sleep(2)
            return None
        finally:
            await r.close()

    async def _store_filing_result(self, case_id: str, ack: str):
        """Store filing acknowledgment in Redis for downstream use."""
        import redis.asyncio as aioredis
        r = aioredis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))
        try:
            await r.setex(
                f"noi_filing:{case_id}",
                86400 * 7,
                json.dumps({
                    "acknowledgment_number": ack,
                    "filed_at": datetime.utcnow().isoformat(),
                }),
            )
        finally:
            await r.close()

    async def check_status(self, acknowledgment_number: str) -> Dict[str, Any]:
        """Check the status of a previously filed NOI on the IGR portal."""
        logger.info("🔍 [IGR] Checking NOI status for: %s", acknowledgment_number)
        # Mock implementation — real would scrape or API-call the IGR portal
        return {
            "success": True,
            "acknowledgment_number": acknowledgment_number,
            "status": "PROCESSING",
            "estimated_completion": "7-10 working days",
        }


igr_executor = IgrRpaExecutor()
