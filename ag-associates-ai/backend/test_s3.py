import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError
from fastapi import HTTPException

# Need to set environment variables before importing the module
import os
os.environ['AWS_ACCESS_KEY_ID'] = 'test'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'test'
os.environ['AWS_REGION'] = 'ap-south-1'
os.environ['S3_BUCKET_NAME'] = 'test-bucket'

from utils import s3

def test_generate_presigned_upload_url_client_error():
    """Test that generate_presigned_upload_url handles ClientError and raises HTTPException."""

    # Create a mock error response that ClientError expects
    error_response = {
        'Error': {
            'Code': 'InternalError',
            'Message': 'Internal Server Error'
        }
    }

    # Create the ClientError exception
    mock_error = ClientError(error_response, 'generate_presigned_url')

    # Mock the s3_client.generate_presigned_url method to raise the ClientError
    with patch.object(s3.s3_client, 'generate_presigned_url', side_effect=mock_error):
        with pytest.raises(HTTPException) as exc_info:
            s3.generate_presigned_upload_url("test-object.pdf")

        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == "Could not generate secure document upload link."
