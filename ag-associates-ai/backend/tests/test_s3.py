import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError
from fastapi import HTTPException

# Need to mock os.environ before importing utils.s3 to ensure boto3.client uses our mocked vars (though boto3.client itself is evaluated on import)
with patch.dict('os.environ', {'AWS_ACCESS_KEY_ID': 'test_key', 'AWS_SECRET_ACCESS_KEY': 'test_secret', 'AWS_REGION': 'us-east-1', 'S3_BUCKET_NAME': 'test-bucket'}):
    from utils.s3 import generate_presigned_url, generate_presigned_upload_url, BUCKET_NAME

@patch('utils.s3.s3_client')
def test_generate_presigned_url_success(mock_s3_client):
    expected_url = "https://test-bucket.s3.amazonaws.com/test-object?AWSAccessKeyId=test_key&Expires=60"
    mock_s3_client.generate_presigned_url.return_value = expected_url

    url = generate_presigned_url("test-object", 60)

    assert url == expected_url
    mock_s3_client.generate_presigned_url.assert_called_once_with(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': "test-object"},
        ExpiresIn=60
    )

@patch('utils.s3.s3_client')
def test_generate_presigned_url_client_error(mock_s3_client):
    mock_s3_client.generate_presigned_url.side_effect = ClientError(
        error_response={'Error': {'Code': '500', 'Message': 'Error'}},
        operation_name='generate_presigned_url'
    )

    with pytest.raises(HTTPException) as exc_info:
        generate_presigned_url("test-object", 60)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Could not generate secure document link."
    mock_s3_client.generate_presigned_url.assert_called_once()

@patch('utils.s3.s3_client')
def test_generate_presigned_upload_url_success(mock_s3_client):
    expected_url = "https://test-bucket.s3.amazonaws.com/test-object-upload?AWSAccessKeyId=test_key&Expires=120"
    mock_s3_client.generate_presigned_url.return_value = expected_url

    url = generate_presigned_upload_url("test-object-upload", 120)

    assert url == expected_url
    mock_s3_client.generate_presigned_url.assert_called_once_with(
        'put_object',
        Params={'Bucket': BUCKET_NAME, 'Key': "test-object-upload"},
        ExpiresIn=120
    )

@patch('utils.s3.s3_client')
def test_generate_presigned_upload_url_client_error(mock_s3_client):
    mock_s3_client.generate_presigned_url.side_effect = ClientError(
        error_response={'Error': {'Code': '500', 'Message': 'Error'}},
        operation_name='generate_presigned_url'
    )

    with pytest.raises(HTTPException) as exc_info:
        generate_presigned_upload_url("test-object-upload", 120)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Could not generate secure document upload link."
    mock_s3_client.generate_presigned_url.assert_called_once()
