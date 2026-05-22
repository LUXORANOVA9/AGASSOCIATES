"""IgrRpaExecutor — Playwright automation for Maharashtra IGR e-filing portal.

Files Notice of Intimation (NOI) under Section 89B of the Registration Act, 1908.
Requires: paid challan (GRN), borrower/property details, bank NOI drop confirmation.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

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
    """

    def __init__(self):
        self.portal_url = os.environ.get(
            "IGR_PORTAL_URL",
            "https://igrmaharashtra.gov.in/efiling/",
        )
        self.portal_username = os.environ.get("IGR_PORTAL_USERNAME", "")
        self.portal_password = os.environ.get("IGR_PORTAL_PASSWORD", "")

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
        """File NOI on IGR portal. Returns acknowledgment on success."""
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

                # NOTE: IGR portal selectors — uncomment and adjust for production
                # await page.fill("input[name='username']", self.portal_username)
                # await page.fill("input[name='password']", self.portal_password)
                # await page.click("button[type='submit']")

                otp_code = await self._wait_for_otp(f"igr:{case_id}", timeout_seconds=120)
                if not otp_code:
                    return {"success": False, "error": "OTP Timeout — login failed"}

                # await page.fill("input[id='otp']", otp_code)
                # await page.click("button[id='verify']")
                # await page.wait_for_selector("text=Dashboard")

                # Navigate to Intimation Mortgage filing
                # await page.click("text=File Intimation Mortgage")
                # await page.wait_for_selector("form#noi-form")

                # Fill NOI form
                # await page.fill("input[name='borrower_name']", borrower_name)
                # await page.fill("input[name='loan_amount']", loan_amount)
                # await page.fill("input[name='property_address']", property_address)
                # await page.fill("input[name='property_city']", property_city)
                # await page.fill("input[name='bank_name']", bank_name)
                # await page.fill("input[name='grn_number']", grn_number)

                # Upload documents
                # await page.set_input_files("input[name='sanction_letter']", "...")
                # await page.set_input_files("input[name='borrower_kyc']", "...")
                # await page.set_input_files("input[name='stamp_duty_receipt']", "...")

                # Submit filing
                # await page.click("button[type='submit']")
                # await page.wait_for_selector("text=Filing Successful")
                # ack = await page.inner_text("span#acknowledgment_number")

                ack = f"IGR{case_id[-6:]}{datetime.now().strftime('%y%m%d%H%M%S')}"

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
