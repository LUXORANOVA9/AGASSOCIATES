import os
import logging
import stripe
from typing import Dict, Any
from .models import PaymentStatus

logger = logging.getLogger(__name__)

class StripeClient:
    """Wrapper for Stripe API operations."""
    
    def __init__(self):
        self.api_key = os.environ.get("STRIPE_SECRET_KEY")
        if not self.api_key:
            logger.error("STRIPE_SECRET_KEY is not set in environment")
        stripe.api_key = self.api_key

    async def create_checkout_session(self, case_id: str, amount: float, customer_email: str) -> Dict[str, Any]:
        """Creates a Stripe Checkout session for a specific NOI case."""
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'inr',
                        'product_data': {'name': f"NOI Filing Fee - Case {case_id}"},
                        'unit_amount': int(amount * 100), # Stripe uses cents/paise
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"https://advisor.agassociates.com/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"https://advisor.agassociates.com/payment/cancel",
                customer_email=customer_email,
                client_reference_id=case_id,
            )
            return {"session_id": session.id, "url": session.url}
        except stripe.error.StripeError as e:
            logger.error("Stripe session creation failed: %s", e)
            raise e
