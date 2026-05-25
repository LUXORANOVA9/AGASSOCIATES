from fastapi import APIRouter, Depends, HTTPException, Request
from .stripe_client import StripeClient
from .webhook import PaymentWebhookHandler

router = APIRouter(prefix="/payments", tags=["payments"])
stripe_client = StripeClient()
webhook_handler = PaymentWebhookHandler()

@router.post("/create-intent")
async def create_payment_intent(request: Request):
    """Start a payment flow for a specific case."""
    data = await request.json()
    case_id = data.get("case_id")
    amount = data.get("amount")
    email = data.get("email")

    if not all([case_id, amount, email]):
        raise HTTPException(status_code=400, detail="Missing case_id, amount, or email")

    try:
        session = await stripe_client.create_checkout_session(case_id, amount, email)
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook endpoint for async notifications."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    
    return await webhook_handler.handle_webhook(payload, sig_header)
