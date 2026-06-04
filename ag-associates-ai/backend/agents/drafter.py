"""Node 2: Drafter — RAG-based template selection + LLM document generation."""

import json
import os
from datetime import datetime

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import LLM_BASE_URL, LLM_MODEL_NAME, OUTPUT_DIR
from .db import get_db_connection, similarity_search
from .state import AgentState
from .utils import invoke_llm_with_retry, record_activity

DRAFTER_SYSTEM_PROMPT = """You are the Drafter, a Legal Architect AI for AG Associates.
Your role is to create professional rental agreements by combining templates with extracted data.

YOUR TASK:
1. Review the extracted tenant/landlord information
2. Use the provided template content as the base structure
3. Inject the extracted variables into appropriate sections
4. Maintain legal language and formatting
5. Ensure all placeholders are replaced with actual data
6. Add today's date as the agreement execution date
7. Format the output as clean Markdown suitable for PDF conversion

IMPORTANT:
- Preserve all legal clauses and terms from the template
- Only replace variable placeholders (marked as {{VARIABLE}} or similar)
- If any critical information is missing, note it at the end under "PENDING INFORMATION"
- Output the complete agreement document

TEMPLATE STRUCTURE TO FOLLOW:
- Title and Parties section
- Property Description
- Term and Rent details
- Security Deposit clause
- Rights and Obligations
- Signatures section
"""


def drafter_node(state: AgentState) -> AgentState:
    """Find best template via similarity_search, inject extracted fields, save MD + PDF."""
    print(f"\n📝 [DRAFTER] Starting document drafting")
    state['current_node'] = 'drafter'
    state['timestamps']['drafter_start'] = datetime.now().isoformat()
    state['revision_count'] = state.get('revision_count', 0) + 1

    try:
        if not state.get('extracted_json'):
            raise ValueError("No extracted data available from Aisha")

        search_query = f"Maharashtra rent agreement {state.get('property_address', '')}"
        templates = similarity_search(search_query, limit=3)

        if not templates:
            templates = _fallback_templates()
            if not templates:
                raise ValueError("No suitable templates found in database")

        best_template = templates[0]
        state['template_id'] = best_template['id']
        template_content = best_template['content']
        state['template_content'] = template_content

        print(f"📄 [DRAFTER] Selected template: {best_template['title']} (ID: {best_template['id']})")

        llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key=os.environ.get("LLM_API_KEY", "not-needed"),
            temperature=0.3,
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", DRAFTER_SYSTEM_PROMPT),
            ("human", """
Extracted Data:
{extracted_data}

Template Content:
{template_content}

Generate the complete rental agreement document:
"""),
        ])
        chain = prompt | llm

        extracted_str = json.dumps(state['extracted_json'], indent=2, ensure_ascii=False)
        result = invoke_llm_with_retry(chain, {
            "extracted_data": extracted_str,
            "template_content": template_content,
        })
        state['drafted_document'] = result.content

        _persist_outputs(state, result.content)

        record_activity(
            source="agent", staff_kind="agent", staff_short_name="drafter",
            capability_code="case.draft",
            summary=f"Drafted document (revision {state.get('revision_count')})",
            payload={"template_id": state.get("template_id"), "pdf_path": state.get("pdf_path")},
            org_id=state.get('org_id'),
        )
        # Success — don't clear state['errors']; prior nodes may have added entries.

    except Exception as e:
        error_msg = f"Drafter failed: {str(e)}"
        print(f"❌ [DRAFTER] {error_msg}")
        state['errors'].append(error_msg)
        state['drafted_document'] = None

    state['timestamps']['drafter_end'] = datetime.now().isoformat()
    return state


def _fallback_templates():
    """Any Maharashtra rent agreement, in case similarity_search returned nothing."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT id, title, content, language
                FROM legal_templates
                WHERE template_type = 'rent_agreement'
                AND jurisdiction = 'Maharashtra'
                LIMIT 1
            """)
            rows = cur.fetchall()
        finally:
            cur.close()
    finally:
        conn.close()
    return [dict(r) for r in rows]


def _persist_outputs(state: AgentState, document_md: str) -> None:
    """Write the Markdown and (best-effort) PDF to OUTPUT_DIR."""
    from pdf_generator import convert_to_pdf

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    pdf_filename = f"agreement_{state['sender']}_{timestamp}"

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    md_path = f"{OUTPUT_DIR}/{pdf_filename}.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(document_md)

    try:
        pdf_path = convert_to_pdf(document_md, f"{state['sender']}_{timestamp}")
        state['pdf_path'] = pdf_path
        print(f"✅ [DRAFTER] Document drafted and saved:")
        print(f"   Markdown: {md_path}")
        print(f"   PDF: {pdf_path}")
    except Exception as pdf_error:
        print(f"⚠️ [DRAFTER] PDF generation failed: {str(pdf_error)}")
        print(f"   Markdown saved: {md_path}")
        state['pdf_path'] = md_path  # Fallback to markdown path
