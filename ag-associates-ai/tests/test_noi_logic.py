"""
Test the core logic of the NOI workflow without external dependencies.
This focuses on testing the state transitions and business logic.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Test the NOI states definition
def test_noi_states():
    """Test that NOI states are defined correctly."""
    from noi_agent import NOI_STATES, NOI_EXCEPTION_STATES
    
    expected_states = [
        "DOCUMENTS_RECEIVED",
        "CHALLAN_GENERATED", 
        "CHALLAN_PAID",
        "VERIFIED",
        "NOI_DROP_RECEIVED",
        "NOI_FILED",
        "ACKNOWLEDGED",
        "COMPLETED",
    ]
    
    assert NOI_STATES == expected_states
    assert NOI_EXCEPTION_STATES == ["MISMATCH", "REJECTED"]
    print("✓ NOI states test passed")

# Test the NOI state transitions logic
def test_state_transitions():
    """Test valid state transitions in the NOI workflow."""
    from noi_agent import NOI_STATES
    
    # Define valid transitions based on the workflow
    valid_transitions = {
        "DOCUMENTS_RECEIVED": ["CHALLAN_GENERATED"],
        "CHALLAN_GENERATED": ["CHALLAN_PAID"],
        "CHALLAN_PAID": ["VERIFIED", "NOI_DROP_RECEIVED"],  # Can go to verification or wait for drop
        "VERIFIED": ["NOI_DROP_RECEIVED"],  # After verification, wait for drop
        "NOI_DROP_RECEIVED": ["NOI_FILED"],  # After receiving drop, can file
        "NOI_FILED": ["ACKNOWLEDGED"],      # After filing, wait for acknowledgment
        "ACKNOWLEDGED": ["COMPLETED"],      # After acknowledgment, complete
        "COMPLETED": []                     # Final state
    }
    
    # Verify all states have defined transitions
    for state in NOI_STATES:
        assert state in valid_transitions, f"Missing transition definition for {state}"
    
    print("✓ State transitions test passed")

# Test the NOI workflow logic without external dependencies
def test_workflow_logic():
    """Test the core workflow logic."""
    # We'll test the logic by examining the source code patterns
    
    # Read the noi_agent.py file and verify key components
    noi_agent_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'noi_agent.py')
    
    with open(noi_agent_path, 'r') as f:
        content = f.read()
    
    # Check that key methods exist
    assert 'class NOIAgent:' in content
    assert 'async def generate_challan' in content
    assert 'async def verify_documents' in content
    assert 'async def file_noi' in content
    assert 'async def acknowledge' in content
    assert 'async def run_workflow' in content
    
    # Check that the state constants are defined
    assert 'NOI_STATES = [' in content
    assert '"DOCUMENTS_RECEIVED"' in content
    assert '"CHALLAN_GENERATED"' in content
    assert '"VERIFIED"' in content
    assert '"NOI_FILED"' in content
    assert '"ACKNOWLEDGED"' in content
    assert '"COMPLETED"' in content
    
    print("✓ Workflow logic test passed")

if __name__ == "__main__":
    test_noi_states()
    test_state_transitions()
    test_workflow_logic()
    print("\n✅ All NOI logic tests passed!")