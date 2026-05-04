from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from config import SUPABASE_JWT_SECRET
import logging

logger = logging.getLogger(__name__)

# Security scheme for bearer token
security = HTTPBearer(auto_error=False)

def verify_supabase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Verify Supabase JWT token and extract user information.
    If SUPABASE_JWT_SECRET is not set, it bypasses authentication (for local dev).
    """
    if not SUPABASE_JWT_SECRET:
        logger.warning("SUPABASE_JWT_SECRET not configured. Bypassing authentication.")
        return {"sub": "anonymous", "role": "anon"}
        
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = credentials.credentials
    
    try:
        # Decode JWT using Supabase JWT secret
        # Supabase uses HS256 for signing tokens
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid JWT token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(payload: dict = Depends(verify_supabase_token)) -> dict:
    """Dependency to get current authenticated user."""
    return payload
