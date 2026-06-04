"""Node 1.5: Guardrail — regex anti-hallucination checks on Aisha's output."""

import re
from datetime import datetime

from langsmith import traceable

from .state import AgentState


@traceable(name="Guardrail_Regex_Validator")
def guardrail_node(state: AgentState) -> AgentState:
    """Hard-fail if critical extracted fields are missing or implausible."""
    print(f"\n🛡️ [GUARDRAIL] Validating Aisha's extraction to prevent hallucinations")
    state['current_node'] = 'guardrail'
    if 'timestamps' not in state or state['timestamps'] is None:
        state['timestamps'] = {}
    state['timestamps']['guardrail_start'] = datetime.now().isoformat()
    state['guardrail_passed'] = False

    def _finish():
        state['timestamps']['guardrail_end'] = datetime.now().isoformat()
        return state

    if not state.get('extracted_json'):
        print("❌ [GUARDRAIL] Failed: No extracted data to validate.")
        state['errors'].append("Guardrail Failed: No extracted JSON.")
        return _finish()

    critical_fields = ['tenant_name', 'landlord_name', 'rent_amount', 'property_address']
    for field in critical_fields:
        if not state.get(field):
            error_msg = f"Guardrail Failed: Missing critical field '{field}'"
            print(f"❌ [GUARDRAIL] {error_msg}")
            state['errors'].append(error_msg)
            return _finish()

    rent_val = str(state.get('rent_amount', ''))
    if not re.search(r'\d+', rent_val):
        error_msg = (
            f"Guardrail Failed: 'rent_amount' ({rent_val}) does not contain valid "
            "numbers. Possible hallucination."
        )
        print(f"❌ [GUARDRAIL] {error_msg}")
        state['errors'].append(error_msg)
        return _finish()

    state['guardrail_passed'] = True
    print("✅ [GUARDRAIL] All anti-hallucination checks passed.")
    return _finish()
