import os
from unittest.mock import patch
from selector_config import get_selector


class TestGetSelector:
    def test_get_selector_default(self):
        """Test that get_selector returns default when env var is missing."""
        assert get_selector(
            "igr", "non_existent_key", "default_value"
        ) == "default_value"
        assert get_selector(
            "gras", "another_missing_key", "gras_default"
        ) == "gras_default"
        assert get_selector("unknown_portal", "key", "fallback") == "fallback"

    def test_get_selector_env_var(self):
        """Test that get_selector returns env var value when present."""
        with patch.dict(os.environ, {"IGR_SEL_TEST_KEY": "env_val_igr"}):
            assert get_selector("igr", "test_key", "default") == "env_val_igr"

        with patch.dict(os.environ, {"GRAS_SEL_SOME_KEY": "env_val_gras"}):
            assert get_selector(
                "gras", "some_key", "default"
            ) == "env_val_gras"

        with patch.dict(os.environ, {"NESL_SEL_MY_KEY": "env_val_nesl"}):
            assert get_selector("nesl", "my_key", "default") == "env_val_nesl"

        with patch.dict(os.environ, {"OTHER_SEL_CUSTOM_KEY": "env_val_other"}):
            assert get_selector(
                "other", "custom_key", "default"
            ) == "env_val_other"

    def test_get_selector_empty_env_var(self):
        """Test default fallback when env var is present & empty."""
        with patch.dict(os.environ, {"IGR_SEL_TEST_KEY": ""}):
            assert get_selector(
                "igr", "test_key", "default_value"
            ) == "default_value"

    def test_get_selector_none_default(self):
        """Test that get_selector handles None as a default value."""
        assert get_selector("igr", "missing_key", None) is None

    def test_get_selector_empty_default(self):
        """Test get_selector handles an empty string as default gracefully."""
        assert get_selector("igr", "missing_key", "") == ""
