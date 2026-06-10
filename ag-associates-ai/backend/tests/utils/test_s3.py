import pytest
import os
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError
from fastapi import HTTPException

# Mock environment variables before importing s3
os.environ['AWS_ACCESS_KEY_ID'] = 'test-key'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
os.environ['AWS_REGION'] = 'us-east-1'
os.environ['S3_BUCKET_NAME'] = 'test-bucket'

from utils.s3 import generate_presigned_url, generate_presigned_upload_url, s3_client

class TestS3Utils:
    @patch.object(s3_client, 'generate_presigned_url')
    def test_generate_presigned_url_success(self, mock_generate):
        mock_generate.return_value = 'https://test-url.com/object'

        url = generate_presigned_url('test-object.pdf', 120)

        assert url == 'https://test-url.com/object'
        mock_generate.assert_called_once_with(
            'get_object',
            Params={'Bucket': 'test-bucket', 'Key': 'test-object.pdf'},
            ExpiresIn=120
        )

    @patch.object(s3_client, 'generate_presigned_url')
    def test_generate_presigned_url_default_expiration(self, mock_generate):
        mock_generate.return_value = 'https://test-url.com/object'

        url = generate_presigned_url('test-object.pdf')

        assert url == 'https://test-url.com/object'
        mock_generate.assert_called_once_with(
            'get_object',
            Params={'Bucket': 'test-bucket', 'Key': 'test-object.pdf'},
            ExpiresIn=60
        )

    @patch.object(s3_client, 'generate_presigned_url')
    def test_generate_presigned_url_client_error(self, mock_generate):
        mock_generate.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Internal Error'}},
            'generate_presigned_url'
        )

        with pytest.raises(HTTPException) as excinfo:
            generate_presigned_url('test-object.pdf')

        assert excinfo.value.status_code == 500
        assert excinfo.value.detail == "Could not generate secure document link."

    @patch.object(s3_client, 'generate_presigned_url')
    def test_generate_presigned_upload_url_success(self, mock_generate):
        mock_generate.return_value = 'https://test-url.com/upload'

        url = generate_presigned_upload_url('test-object.pdf', 300)

        assert url == 'https://test-url.com/upload'
        mock_generate.assert_called_once_with(
            'put_object',
            Params={'Bucket': 'test-bucket', 'Key': 'test-object.pdf'},
            ExpiresIn=300
        )

    @patch.object(s3_client, 'generate_presigned_url')
    def test_generate_presigned_upload_url_client_error(self, mock_generate):
        mock_generate.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Internal Error'}},
            'generate_presigned_url'
        )

        with pytest.raises(HTTPException) as excinfo:
            generate_presigned_upload_url('test-object.pdf')

        assert excinfo.value.status_code == 500
        assert excinfo.value.detail == "Could not generate secure document upload link."
