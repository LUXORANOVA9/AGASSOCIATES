"""Node 3: Auditor — quality-assurance check on the drafted document."""

import json
import os
from datetime import datetime

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import LLM_BASE_URL, LLM_MODEL_NAME
from .state import AgentState
from .utils import invoke_llm_with_retry, record_activity

AUDITOR_SYSTEM_PROMPT = """You are the Auditor, a Quality Assurance AI for AG Associates Legal.
Your role is to verify that the drafted agreement accurately reflects the extracted requirements.

YOUR TASK:
1. Compare the extracted variables from Aisha with the drafted document
2. Verify all critical information is correctly included:
   - Tenant name appears correctly
   - Landlord name appears correctly
   - Rent amount is stated accurately
   - Property address is complete and correct
   - Agreement dates are properly specified
   - Security deposit is mentioned
3. Check for legal consistency and completeness
4. Identify any discrepancies or missing information

OUTPUT FORMAT:
Return a JSON object with:
{{
    "passed": true/false,
    "score": 0-100,
    "issues": ["list of issues found"],
    "feedback": "detailed feedback for improvements",
    "missing_fields": ["list of missing critical fields"]
}}

CRITICAL:
- If score >= 85 and no critical issues: passed = true
- If score < 85 or critical issues exist: passed = false
- Be thorough but reasonable - minor formatting issues shouldn't fail the audit
"""


def auditor_node(state: AgentState) -> AgentState:
    """Score the draft 0-100 against extracted fields; passed = ≥85 and no critical issues."""
    print(f"\n🔍 [AUDITOR] Starting quality audit")
    state['current_node'] = 'auditor'
    state['timestamps']['auditor_start'] = datetime.now().isoformat()

    try:
        if not state.get('drafted_document'):
            raise ValueError("No drafted document available for audit")

        llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key=os.environ.get("LLM_API_KEY", "not-needed"),
            temperature=0.1,
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", AUDITOR_SYSTEM_PROMPT),
            ("human", """
Extracted Requirements (from Aisha):
{extracted_json}

Drafted Document:
{drafted_document}

Perform the quality audit and return JSON:
"""),
        ])
        parser = JsonOutputParser()
        chain = prompt | llm | parser

        extracted_str = json.dumps(state['extracted_json'], indent=2, ensure_ascii=False)
        result = invoke_llm_with_retry(chain, {
            "extracted_json": extracted_str,
            "drafted_document": state['drafted_document'],
        })

        state['audit_passed'] = result.get('passed', False)
        state['audit_feedback'] = result.get('feedback', '')

        issues = result.get('issues', [])
        score = result.get('score', 0)

        print(f"📊 [AUDITOR] Audit Score: {score}/100")
        print(f"✅ [AUDITOR] Audit Passed: {state['audit_passed']}")
        record_activity(
            source="agent", staff_kind="agent", staff_short_name="auditor",
            capability_code="case.audit",
            summary=f"Audit score {score}/100 — {'passed' if state['audit_passed'] else 'failed'}",
            payload={"score": score, "issues_count": len(issues)},
            status="ok" if state['audit_passed'] else "warn",
            org_id=state.get('org_id'),
        )

        if issues:
            print(f"⚠️ [AUDITOR] Issues found: {len(issues)}")
            for issue in issues[:3]:
                print(f"   - {issue}")
        # Success — don't clear state['errors']; prior nodes may have added entries.

    except Exception as e:
        error_msg = f"Auditor failed: {str(e)}"
        print(f"❌ [AUDITOR] {error_msg}")
        state['errors'].append(error_msg)
        state['audit_passed'] = False
        state['audit_feedback'] = f"Audit could not be completed: {str(e)}"

    state['timestamps']['auditor_end'] = datetime.now().isoformat()
    return state
