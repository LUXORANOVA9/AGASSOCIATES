import pytest
from unittest.mock import patch

import conversation_store

def test_get_user_identities_error():
    """Test get_user_identities returns an empty list on DB exception."""

    with patch('conversation_store._conn') as mock_conn:
        # Mocking context manager properly for _conn()
        mock_conn.return_value.__enter__.side_effect = Exception("Mocked DB connection error")

        result = conversation_store.get_user_identities("user_123")

        assert result == []
