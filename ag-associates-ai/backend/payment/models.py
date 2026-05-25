from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class PaymentStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


@dataclass
class PaymentRecord:
    payment_id: str
    case_id: str
    amount: float
    currency: str = "INR"
    status: PaymentStatus = PaymentStatus.PENDING
    stripe_session_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
