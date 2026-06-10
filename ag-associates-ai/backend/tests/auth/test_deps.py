import pytest
import respx
import httpx
from fastapi import HTTPException
from auth.deps import _fetch_role, require_auth, require_permission
from auth.rbac import AuthContext, Role

pytestmark = pytest.mark.asyncio

@respx.mock
async def test_fetch_role_success(monkeypatch):
    """Test successful fetching of role from Supabase."""
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-key")

    email = "test@example.com"

    # Mock the Supabase API response
    respx.get(
        "https://mock.supabase.co/rest/v1/profiles",
        params={"select": "role", "email": f"eq.{email}"}
    ).mock(return_value=httpx.Response(200, json=[{"role": "ADVOCATE"}]))

    role = await _fetch_role(email)
    assert role == Role.ADVOCATE

async def test_fetch_role_no_credentials(monkeypatch):
    """Test _fetch_role when Supabase credentials are missing."""
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")

    role = await _fetch_role("test@example.com")
    assert role == Role.BANK_VIEWER

@respx.mock
async def test_fetch_role_http_error(monkeypatch):
    """Test _fetch_role when Supabase returns an error."""
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-key")

    email = "test@example.com"

    # Mock a 500 server error
    respx.get("https://mock.supabase.co/rest/v1/profiles").mock(
        return_value=httpx.Response(500)
    )

    role = await _fetch_role(email)
    assert role == Role.BANK_VIEWER

@respx.mock
async def test_fetch_role_empty_response(monkeypatch):
    """Test _fetch_role when Supabase returns empty JSON array."""
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-key")

    email = "test@example.com"

    # Mock empty json response
    respx.get("https://mock.supabase.co/rest/v1/profiles").mock(
        return_value=httpx.Response(200, json=[])
    )

    role = await _fetch_role(email)
    assert role == Role.BANK_VIEWER

@respx.mock
async def test_fetch_role_missing_role_key(monkeypatch):
    """Test _fetch_role when Supabase response lacks the role key."""
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-key")

    email = "test@example.com"

    # Mock response without role key
    respx.get("https://mock.supabase.co/rest/v1/profiles").mock(
        return_value=httpx.Response(200, json=[{"other_key": "value"}])
    )

    role = await _fetch_role(email)
    assert role == Role.BANK_VIEWER

async def test_require_auth(monkeypatch):
    """Test require_auth successfully creates an AuthContext."""
    async def mock_fetch_role(email):
        return Role.EXECUTIVE

    import auth.deps
    monkeypatch.setattr(auth.deps, "_fetch_role", mock_fetch_role)

    mock_user = {
        "sub": "user@example.com",
        "name": "Test User"
    }

    auth_ctx = await require_auth(user=mock_user)
    assert isinstance(auth_ctx, AuthContext)
    assert auth_ctx.user_id == "user@example.com"
    assert auth_ctx.role == Role.EXECUTIVE
    assert auth_ctx.name == "Test User"

async def test_require_auth_missing_fields(monkeypatch):
    """Test require_auth with missing user fields."""
    async def mock_fetch_role(email):
        return Role.BANK_VIEWER

    import auth.deps
    monkeypatch.setattr(auth.deps, "_fetch_role", mock_fetch_role)

    mock_user = {}  # Empty dict, simulating missing sub and name

    auth_ctx = await require_auth(user=mock_user)
    assert isinstance(auth_ctx, AuthContext)
    assert auth_ctx.user_id == ""
    assert auth_ctx.role == Role.BANK_VIEWER
    assert auth_ctx.name == ""

async def test_require_permission_success():
    """Test require_permission allows access with sufficient role."""
    auth_ctx = AuthContext(
        user_id="test@example.com",
        role=Role.PRINCIPAL, # Principal can do anything
        name="Principal User"
    )

    # Create the dependency checker function
    checker = require_permission("case.create")

    # Should run without raising an exception
    await checker(auth=auth_ctx)

async def test_require_permission_denied():
    """Test require_permission raises HTTPException when role is insufficient."""
    auth_ctx = AuthContext(
        user_id="test@example.com",
        role=Role.BANK_VIEWER, # Bank viewer cannot create cases
        name="Bank Viewer User"
    )

    # Create the dependency checker function
    checker = require_permission("case.create")

    # Should raise HTTP 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await checker(auth=auth_ctx)

    assert exc_info.value.status_code == 403
    assert "Permission denied: case.create requires role >=" in exc_info.value.detail

@respx.mock
async def test_fetch_role_exception(monkeypatch):
    """Test _fetch_role when httpx throws an exception."""
    monkeypatch.setenv("SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-key")

    email = "test@example.com"

    # Mock httpx to raise a RequestError
    respx.get("https://mock.supabase.co/rest/v1/profiles").mock(
        side_effect=httpx.RequestError("Mocked request error")
    )

    role = await _fetch_role(email)
    assert role == Role.BANK_VIEWER
