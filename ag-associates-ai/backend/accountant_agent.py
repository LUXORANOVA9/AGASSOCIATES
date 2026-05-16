import re
import pdfplumber
import gspread
from typing import Dict, Any

class AccountantAgent:
    """
    Agent 6: The Accountant
    Deterministic financial reconciliation using pdfplumber and gspread.
    """
    def __init__(self, google_creds_path: str, sheet_key: str):
        self.gc = gspread.service_account(filename=google_creds_path)
        self.sheet = self.gc.open_by_key(sheet_key).sheet1

    def reconcile_idbi_statement(self, pdf_path: str, expected_stamp_duty: float) -> Dict[str, Any]:
        """Parses an IDBI bank statement PDF and validates the UTR + credited amount.

        NOTE: this method currently does not write back to the GSpread ledger — the
        update call below is left commented out pending row-lookup logic. The success
        response is therefore best read as "validated, ready to mark PAID".
        """
        try:
            utr_number = None
            credit_amount = 0.0

            # 1. PDF Extraction
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    if "Cr. INR" in text:
                        # 2. Strict UTR Regex
                        utr_match = re.search(r'\b\d{12}\b', text)
                        if utr_match:
                            utr_number = utr_match.group(0)

                        # Extract the credit amount that appears alongside "Cr. INR".
                        # Matches integer or decimal values, optionally with commas.
                        amount_match = re.search(
                            r'Cr\.\s*INR\s*([\d,]+(?:\.\d{1,2})?)',
                            text,
                        )
                        if amount_match:
                            try:
                                credit_amount = float(amount_match.group(1).replace(',', ''))
                            except ValueError:
                                credit_amount = 0.0

            if not utr_number:
                return {
                    "status": "FAILED",
                    "error_level": "TIER_1", 
                    "reason": "Missing or illegible UTR number. Ask client to re-upload."
                }

            # 3. Mathematical Verification (Critical Escalation Check)
            if credit_amount != expected_stamp_duty:
                return {
                    "status": "FAILED",
                    "error_level": "TIER_3",
                    "reason": f"CRITICAL: Mathematical mismatch. Expected {expected_stamp_duty}, got {credit_amount}."
                }

            # 4. GSpread Execution
            # In production, we'd find the row by case ID and update it.
            # self.sheet.update_cell(row, col, "PAID")

            return {
                "status": "SUCCESS",
                "error_level": "NONE",
                "utr": utr_number,
                "amount": credit_amount,
                "message": "Reconciliation validated. Ledger update pending row-lookup implementation."
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error_level": "TIER_2",
                "reason": f"Algorithmic uncertainty / execution error: {str(e)}"
            }

# Example Usage
if __name__ == "__main__":
    agent = AccountantAgent("credentials.json", "1BxiMVs0XRX52eVh...")
    # result = agent.reconcile_idbi_statement("idbi_statement.pdf", 3000.0)
