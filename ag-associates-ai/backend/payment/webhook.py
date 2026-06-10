import os
import logging
import stripe
from fastapi import Request, HTTPException
from .models import PaymentStatus
from .stripe_client import StripeClient
from noi_agent import noi_agent


logger = logging.getLogger(__name__)

class PaymentWebhookHandler:
    """Handles asynchronous payment notifications from Stripe."""

    def __init__(self):
        self.webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        self.stripe_client = StripeClient()

    async def handle_webhook(self, payload: bytes, sig_header: str):
        """Verify Stripe signature and process the event."""
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
        except ValueError:
            # Invalid payload
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            # Invalid signature
            raise HTTPException(status_code=400, detail="Invalid signature")

        # Process the event
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            case_id = session.get("client_reference_id")
            payment_id = session.get("id")

            logger.info("Payment completed for case %s, session %s", case_id, payment_id)
            await self._mark_payment_completed(case_id, payment_id)
        else:
            logger.info("Unhandled Stripe event type: %s", event["type"])

        return {"status": "success"}

    async def _mark_payment_completed(self, case_id: str, payment_id: str):
        """Update payment status in Supabase/DB."""
        logger.info("Updating database for payment %s (case %s) to COMPLETED", payment_id, case_id)
        await noi_agent.update_noi_status(
            case_id=case_id,
            new_status="CHALLAN_PAID",
            notes=f"Payment completed (Stripe session: {payment_id})"
        )
