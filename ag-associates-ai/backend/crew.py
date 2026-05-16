from crewai import Agent, Task, Crew, Process
from pydantic import BaseModel, Field

# Output Schema
class IGRPortalPayload(BaseModel):
    applicant_name: str = Field(..., description="Full name of applicant")
    pan_number: str = Field(..., description="Valid Indian PAN", pattern="^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
    index_ii_number: str = Field(..., description="Suchi Kramank")
    consideration_amount: float = Field(..., description="Exact consideration amount")
    stamp_duty_calculated: float = Field(..., description="Exactly 0.3% of consideration")
    requiresHumanReview: bool = Field(default=False, description="True when the supervisor flags the payload for human review")

# 1. GATEKEEPER
gatekeeper = Agent(
    role="Intake Gatekeeper",
    goal="Analyze bank payloads and verify mandatory documents (Index II, PAN, Selfie, UTR)",
    backstory="You are the strict first line of defense. If a document is missing, you halt.",
    verbose=True,
    allow_delegation=False
)

# 2. THE READER
reader = Agent(
    role="Deep Extraction Reader",
    goal="Extract Applicant Name, PAN, Index II, and Consideration Amount precisely via OCR",
    backstory="You read legal documents with 100% accuracy.",
    verbose=True,
    allow_delegation=False
)

# 3. THE BOUNCER
bouncer = Agent(
    role="Mathematical Validator",
    goal="Enforce PAN regex and mathematically verify 0.3% stamp duty.",
    backstory="You trust no one. You calculate exactly. If math is wrong, you fail the process.",
    verbose=True,
    allow_delegation=False
)

# 4. THE SUPERVISOR
supervisor = Agent(
    role="Quality Control Supervisor",
    goal="Ensure JSON perfection and determine if human review is needed.",
    backstory="You are the ultimate approver. You only output Pydantic-validated JSON for the RPA bots.",
    verbose=True,
    allow_delegation=False
)

# Tasks
verify_payload = Task(
    description="Check the webhook payload for all required 4 documents.",
    expected_output="Verification boolean.",
    agent=gatekeeper
)

extract_data = Task(
    description="Extract Name, PAN, Index II, and Amount from the documents.",
    expected_output="Raw extracted text dictionary.",
    agent=reader
)

validate_math = Task(
    description="Validate PAN regex and calculate 0.3% of the Amount.",
    expected_output="Validated data dictionary.",
    agent=bouncer
)

generate_json = Task(
    description="Format output exactly to IGRPortalPayload schema or flag requiresHumanReview.",
    expected_output="Strict JSON object.",
    agent=supervisor,
    output_json=IGRPortalPayload
)

# Assembly
igr_pipeline_crew = Crew(
    agents=[gatekeeper, reader, bouncer, supervisor],
    tasks=[verify_payload, extract_data, validate_math, generate_json],
    process=Process.sequential,
    verbose=True
)

if __name__ == "__main__":
    import sys
    import traceback

    try:
        result = igr_pipeline_crew.kickoff()
        print("FINAL JSON PAYLOAD:")
        print(result)
    except Exception as exc:
        print(f"CREW EXECUTION FAILED: {exc}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
