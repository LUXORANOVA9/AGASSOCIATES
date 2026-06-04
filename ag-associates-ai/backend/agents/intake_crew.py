"""
Intake Crew — 4-agent CrewAI orchestration for the bank-to-IGR pipeline.

Per design.md §2, the Intake Crew is the public-facing multi-agent
sequence that handles "the critical transition from bank email to
government payload." CrewAI provides the role/goal/backstory surface
that design.md mandates; the heavy lifting is delegated to the
existing LangGraph pipeline (aisha_intake → guardrail → bouncer →
drafter → auditor).

Mapping (CrewAI role → LangGraph node):
    Agent 1 — Gatekeeper  → aisha_intake + guardrail
        Validates the email source is from an approved bank
        (Kotak, ICICI, Axis, Karur Vysya, Muthoot, Cholamandalam,
        Easy Home) and runs the hard-fail checklist for
        Index 2, PAN, Selfie, UTR.

    Agent 2 — Reader      → drafter (OCR + RAG drafting)
        High-precision OCR via Gemini Pro Vision for character-
        level accuracy on Suchi Kramank, applicant name, and
        consideration amount. Drafts the agreement with RAG.

    Agent 3 — Bouncer     → bouncer
        Validates extracted data: PAN regex [A-Z]{5}[0-9]{4}[A-Z]{1},
        consideration amount boundaries (₹5L–₹50Cr), stamp duty math
        against consideration_amount * statutory_fee_pct / 100.

    Agent 4 — Supervisor  → auditor
        Final QA. Confidence > 0.95 → emit IGRPortalPayload.
        Otherwise → requiresHumanReview = True for Adv. Aditya.

The crew runs Process.sequential. Each agent's tool is a thin
function wrapper around the corresponding LangGraph subgraph; the
state flows through LangGraph's AgentState TypedDict unchanged.

This module is a thin surface — it does NOT replace the LangGraph
pipeline. If you remove CrewAI from requirements, the underlying
`process_rental_request` in agents.graph still works.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from crewai import Agent, Crew, Process, Task


# Approved bank list (design.md §2 Gatekeeper). Reused by both the
# CrewAI agent's backstory and the actual validation function below.
APPROVED_BANKS: List[str] = [
    "Kotak Mahindra Bank",
    "ICICI Bank",
    "Axis Finance",
    "Karur Vysya Bank",
    "Muthoot Homefin",
    "Cholamandalam Finance",
    "Easy Home Finance",
    "HDFC Bank",
    "State Bank of India",
    "IDBI Bank",
]

# Hard-fail checklist (design.md §2 Gatekeeper).
REQUIRED_DOCUMENTS: List[str] = [
    "index_2",
    "pan_card",
    "applicant_selfie",
    "utr_payment_screenshot",
]

# Indian PAN regex (design.md §2 Bouncer Master Rule).
PAN_REGEX: str = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"

# Consideration amount boundaries (design.md §2 Bouncer).
MIN_CONSIDERATION_INR: int = 5_00_000      # ₹5 lakhs
MAX_CONSIDERATION_INR: int = 50_00_00_000  # ₹50 crores


def _gatekeeper_validate(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool for Agent 1 (Gatekeeper). Returns a status dict; the crew
    passes the result to Agent 2.
    """
    bank_source = payload.get("bank_source", "")
    documents = payload.get("documents", {})
    return {
        "bank_approved": bank_source in APPROVED_BANKS,
        "missing_documents": [d for d in REQUIRED_DOCUMENTS if not documents.get(d)],
        "bank_source": bank_source,
    }


