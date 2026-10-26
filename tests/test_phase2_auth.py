import pytest
from backend.auth import decode_access_token


def test_login_demo_user(client):
    response = client.post("/auth/login", json={
        "email": "demo@grasplab.dev",
        "password": "demo1234"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "demo@grasplab.dev"
    assert data["user"]["tenant_id"] == "demo-tenant"
    assert data["user"]["role"] == "Student"

    # Verify payload content
    payload = decode_access_token(data["access_token"])
    assert payload["tenant_id"] == "demo-tenant"
    assert payload["role"] == "Student"


def test_login_invalid_password(client):
    response = client.post("/auth/login", json={
        "email": "demo@grasplab.dev",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_signup_flow(client):
    response = client.post("/auth/signup", json={
        "email": "prof.smith@grasplab.edu",
        "password": "password123",
        "company_name": "MIT CS Dept",
        "role": "Instructor"
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["tenant_id"] == "mit-cs-dept"
    assert data["user"]["role"] == "Instructor"

    # Duplicate signup fails
    dup_response = client.post("/auth/signup", json={
        "email": "prof.smith@grasplab.edu",
        "password": "anotherpassword",
        "company_name": "MIT CS Dept",
        "role": "Instructor"
    })
    assert dup_response.status_code == 400


def test_verify_endpoint_authorized_and_unauthorized(client):
    # 1. Unauthorized without token
    unauth_resp = client.get("/auth/verify")
    assert unauth_resp.status_code == 401

    # 2. Login as demo
    login_resp = client.post("/auth/login", json={
        "email": "demo@grasplab.dev",
        "password": "demo1234"
    })
    token = login_resp.json()["access_token"]

    # 3. Verify with valid token
    verify_resp = client.get(
        "/auth/verify",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["valid"] is True
    assert verify_resp.json()["user"]["email"] == "demo@grasplab.dev"

    # 4. Verify with malformed token
    bad_resp = client.get(
        "/auth/verify",
        headers={"Authorization": "Bearer badtoken123"}
    )
    assert bad_resp.status_code == 401
