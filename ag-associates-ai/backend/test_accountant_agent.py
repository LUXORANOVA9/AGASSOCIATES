import pytest
import os
import tempfile
from accountant_agent import accountant_agent

class TestAccountantAgentSecurity:

    def test_non_existent_file(self):
        """Test that extract_text_from_pdf raises an error for non-existent files."""
        with pytest.raises(ValueError, match="Invalid file path"):
            accountant_agent.extract_text_from_pdf("/path/to/nowhere.pdf")

    def test_not_a_file(self):
        """Test that extract_text_from_pdf raises an error if the path is a directory."""
        with tempfile.TemporaryDirectory() as temp_dir:
            with pytest.raises(ValueError, match="Invalid file path"):
                accountant_agent.extract_text_from_pdf(temp_dir)

    def test_file_size_exceeds_limit(self):
        """Test that extract_text_from_pdf raises an error if the file exceeds the 10MB limit."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b'0' * (10 * 1024 * 1024 + 1))
            temp_path = f.name

        try:
            with pytest.raises(ValueError, match="File size exceeds 10MB limit"):
                accountant_agent.extract_text_from_pdf(temp_path)
        finally:
            os.remove(temp_path)

    def test_invalid_magic_bytes(self):
        """Test that extract_text_from_pdf raises an error if the file is not a valid PDF."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b'This is a text file, not a PDF.')
            temp_path = f.name

        try:
            with pytest.raises(ValueError, match="File is not a valid PDF"):
                accountant_agent.extract_text_from_pdf(temp_path)
        finally:
            os.remove(temp_path)

    def test_valid_pdf_sanitization(self, monkeypatch):
        """Test that valid PDF text is successfully extracted and sanitized."""
        # Mock pdfplumber to avoid needing a real valid PDF for the test
        class MockPage:
            def extract_text(self):
                return "Valid \x00 Text \x1b[31m Test\nLine 2"

        class MockPDF:
            def __init__(self, *args, **kwargs):
                self.pages = [MockPage()]
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc_val, exc_tb):
                pass

        import pdfplumber
        monkeypatch.setattr(pdfplumber, "open", MockPDF)

        # Create a valid minimal PDF file
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b'%PDF-1.4\nEOF')
            temp_path = f.name

        try:
            result = accountant_agent.extract_text_from_pdf(temp_path)
            # The null byte \x00 and escape character \x1b should be removed
            # The newline should remain
            assert "\x00" not in result
            assert "\x1b" not in result
            assert "Valid  Text [31m Test\nLine 2\n" == result
        finally:
            os.remove(temp_path)