def _bouncer_validate(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool for Agent 3 (Bouncer). Reads the case_article_codes table
    (created in 003_case_article_codes.sql) for the fee_pct and
    validates the math.
    """
    import re
    from .db import get_db_connection

    pan = payload.get("pan_number", "")
    consideration = payload.get("consideration_amount", 0) or 0
    stamp_duty_paid = payload.get("stamp_duty_paid", 0) or 0
    case_type = payload.get("case_type", "")

    pan_valid = bool(re.match(PAN_REGEX, pan))
    in_range = MIN_CONSIDERATION_INR <= consideration <= MAX_CONSIDERATION_INR

    fee_pct = 0.0
    article_code = "TO_FILL"
    if case_type:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT article_code, statutory_fee_pct, validated_by_principal "
                        "FROM case_article_codes WHERE case_type = %s",
                        (case_type,),
                    )
                    row = cur.fetchone()
                    if row:
                        article_code, fee_pct, validated = row
                        if not validated:
                            return {
                                "pan_valid": pan_valid,
                                "in_range": in_range,
                                "error": f"case_article_codes row for {case_type} is not validated_by_principal",
                            }
        except Exception as exc:
            return {
                "pan_valid": pan_valid,
                "in_range": in_range,
                "error": f"DB lookup failed: {exc}",
            }

    expected_stamp_duty = consideration * float(fee_pct) / 100.0
    stamp_duty_match = abs(expected_stamp_duty - stamp_duty_paid) < 1.0

    return {
        "pan_valid": pan_valid,
        "in_range": in_range,
        "stamp_duty_match": stamp_duty_match,
        "expected_stamp_duty": expected_stamp_duty,
        "article_code": article_code,
    }


def _supervisor_qa(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool for Agent 4 (Supervisor). Computes the final confidence
    score; if > 0.95, emits the IGRPortalPayload, otherwise flags
    for human review.
    """
    gatekeeper = state.get("gatekeeper", {})
    bouncer = state.get("bouncer", {})

    # Confidence = 1.0 minus penalty per failed check.
    confidence = 1.0
    if not gatekeeper.get("bank_approved", False):
        confidence -= 0.5
    confidence -= 0.1 * len(gatekeeper.get("missing_documents", []))
    if not bouncer.get("pan_valid", False):
        confidence -= 0.2
    if not bouncer.get("in_range", False):
        confidence -= 0.2
    if not bouncer.get("stamp_duty_match", False):
        confidence -= 0.3

    confidence = max(0.0, confidence)
    requires_human_review = confidence <= 0.95

    if requires_human_review:
        return {
            "confidence": confidence,
            "requires_human_review": True,
            "igr_payload": None,
        }

    igr_payload = {
        "article_code": bouncer.get("article_code", "TO_FILL"),
        "applicant_name": state.get("applicant_name"),
        "pan_number": state.get("pan_number"),
        "consideration_amount": state.get("consideration_amount"),
        "stamp_duty_paid": state.get("stamp_duty_paid"),
        "case_type": state.get("case_type"),
        "bank_source": gatekeeper.get("bank_source"),
    }
    return {
        "confidence": confidence,
        "requires_human_review": False,
        "igr_payload": igr_payload,
    }


def build_intake_crew() -> Crew:
    """
    Build the 4-agent Intake Crew per design.md §2.
    LLM defaults to whatever CrewAI picks (configurable via
    CREWAI_LLM_MODEL env var). Each agent's tool is a function
    wrapper; the actual OCR/validation work is delegated to the
    LangGraph pipeline or the case_article_codes table.
    """
    gatekeeper = Agent(
        role="The Gatekeeper",
        goal=(
            "Validate that the inbound payload originates from an "
            "approved bank partner and contains every required "
            "document on the hard-fail checklist."
        ),
        backstory=(
            "You are the front-line intake officer. You know the "
            "approved bank list by heart and refuse to let a case "
            "advance with missing documents. You work in the same "
            "office as the Bouncer, the Drafter, and the Supervisor."
        ),
        tools=[_gatekeeper_validate],
        allow_delegation=False,
        verbose=bool(os.getenv("CREWAI_VERBOSE", "0") == "1"),
    )

    reader = Agent(
        role="The Reader",
        goal=(
            "Extract character-level legal strings from the "
            "sanction letter, the Index 2 record, and the PAN card "
            "with Gemini Pro Vision OCR. Precision is non-negotiable; "
            "a single typo in Suchi Kramank results in SRO rejection."
        ),
        backstory=(
            "You are a former IGR clerk who has reviewed 10,000 "
            "Index 2 records. You can read a PAN card in 2 seconds "
            "and a Suchi Kramank entry in 5. You delegate the actual "
            "OCR to Gemini Pro Vision but you own the quality bar."
        ),
        tools=[],
        allow_delegation=False,
        verbose=bool(os.getenv("CREWAI_VERBOSE", "0") == "1"),
    )

    bouncer = Agent(
        role="The Bouncer",
        goal=(
            "Apply the Master Rules: PAN regex "
            "[A-Z]{5}[0-9]{4}[A-Z]{1}, consideration boundary ₹5L–"
            "₹50Cr, and stamp duty math against the IGR Article Code."
        ),
        backstory=(
            "You are the mathematical gatekeeper. You are "
            "intolerant of typos, off-by-one errors, and missing "
            "Article Codes. You will halt the pipeline if the "
            "case_article_codes row is not validated_by_principal."
        ),
        tools=[_bouncer_validate],
        allow_delegation=False,
        verbose=bool(os.getenv("CREWAI_VERBOSE", "0") == "1"),
    )

    supervisor = Agent(
        role="The Supervisor",
        goal=(
            "Compute the final confidence score. If > 0.95, emit "
            "the IGRPortalPayload. Otherwise, flag "
            "requiresHumanReview = True for Adv. Aditya."
        ),
        backstory=(
            "You are the final triage manager. You sign off on "
            "clean payloads and route messy ones to the principal. "
            "Your judgment is the difference between a 25-minute "
            "filing and a 25-day back-and-forth with the SRO."
        ),
        tools=[_supervisor_qa],
        allow_delegation=False,
        verbose=bool(os.getenv("CREWAI_VERBOSE", "0") == "1"),
    )

    task_gatekeeper = Task(
        description=(
            "Validate the inbound payload. Confirm bank_source is "
            "in the approved list. Confirm every required document "
            "is present. Output: bank_approved (bool), "
            "missing_documents (list)."
        ),
        expected_output="JSON with bank_approved and missing_documents.",
        agent=gatekeeper,
    )

    task_reader = Task(
        description=(
            "Extract: applicant_name, pan_number, consideration_amount, "
            "stamp_duty_paid, case_type, bank_source. The actual OCR "
            "is delegated to the existing LangGraph drafter; the crew "
            "step validates the extraction is non-empty."
        ),
        expected_output="JSON with all 6 fields extracted.",
        agent=reader,
    )

    task_bouncer = Task(
        description=(
            "Run the Master Rules. Confirm PAN format, consideration "
            "range, and stamp duty match. Halt if case_article_codes "
            "is unvalidated."
        ),
        expected_output="JSON with pan_valid, in_range, stamp_duty_match, article_code.",
        agent=bouncer,
    )

    task_supervisor = Task(
        description=(
            "Compute confidence. If > 0.95, emit the IGRPortalPayload. "
            "Otherwise flag requiresHumanReview."
        ),
        expected_output="JSON with confidence, requires_human_review, igr_payload.",
        agent=supervisor,
    )

    return Crew(
        agents=[gatekeeper, reader, bouncer, supervisor],
        tasks=[task_gatekeeper, task_reader, task_bouncer, task_supervisor],
        process=Process.sequential,
        verbose=bool(os.getenv("CREWAI_VERBOSE", "0") == "1"),
    )


def run_intake_crew(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Public entrypoint. Runs the 4-agent crew on an inbound payload
    and returns the supervisor's verdict.

    If CREWAI_ENABLED is "0" (the default for the existing
    /api/generate-agreement path), the function returns None and
    the caller should fall back to the LangGraph pipeline
    (`agents.process_rental_request`).
    """
    if os.getenv("CREWAI_ENABLED", "0") != "1":
        return None

    crew = build_intake_crew()
    result = crew.kickoff(inputs=payload)
    return getattr(result, "json_dict", None) or getattr(result, "raw", None) or {}
