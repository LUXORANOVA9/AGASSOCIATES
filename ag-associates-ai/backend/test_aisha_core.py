import pytest
import os
from unittest.mock import patch

import aisha_core
from aisha_core import classify_intent

@pytest.fixture(autouse=True)
def mock_env_vars():
    """Ensure OPENAI_API_KEY is present so ChatOpenAI does not throw an error upon initialization."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "fake_api_key"}):
        yield

@pytest.fixture(autouse=True)
def disable_llm_mock_mode():
    """Disable mock mode to test the actual LangChain implementation."""
    original_value = aisha_core.LLM_MOCK_MODE
    aisha_core.LLM_MOCK_MODE = False
    yield
    aisha_core.LLM_MOCK_MODE = original_value

def test_classify_intent_mock_mode():
    """Verify that when mock mode is enabled, predefined intents are returned based on keyword logic."""
    original_value = aisha_core.LLM_MOCK_MODE
    aisha_core.LLM_MOCK_MODE = True
    try:
        assert classify_intent("I want to draft a rent agreement") == "legal_draft"
        assert classify_intent("What is the status of my case?") == "admin_cmd"
        assert classify_intent("I need an otp for GRAS") == "otp_request"
        assert classify_intent("Hello Aisha") == "general"
    finally:
        aisha_core.LLM_MOCK_MODE = original_value

@patch("langchain_core.runnables.base.RunnableSequence.invoke")
def test_classify_intent_with_mocked_chain(mock_invoke):
    """Test the intent classifications when the underlying LangChain execution executes successfully."""
    # Test valid intent matching
    mock_invoke.return_value = {"intent": "legal_draft", "reasoning": "User asked to draft"}
    assert classify_intent("I want to draft a rental agreement") == "legal_draft"

    mock_invoke.return_value = {"intent": "admin_cmd", "reasoning": "Checking case"}
    assert classify_intent("Check case status") == "admin_cmd"

    mock_invoke.return_value = {"intent": "otp_request", "reasoning": "OTP needed"}
    assert classify_intent("Send OTP") == "otp_request"

    mock_invoke.return_value = {"intent": "general", "reasoning": "Just saying hi"}
    assert classify_intent("Hi there") == "general"

    # Test edge case: 'intent' key is missing in the generated JSON
    mock_invoke.return_value = {"reasoning": "No intent present in the parsed output"}
    assert classify_intent("Something weird") == "general"

@patch("langchain_core.runnables.base.RunnableSequence.invoke")
def test_classify_intent_exception(mock_invoke):
    """Test that a generic failure defaults the intent to 'general'."""
    mock_invoke.side_effect = Exception("LLM is down")
    assert classify_intent("Can you write a rental agreement?") == "general"
