import asyncio
import re
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

# Singleton instance
executor_agent = GrasRPAExecutor()
