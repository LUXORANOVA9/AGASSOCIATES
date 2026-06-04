"""Node 1.7: Bouncer — mathematical sanity check on stamp duty paid."""

import re
from datetime import datetime
from typing import Any, Optional

from langsmith import traceable

from .state import AgentState
from .stamp_duty import extract_numeric, duration_to_months
from .utils import record_activity


@traceable(name="Bouncer_Math_Validator")
def bouncer_node(state: AgentState) -> AgentState:
    """Verify stamp duty paid ≈ 0.3% of (rent × months) within ₹50 tolerance."""
    print(f"\n⚖️ [BOUNCER] Verifying stamp duty calculations")
    state['current_node'] = 'bouncer'
    state['timestamps']['bouncer_start'] = datetime.now().isoformat()
    state['bouncer_passed'] = False

    def _finish():
        state['timestamps']['bouncer_end'] = datetime.now().isoformat()
        return state

    rent = extract_numeric(state.get('rent_amount'))
    months = duration_to_months(state.get('agreement_duration', ''))
    paid = extract_numeric(state.get('stamp_duty_paid'))

    if rent is None or months == 0 or paid is None:
        error_msg = (
            f"Bouncer Failed: Missing mathematical inputs "
            f"(Rent: {rent}, Duration: {months}, Paid: {paid})"
        )
        print(f"❌ [BOUNCER] {error_msg}")
        state['errors'].append(error_msg)
        state['bouncer_feedback'] = error_msg
        return _finish()

    expected = (rent * months) * 0.003

    if abs(paid - expected) <= 50:
        state['bouncer_passed'] = True
        print(f"✅ [BOUNCER] Stamp duty verified: Found ₹{paid}, Expected ₹{expected:.2f}")
        record_activity(
            source="agent", staff_kind="agent", staff_short_name="bouncer",
            capability_code="case.validate",
            summary=f"Stamp duty verified: ₹{paid} paid vs ₹{expected:.2f} expected",
            org_id=state.get('org_id'),
            payload={"expected": expected, "actual": paid},
        )
    else:
        error_msg = (
            f"Bouncer Failed: Expected approx ₹{expected:.2f} "
            f"(0.3% of {rent} * {months}), but found ₹{paid}"
        )
        print(f"❌ [BOUNCER] {error_msg}")
        state['errors'].append(error_msg)
        state['bouncer_feedback'] = error_msg
        record_activity(
            source="agent", staff_kind="agent", staff_short_name="bouncer",
            capability_code="case.validate",
            summary=error_msg,
            status="error",
            org_id=state.get('org_id'),
            payload={"expected": expected, "actual": paid},
        )

    return _finish()
