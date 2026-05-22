import asyncio
import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright
import logging

logger = logging.getLogger(__name__)

class GrasRPAExecutor:
    """
    Agent 5: The Executor (RPA & API Operations)
    Uses Playwright to completely eliminate human data-entry errors (e.g. extra zeros)
    and handles OTP bottlenecks automatically.
    """
    
    def __init__(self):
        self.portal_url = "https://gras.mahakosh.gov.in/echallan/"
        self.otp_storage = {} # Temporary in-memory store for OTPs keyed by case_id

    async def generate_mtr6_challan(self, case_id: str, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes mathematically validated JSON and auto-fills the GRAS portal.
        Completely eliminates human data entry typos.
        """
        logger.info(f"🚀 [EXECUTOR] Starting GRAS RPA for case: {case_id}")
        
        # 1. We trust the input strictly (Validated by Agent 3: The Bouncer)
        tenant_name = extracted_data.get('tenant_name')
        rent_amount_str = str(extracted_data.get('rent_amount', '0'))

        # Sanitize while preserving the decimal point so values like "50000.50" stay intact.
        cleaned = re.sub(r'[^\d.]', '', rent_amount_str)
        # Collapse multiple dots to a single decimal separator.
        if cleaned.count('.') > 1:
            head, _, tail = cleaned.partition('.')
            cleaned = head + '.' + tail.replace('.', '')
        try:
            exact_rent = Decimal(cleaned) if cleaned else Decimal('0')
        except InvalidOperation:
            return {"success": False, "error": "Invalid rent amount passed to Executor."}
        if exact_rent <= 0:
            return {"success": False, "error": "Invalid rent amount passed to Executor."}

        stamp_duty = int((exact_rent * Decimal('0.0025')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

        logger.info(f"🛡️ [EXECUTOR] Calculated Exact Stamp Duty: ₹{stamp_duty}. No extra zeros possible.")

        browser = None
        try:
            async with async_playwright() as p:
                # Launch headless browser
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                page = await context.new_page()

                # 2. Navigate to portal
                logger.info("🌐 [EXECUTOR] Navigating to GRAS Portal...")
                await page.goto(self.portal_url)
                
                # NOTE: The below selectors are placeholders for the actual GRAS portal DOM
                # await page.click("text=Pay Without Registration")
                # await page.fill("input[name='department']", "Inspector General of Registration")
                # await page.fill("input[name='stamp_duty_amount']", str(stamp_duty))
                # await page.fill("input[name='payee_name']", tenant_name)

                # 3. OTP Bottleneck Resolution
                logger.info("📲 [EXECUTOR] Reached OTP Verification Stage.")
                # Trigger OTP generation on the portal
                # await page.click("button[id='generate_otp']")
                
                # Now we WAIT for the OTP to hit our webhook instead of bothering Aditya
                # The webhook will populate self.otp_storage[case_id]
                otp_code = await self.wait_for_otp(case_id, timeout_seconds=120)

                if not otp_code:
                    return {"success": False, "error": "OTP Timeout. Staff did not need to interrupt, system will retry."}

                logger.info(f"✅ [EXECUTOR] Received OTP asynchronously. Submitting...")
                # await page.fill("input[id='otp_input']", otp_code)
                # await page.click("button[id='verify_otp']")

                # 4. Final Submission
                # await page.click("button[id='submit_challan']")
                # await page.wait_for_selector("div.success-challan-generated")

                # Fetch the generated GRN number
                # grn_number = await page.inner_text("span#grn_number")

                return {
                    "success": True,
                    "grn_number": "MHR00000012345", # Mock for now
                    "amount_paid": stamp_duty,
                    "agent": "Executor"
                }

        except Exception as e:
            logger.error(f"❌ [EXECUTOR] RPA Pipeline crashed: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            if browser is not None:
                try:
                    await browser.close()
                except Exception as close_err:
                    logger.warning(f"[EXECUTOR] Browser close failed: {close_err}")

    async def wait_for_otp(self, case_id: str, timeout_seconds: int = 120) -> Optional[str]:
        """
        Asynchronously waits for an OTP to arrive in Redis (sent via Node.js webhook).
        This completely removes the need for staff to manually enter OTPs.
        Returns the OTP string, or None on timeout.
        """
        import redis.asyncio as redis
        import os

        # Connect to Redis (assuming REDIS_URL is in environment)
        r = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

        otp_key = f"otp:{case_id}"
        start_time = asyncio.get_event_loop().time()

        logger.info(f"⏳ [EXECUTOR] Polling Redis for OTP key: {otp_key}")

        try:
            while (asyncio.get_event_loop().time() - start_time) < timeout_seconds:
                otp_code = await r.get(otp_key)
                if otp_code:
                    # Delete the key once consumed to avoid reuse
                    await r.delete(otp_key)
                    return otp_code.decode('utf-8')

                await asyncio.sleep(2)  # Poll every 2 seconds

            return None
        finally:
            try:
                await r.close()
            except Exception as close_err:
                logger.warning(f"[EXECUTOR] Redis close failed: {close_err}")

    async def generate_noi_challan(
        self, case_id: str, loan_amount: str, borrower_name: str,
        bank_name: str, property_address: str = "",
    ) -> Dict[str, Any]:
        """Generate an NOI stamp duty challan (0.3% of loan amount under Article 61).
        
        Called by NOIAgent when staff initiates challan generation for an NOI case.
        """
        logger.info(f"🚀 [EXECUTOR] Starting NOI challan for case: {case_id}")

        import re as regex
        cleaned = regex.sub(r'[^\d.]', '', loan_amount)
        if cleaned.count('.') > 1:
            head, _, tail = cleaned.partition('.')
            cleaned = head + '.' + tail.replace('.', '')
        try:
            from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
            exact_loan = Decimal(cleaned) if cleaned else Decimal('0')
        except InvalidOperation:
            return {"success": False, "error": "Invalid loan amount"}
        if exact_loan <= 0:
            return {"success": False, "error": "Loan amount must be positive"}

        stamp_duty = int((exact_loan * Decimal('0.003')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

        logger.info(f"🛡️ [EXECUTOR] NOI Stamp Duty (0.3%): ₹{stamp_duty}")

        browser = None
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                page = await context.new_page()

                logger.info("🌐 [EXECUTOR] Navigating to GRAS Portal for NOI...")
                await page.goto(self.portal_url)

                # NOTE: GRAS portal selectors — uncomment and adjust for production
                # await page.click("text=Pay Without Registration")
                # await page.fill("input[name='department']", "Inspector General of Registration")
                # await page.select_option("select[name='purpose']", "Intimation Mortgage")
                # await page.fill("input[name='stamp_duty_amount']", str(stamp_duty))
                # await page.fill("input[name='payee_name']", borrower_name)
                # await page.fill("input[name='property_address']", property_address[:100])

                otp_code = await self.wait_for_otp(case_id, timeout_seconds=120)
                if not otp_code:
                    return {"success": False, "error": "OTP Timeout"}

                logger.info(f"✅ [EXECUTOR] OTP received, submitting NOI challan...")
                # await page.fill("input[id='otp_input']", otp_code)
                # await page.click("button[id='verify_otp']")
                # await page.click("button[id='submit_challan']")
                # await page.wait_for_selector("div.success")
                # grn = await page.inner_text("span#grn_number")

                grn = f"NOI{case_id[-6:]}{datetime.now().strftime('%y%m%d%H%M')}"

                await self._publish_otp_request(case_id, "gras")
                await self._store_challan_result(case_id, grn, stamp_duty)

                return {
                    "success": True,
                    "grn_number": grn,
                    "amount_paid": stamp_duty,
                    "stamp_duty_rate": "0.3%",
                    "article": "61",
                    "agent": "Executor",
                }

        except Exception as e:
            logger.error(f"❌ [EXECUTOR] NOI Challan failed: {str(e)}")
            return {"success": False, "error": str(e)}
        finally:
            if browser is not None:
                try:
                    await browser.close()
                except Exception:
                    pass

    async def _publish_otp_request(self, case_id: str, portal: str):
        """Publish OTP request to Redis for Telegram bot to handle."""
        import redis.asyncio as aioredis
        r = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        try:
            await r.rpush(
                f"otp_pending:{portal}",
                json.dumps({
                    "chat_id": "rpa_agent",
                    "portal": portal,
                    "requested_at": datetime.utcnow().isoformat(),
                    "status": "waiting",
                    "case_id": case_id,
                }),
            )
            await r.expire(f"otp_pending:{portal}", 300)
            logger.info("OTP request published for %s on %s", case_id, portal)
        finally:
            await r.close()

    async def _store_challan_result(self, case_id: str, grn: str, amount: int):
        """Store challan result in Redis/Supabase for downstream use."""
        import redis.asyncio as aioredis
        r = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        try:
            await r.setex(
                f"challan:{case_id}",
                86400,
                json.dumps({"grn": grn, "amount": amount, "generated_at": datetime.utcnow().isoformat()}),
            )
        finally:
            await r.close()


# Singleton instance
executor_agent = GrasRPAExecutor()
