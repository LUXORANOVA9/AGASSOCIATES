import pytest
import os
import config
from importlib import reload

def test_get_database_url_default(monkeypatch):
    monkeypatch.delenv("DATABASE_HOST", raising=False)
    monkeypatch.delenv("DATABASE_PORT", raising=False)
    monkeypatch.delenv("DATABASE_NAME", raising=False)
    monkeypatch.delenv("DATABASE_USER", raising=False)
    monkeypatch.delenv("DATABASE_PASSWORD", raising=False)

    reload(config)
    assert config.get_database_url() == "postgresql://ag_admin:secure_password_123@localhost:5432/legal_templates_db"

def test_get_database_url_custom_env_vars(monkeypatch):
    monkeypatch.setenv("DATABASE_HOST", "mydb.example.com")
    monkeypatch.setenv("DATABASE_PORT", "5433")
    monkeypatch.setenv("DATABASE_NAME", "custom_db")
    monkeypatch.setenv("DATABASE_USER", "custom_user")
    monkeypatch.setenv("DATABASE_PASSWORD", "supersecret")

    reload(config)
    assert config.get_database_url() == "postgresql://custom_user:supersecret@mydb.example.com:5433/custom_db"

def test_get_database_url_direct_patch(monkeypatch):
    monkeypatch.setattr(config, "DATABASE_HOST", "testhost")
    monkeypatch.setattr(config, "DATABASE_PORT", "1234")
    monkeypatch.setattr(config, "DATABASE_NAME", "testdb")
    monkeypatch.setattr(config, "DATABASE_USER", "testuser")
    monkeypatch.setattr(config, "DATABASE_PASSWORD", "testpass")

    assert config.get_database_url() == "postgresql://testuser:testpass@testhost:1234/testdb"
