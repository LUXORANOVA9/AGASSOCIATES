import os
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

# Initialize S3 client using environment variables configured on the backend
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-south-1')
)
BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'luxor9-document-vault')

def generate_presigned_url(object_name: str, expiration: int = 60) -> str:
    """
    Generate a presigned URL to share an S3 object securely.

    `expiration` defaults to 60 seconds for zero-trust access; callers may
    override it to set a different TTL on the returned URL.
    """
    try:
        response = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': object_name},
            ExpiresIn=expiration
        )
    except ClientError as e:
        logger.error(f"S3 ClientError generating presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate secure document link.")
    return response

def generate_presigned_upload_url(object_name: str, expiration: int = 60) -> str:
    """
    Generate a presigned URL to upload an S3 object securely.

    `expiration` defaults to 60 seconds; callers may override it for longer
    upload windows.
    """
    try:
        response = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': BUCKET_NAME, 'Key': object_name},
            ExpiresIn=expiration
        )
    except ClientError as e:
        logger.error(f"S3 ClientError generating presigned upload URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate secure document upload link.")
    return response
