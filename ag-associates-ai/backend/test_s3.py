import pytest
from unittest.mock import patch
from botocore.exceptions import ClientError
from fastapi import HTTPException
from utils.s3 import generate_presigned_url, generate_presigned_upload_url

class TestS3Utils:
    @patch('utils.s3.s3_client.generate_presigned_url')
    def test_generate_presigned_url_success(self, mock_generate):
        mock_generate.return_value = "https://mock-url.com"
        result = generate_presigned_url("test_file.txt")
        assert result == "https://mock-url.com"

    @patch('utils.s3.s3_client.generate_presigned_url')
    def test_generate_presigned_url_client_error(self, mock_generate):
        mock_generate.side_effect = ClientError(
            error_response={'Error': {'Code': '500', 'Message': 'Error'}},
            operation_name='generate_presigned_url'
        )
        with pytest.raises(HTTPException) as exc_info:
            generate_presigned_url("test_file.txt")

        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == "Could not generate secure document link."

    @patch('utils.s3.s3_client.generate_presigned_url')
    def test_generate_presigned_upload_url_success(self, mock_generate):
        mock_generate.return_value = "https://mock-upload-url.com"
        result = generate_presigned_upload_url("test_file.txt")
        assert result == "https://mock-upload-url.com"

    @patch('utils.s3.s3_client.generate_presigned_url')
    def test_generate_presigned_upload_url_client_error(self, mock_generate):
        mock_generate.side_effect = ClientError(
            error_response={'Error': {'Code': '500', 'Message': 'Error'}},
            operation_name='generate_presigned_url'
        )
        with pytest.raises(HTTPException) as exc_info:
            generate_presigned_upload_url("test_file.txt")

        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == "Could not generate secure document upload link."
