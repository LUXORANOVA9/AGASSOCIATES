import pytest
from unittest.mock import MagicMock, patch
import sys

# Patch psycopg2 before importing conversation_store
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()

import conversation_store

@pytest.fixture
def mock_db_conn():
    with patch('conversation_store._conn') as mock_conn_func:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # Setup context managers
        mock_conn_func.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        yield mock_conn, mock_cursor

class TestConversationStore:
    def test_resolve_user_existing(self, mock_db_conn):
        mock_conn, mock_cursor = mock_db_conn

        # Setup mock to return an existing user
        mock_cursor.fetchone.return_value = {"user_id": "test-uuid-123"}

        user_id = conversation_store.resolve_user(
            platform="whatsapp",
            platform_identity="1234567890",
            display_name="Test User"
        )

        assert user_id == "test-uuid-123"
        # Check that SELECT was called
        assert mock_cursor.execute.call_args_list[0][0][0].startswith("SELECT user_id")
        # Check that UPDATE was called for display_name
        assert mock_cursor.execute.call_args_list[1][0][0].startswith("UPDATE user_identity_map")
        assert mock_conn.commit.called

    def test_resolve_user_new(self, mock_db_conn):
        mock_conn, mock_cursor = mock_db_conn

        # Setup mock to return no existing user
        mock_cursor.fetchone.return_value = None

        with patch('uuid.uuid4') as mock_uuid:
            mock_uuid.return_value = "new-uuid-456"

            user_id = conversation_store.resolve_user(
                platform="telegram",
                platform_identity="test_user",
                metadata={"role": "admin"}
            )

            assert user_id == "new-uuid-456"
            # Check that SELECT was called
            assert mock_cursor.execute.call_args_list[0][0][0].startswith("SELECT user_id")
            # Check that INSERT was called
            assert mock_cursor.execute.call_args_list[1][0][0].strip().startswith("INSERT INTO user_identity_map")
            # Verify correct parameters were passed to INSERT
            insert_args = mock_cursor.execute.call_args_list[1][0][1]
            assert insert_args[0] == "new-uuid-456"
            assert insert_args[1] == "telegram"
            assert insert_args[2] == "test_user"
            assert insert_args[3] == "test_user" # fallback for display_name
            assert "admin" in insert_args[4] # metadata json string
            assert mock_conn.commit.called

    def test_resolve_user_db_error(self, mock_db_conn):
        mock_conn, mock_cursor = mock_db_conn

        # Make the execute raise an exception
        mock_cursor.execute.side_effect = Exception("DB Connection failed")

        # Should gracefully return a fallback string
        user_id = conversation_store.resolve_user(
            platform="web",
            platform_identity="session_123"
        )

        assert user_id == "web:session_123"
