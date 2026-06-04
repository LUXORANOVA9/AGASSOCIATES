"""Smoke-test the pipeline end-to-end: `python -m agents`."""

from . import process_rental_request

TEST_MESSAGE = """
Hi, I need a rental agreement for my new place in Pune.
Tenant name is Rahul Patil, and I'm the landlord - Suresh Deshmukh.
The property is at Flat 201, Krishna Heights, Karve Road, Pune 411004.
Monthly rent will be ₹28,000, and we're doing an 11-month agreement starting March 1st, 2024.
Security deposit is ₹84,000 (3 months rent).
Please prepare the agreement.
"""


def main() -> None:
    result = process_rental_request(TEST_MESSAGE, "test_user_001")
    if result["success"]:
        print("\n✨ Agreement generation successful!")
    else:
        print(f"\n❌ Error: {result.get('error')}")


if __name__ == "__main__":
    main()
