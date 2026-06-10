"""Email Intake Agent — monitors bank email inbox, extracts loan sanction details,
creates cases in Supabase with INTIMATION_MORTGAGE type.

Flow:
  1. Poll IMAP inbox for new emails from known bank domains
  2. Parse email body + attachments using LLM
  3. Extract: borrower name, loan amount, bank, property details, loan ref
  4. Create case in Supabase with status PENDING_INTAKE
  5. Log action to Redis for dashboard visibility
"""

import os
import logging
import asyncio
import imaplib
import email
import re
from email.header import decode_header
from typing import Optional

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

# ── Config ───────────────────────────────────────────────────────────────

IMAP_HOST = os.environ.get("EMAIL_IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.environ.get("EMAIL_IMAP_PORT", "993"))
IMAP_USER = os.environ.get("EMAIL_IMAP_USER", "")
IMAP_PASS = os.environ.get("EMAIL_IMAP_PASS", "")
IMAP_INBOX = os.environ.get("EMAIL_IMAP_INBOX", "INBOX")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:8000/v1")
LLM_MODEL = os.environ.get("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "not-needed")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")

POLL_INTERVAL_SECONDS = int(os.environ.get("EMAIL_POLL_INTERVAL", "60"))
INTAKE_PORT = int(os.environ.get("EMAIL_INTAKE_PORT", "3004"))

KNOWN_BANK_DOMAINS = [
    "hdfc.com", "hdfcbank.com",
    "icicibank.com",
    "axisbank.com",
    "kotak.com", "kotakmahindra.com",
    "muthoot.com", "muthootfinance.com",
    "sbicard.com", "sbi.co.in",
    "yesbank.in",
    "idfcfirstbank.com",
    "indusind.com",
]

# ── Schema ───────────────────────────────────────────────────────────────

class LoanSanctionExtract(BaseModel):
    borrower_name: str = Field(description="Full name of the borrower")
    loan_amount: str = Field(description="Loan amount in INR (e.g., ₹45,00,000)")
    bank_name: str = Field(description="Name of the bank (e.g., HDFC, ICICI)")
    loan_ref_number: Optional[str] = Field(None, description="Loan reference or application number")
    property_address: Optional[str] = Field(None, description="Property address if mentioned")
    property_city: Optional[str] = Field(None, description="Property city/town")
    case_type: str = Field(default="INTIMATION_MORTGAGE", description="Case type from enum")
    confidence: float = Field(default=1.0, description="How confident the extraction is (0-1)")
    raw_summary: str = Field(default="", description="Brief summary of the email content")

# ── IMAP Poller ──────────────────────────────────────────────────────────

def decode_str(s):
    """Decode email header string."""
    if s is None:
        return ""
    decoded_parts = decode_header(s)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            try:
                result.append(part.decode(charset or "utf-8", errors="replace"))
            except LookupError:
                result.append(part.decode("utf-8", errors="replace"))
        else:
            result.append(str(part))
    return " ".join(result)


def is_bank_email(sender_email: str) -> bool:
    """Check if sender domain matches known bank domains."""
    match = re.search(r'@([\w.-]+)', sender_email)
    if not match:
        return False
    domain = match.group(1).lower()
    for bank_domain in KNOWN_BANK_DOMAINS:
        if domain == bank_domain or domain.endswith("." + bank_domain):
            return True
    return False



def parse_email_message(msg_bytes: bytes) -> Optional[dict]:
    """Parse raw email bytes into a structured dict if it is a bank email."""
    msg = email.message_from_bytes(msg_bytes)
    sender = decode_str(msg.get("From", ""))
    subject = decode_str(msg.get("Subject", ""))
    date_str = decode_str(msg.get("Date", ""))

    # Extract sender email
    sender_match = re.search(r'<([^>]+@[^>]+)>', sender) or re.search(r'([\w.-]+@[\w.-]+)', sender)
    sender_email = sender_match.group(1) if sender_match else sender

    if not is_bank_email(sender_email):
        return None

    # Extract body
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    body += part.get_payload(decode=True).decode("utf-8", errors="replace")
                except Exception:
                    pass
            elif part.get_content_type() == "text/html":
                try:
                    body += part.get_payload(decode=True).decode("utf-8", errors="replace")
                except Exception:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
        except Exception:
            body = str(msg.get_payload())

    return {
        "sender": sender_email,
        "subject": subject,
        "date": date_str,
        "body": body[:5000],  # truncate for LLM
    }


async def fetch_new_emails() -> list[dict]:
    """Connect to IMAP and fetch unseen emails from known bank senders."""
    if not IMAP_USER or not IMAP_PASS:
        logger.warning("IMAP credentials not configured")
        return []

    emails_raw = []

    def _fetch():
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(IMAP_USER, IMAP_PASS)
        mail.select(IMAP_INBOX)

        _, data = mail.search(None, "UNSEEN")
        seen_uids = set()

        for num in data[0].split():
            if not num:
                continue
            _, msg_data = mail.fetch(num, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    parsed_email = parse_email_message(response_part[1])
                    if parsed_email:
                        seen_uids.add(num)
                        emails_raw.append(parsed_email)

        return list(seen_uids)

    try:
        seen = await asyncio.to_thread(_fetch)
        logger.info("Fetched %d new bank emails", len(seen))
    except Exception as e:
        logger.error("IMAP fetch failed: %s", e)
        return []

    return emails_raw


# ── LLM Extraction ───────────────────────────────────────────────────────

async def extract_loan_details(email_text: str, sender: str, subject: str) -> Optional[LoanSanctionExtract]:
    """Use LLM to extract structured loan sanction details from email."""
    prompt = f"""Extract loan sanction details from this bank email.

Sender: {sender}
Subject: {subject}

Email content:
{email_text[:4000]}
"""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You extract structured loan sanction data from bank emails. "
                                       "Return JSON only with fields: borrower_name, loan_amount, bank_name, "
                                       "loan_ref_number, property_address, property_city, case_type, confidence, raw_summary. "
                                       "Use INTIMATION_MORTGAGE as default case_type. "
                                       "Set confidence low (0.3-0.5) if unsure about any field."
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 500,
                },
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            # Try to extract JSON from response
            import re as regex
            json_match = regex.search(r'\{.*\}', content, regex.DOTALL)
            if json_match:
                return LoanSanctionExtract.model_validate_json(json_match.group(0))
            else:
                logger.warning("No JSON in LLM response: %s", content[:200])
                return None

    except Exception as e:
        logger.error("LLM extraction failed: %s", e)
        return None


# ── Supabase Case Creation ───────────────────────────────────────────────

async def create_case(extract: LoanSanctionExtract, sender_email: str) -> Optional[str]:
    """Create a new INTIMATION_MORTGAGE case in Supabase."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase not configured — skipping case creation")
        return None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/cases",
                json={
                    "case_type": extract.case_type,
                    "status": "PENDING_INTAKE",
                    "bank_name": extract.bank_name,
                    "borrower_name": extract.borrower_name,
                    "loan_amount": extract.loan_amount,
                    "loan_ref": extract.loan_ref_number or "",
                    "property_address": extract.property_address or "",
                    "property_city": extract.property_city or "",
                    "source": "email_intake",
                    "source_email": sender_email,
                    "metadata": extract.model_dump_json(),
                },
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
            )
            resp.raise_for_status()
            result = resp.json()
            case_id = result[0]["id"] if isinstance(result, list) and len(result) > 0 else result.get("id")
            logger.info("Created case %s for %s (%s)", case_id, extract.borrower_name, extract.bank_name)
            return str(case_id)
    except Exception as e:
        logger.error("Supabase case creation failed: %s", e)
        return None


# ── Main Polling Loop ────────────────────────────────────────────────────

async def poll_once() -> int:
    """Fetch new emails, extract, create cases. Returns count of cases created."""
    emails = await fetch_new_emails()
    if not emails:
        return 0

    created = 0
    for mail in emails:
        extract = await extract_loan_details(mail["body"], mail["sender"], mail["subject"])
        if extract is None or extract.confidence < 0.3:
            logger.info("Low confidence extraction for email from %s — skipping", mail["sender"])
            continue

        case_id = await create_case(extract, mail["sender"])
        if case_id:
            created += 1

    return created


async def run_poller():
    """Continuous polling loop."""
    logger.info("Email Intake Agent started — polling every %ds", POLL_INTERVAL_SECONDS)
    while True:
        try:
            count = await poll_once()
            if count:
                logger.info("Created %d cases from bank emails", count)
        except Exception as e:
            logger.error("Poll cycle error: %s", e)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


# ── Health endpoint (for Docker HEALTHCHECK) ─────────────────────────────

async def health_server():
    import http.server
    import socketserver

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok","agent":"email_intake"}')

    with socketserver.TCPServer(("0.0.0.0", INTAKE_PORT), H) as httpd:
        httpd.serve_forever()


# ── Entry ────────────────────────────────────────────────────────────────

async def main():
    asyncio.create_task(health_server())
    await run_poller()


if __name__ == "__main__":
    asyncio.run(main())
