import pytest
from unittest.mock import patch, MagicMock
from run_agent import AIAgent
from agent.model_metadata import MINIMUM_CONTEXT_LENGTH

def test_ai_agent_init_with_8k_context():
    """Verify that AIAgent initializes correctly with 8K context (the new floor)."""
    with patch("agent.model_metadata.get_model_context_length", return_value=8000), \
         patch("run_agent.ContextCompressor") as mock_compressor_cls, \
         patch("run_agent.load_hermes_dotenv", return_value=[]):
        
        # Setup mock compressor instance
        mock_compressor = mock_compressor_cls.return_value
        mock_compressor.context_length = 8000
        mock_compressor.get_tool_schemas.return_value = []
        
        # This should NOT raise ValueError anymore
        agent = AIAgent(model="ollama/gemma3", base_url="http://localhost:11434/v1")
        assert agent.context_compressor.context_length == 8000

def test_ai_agent_init_with_below_8k_context():
    """Verify that AIAgent initializes even below 8K (with a warning, no exception)."""
    with patch("agent.model_metadata.get_model_context_length", return_value=4000), \
         patch("run_agent.ContextCompressor") as mock_compressor_cls, \
         patch("run_agent.load_hermes_dotenv", return_value=[]):
        
        # Setup mock compressor instance
        mock_compressor = mock_compressor_cls.return_value
        mock_compressor.context_length = 4000
        mock_compressor.get_tool_schemas.return_value = []
        
        # This should NOT raise ValueError anymore (it only logs a warning)
        agent = AIAgent(model="very-small-model", base_url="http://localhost:11434/v1")
        assert agent.context_compressor.context_length == 4000

def test_ai_agent_init_with_64k_no_warning_logic_check():
    """Verify that AIAgent initializes normally with 64K context."""
    with patch("agent.model_metadata.get_model_context_length", return_value=64000), \
         patch("run_agent.ContextCompressor") as mock_compressor_cls, \
         patch("run_agent.load_hermes_dotenv", return_value=[]):
        
        # Setup mock compressor instance
        mock_compressor = mock_compressor_cls.return_value
        mock_compressor.context_length = 64000
        mock_compressor.get_tool_schemas.return_value = []
        
        agent = AIAgent(model="claude-3-sonnet", base_url="https://api.anthropic.com")
        assert agent.context_compressor.context_length == 64000
