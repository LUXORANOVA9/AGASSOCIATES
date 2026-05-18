"""Node 1: Aisha — Intake agent that extracts structured fields from raw text."""

import os
from datetime import datetime

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langsmith import traceable

from config import LLM_BASE_URL, LLM_MODEL_NAME
from .state import AgentState
from .utils import invoke_llm_with_retry, record_activity

AISHA_SYSTEM_PROMPT = """You are Aisha, the Intake Agent for AG Associates Legal AI.
Your role is to extract structured information from raw user messages about rental agreements.

EXTRACT THE FOLLOWING VARIABLES:
- tenant_name: Full name of the tenant
- landlord_name: Full name of the landlord/property owner
- rent_amount: Monthly rent amount (with currency)
- property_address: Complete address of the rental property
- agreement_start_date: Start date of the agreement
- agreement_duration: Duration of the agreement (e.g., "11 months", "1 year")
- security_deposit: Security deposit amount (with currency)
- stamp_duty_paid: Amount of stamp duty paid (with currency)

IMPORTANT RULES:
1. Output ONLY valid JSON - no explanations, no markdown
2. If a field cannot be extracted, set it to null
3. Standardize dates to YYYY-MM-DD format when possible
4. Include all monetary amounts with currency symbols
5. Be careful with Indic names and addresses - preserve exact spelling

EXAMPLE OUTPUT:
{
    "tenant_name": "Rajesh Kumar Sharma",
    "landlord_name": "Priya Deshmukh",
    "rent_amount": "₹25,000 per month",
    "property_address": "Flat No. 302, Shivaji Nagar, Pune, Maharashtra 411005",
    "agreement_start_date": "2024-02-01",
    "agreement_duration": "11 months",
    "security_deposit": "₹75,000",
    "stamp_duty_paid": "₹330"
}
"""


@traceable(name="Aisha_Intake_Agent")
def aisha_intake_node(state: AgentState) -> AgentState:
    """Extract intake variables from the user's raw text."""
    print(f"\n🧠 [AISHA] Processing intake for sender: {state['sender']}")
    state['current_node'] = 'aisha_intake'
    state['timestamps']['aisha_start'] = datetime.now().isoformat()

    try:
        llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key=os.environ.get("LLM_API_KEY", "not-needed"),
            temperature=0.1,
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", AISHA_SYSTEM_PROMPT),
            ("human", "Extract variables from this message:\n\n{raw_input}"),
        ])

        parser = JsonOutputParser()
        chain = prompt | llm | parser

        result = invoke_llm_with_retry(chain, {"raw_input": state['raw_input']})

        if isinstance(result, dict):
            state['extracted_json'] = result
            state['tenant_name'] = result.get('tenant_name')
            state['landlord_name'] = result.get('landlord_name')
            state['rent_amount'] = result.get('rent_amount')
            state['property_address'] = result.get('property_address')
            state['agreement_start_date'] = result.get('agreement_start_date')
            state['agreement_duration'] = result.get('agreement_duration')
            state['security_deposit'] = result.get('security_deposit')

            print(f"✅ [AISHA] Successfully extracted {len([v for v in result.values() if v])} fields")
            record_activity(
                source="agent", staff_kind="agent", staff_short_name="aisha",
                capability_code="case.intake",
                summary=f"Extracted {len([v for v in result.values() if v])} fields from intake",
                payload={"sender": state.get("sender")},
                org_id=state.get('org_id'),
            )
        else:
            raise ValueError("Aisha did not return valid JSON")

    except Exception as e:
        error_msg = f"Aisha intake failed: {str(e)}"
        print(f"❌ [AISHA] {error_msg}")
        state['errors'].append(error_msg)
        state['extracted_json'] = None
        record_activity(
            source="agent", staff_kind="agent", staff_short_name="aisha",
            capability_code="case.intake", summary=error_msg, status="error",
            org_id=state.get('org_id'),
        )

    state['timestamps']['aisha_end'] = datetime.now().isoformat()
    return state
