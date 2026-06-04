"""StateGraph wiring + public entrypoint for the pipeline."""

from typing import Any, Dict, Optional

from langgraph.graph import END, StateGraph

from .aisha import aisha_intake_node
from .auditor import auditor_node
from .bouncer import bouncer_node
from .drafter import drafter_node
from .guardrail import guardrail_node
from .state import AgentState


def should_revise(state: AgentState) -> str:
    """After auditor: revise (loop back to drafter), or finish."""
    if state['audit_passed']:
        print("✅ Audit passed - proceeding to finish")
        return "finish"
    if state['revision_count'] > 3:
        print("⚠️ Max revisions reached - finishing anyway")
        return "finish"
    print(f"🔄 Audit failed - revising (attempt {state['revision_count'] + 1})")
    return "revise"


def _check_guardrail(state: AgentState) -> str:
    if not state.get('guardrail_passed', False):
        print("🛑 Guardrail blocked execution. Ending workflow early.")
        return "finish"
    return "continue"


def _check_bouncer(state: AgentState) -> str:
    if not state.get('bouncer_passed', False):
        print("🛑 Bouncer blocked execution: Stamp duty mismatch. Ending workflow early.")
        return "finish"
    return "continue"


def build_agent_graph() -> StateGraph:
    """Build the LangGraph workflow: Aisha → Guardrail → Bouncer → Drafter → Auditor."""
    workflow = StateGraph(AgentState)

    workflow.add_node("aisha_intake", aisha_intake_node)
    workflow.add_node("guardrail", guardrail_node)
    workflow.add_node("bouncer", bouncer_node)
    workflow.add_node("drafter", drafter_node)
    workflow.add_node("auditor", auditor_node)

    workflow.set_entry_point("aisha_intake")

    workflow.add_edge("aisha_intake", "guardrail")

    workflow.add_conditional_edges(
        "guardrail",
        _check_guardrail,
        {"finish": END, "continue": "bouncer"},
    )

    workflow.add_conditional_edges(
        "bouncer",
        _check_bouncer,
        {"finish": END, "continue": "drafter"},
    )

    workflow.add_edge("drafter", "auditor")

    workflow.add_conditional_edges(
        "auditor",
        should_revise,
        {"finish": END, "revise": "drafter"},
    )

    return workflow.compile()


def process_rental_request(
    raw_input: str,
    sender: str = "whatsapp_user",
    org_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the full pipeline on a raw rental request and return a summary dict."""
    print("\n" + "=" * 60)
    print("🚀 STARTING AG ASSOCIATES AI WORKFLOW")
    print("=" * 60)

    initial_state = AgentState(
        raw_input=raw_input,
        sender=sender,
        org_id=org_id,
        tenant_name=None,
        landlord_name=None,
        rent_amount=None,
        property_address=None,
        agreement_start_date=None,
        agreement_duration=None,
        security_deposit=None,
        stamp_duty_paid=None,
        extracted_json=None,
        template_id=None,
        template_content=None,
        drafted_document=None,
        pdf_path=None,
        guardrail_passed=False,
        bouncer_passed=False,
        bouncer_feedback=None,
        audit_passed=False,
        audit_feedback=None,
        revision_count=0,
        current_node="init",
        errors=[],
        timestamps={},
    )

    graph = build_agent_graph()

    try:
        final_state = graph.invoke(initial_state)

        print("\n" + "=" * 60)
        print("✅ WORKFLOW COMPLETED")
        print("=" * 60)
        print(f"\n📋 SUMMARY:")
        print(f"   Tenant: {final_state.get('tenant_name') or 'N/A'}")
        print(f"   Property: {(final_state.get('property_address') or 'N/A')[:50]}...")
        print(f"   Rent: {final_state.get('rent_amount') or 'N/A'}")
        print(f"   Document: {final_state.get('pdf_path', 'Not generated')}")
        print(f"   Audit: {'PASSED' if final_state.get('audit_passed') else 'FAILED'}")
        print(f"   Revisions: {final_state.get('revision_count', 0)}")

        return {
            "success": True,
            "state": final_state,
            "document_path": final_state.get('pdf_path'),
            "audit_passed": final_state.get('audit_passed'),
            "extracted_data": final_state.get('extracted_json'),
        }

    except Exception as e:
        print(f"\n❌ WORKFLOW FAILED: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "state": initial_state,
        }
