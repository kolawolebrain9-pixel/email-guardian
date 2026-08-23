import io
import os
import tempfile
from fastapi.testclient import TestClient
import pytest

from src.core.database import init_db
from src.api.main import app


@pytest.fixture(autouse=True)
def setup_temp_db(monkeypatch):
    temp_dir = tempfile.mkdtemp()
    test_db = os.path.join(temp_dir, "api_test.db")
    init_db(test_db)
    monkeypatch.setenv("EMAIL_GUARDIAN_DB_PATH", test_db)
    yield test_db
    try:
        if os.path.exists(test_db):
            os.remove(test_db)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
    except Exception:
        pass


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_auth_workflow(client):
    # Register
    reg = client.post("/register", json={"username": "bob", "password": "secure_pass_123"})
    assert reg.status_code == 200
    assert reg.json()["username"] == "bob"

    # Duplicate register should fail
    dup = client.post("/register", json={"username": "bob", "password": "secure_pass_123"})
    assert dup.status_code == 400

    # Successful login
    login_ok = client.post("/login", json={"username": "bob", "password": "secure_pass_123"})
    assert login_ok.status_code == 200

    # Failed login
    login_bad = client.post("/login", json={"username": "bob", "password": "wrong_password"})
    assert login_bad.status_code == 401


def test_scan_history_and_stats(client):
    sample_email = (
        b"From: billing@trusted.com\n"
        b"Subject: Your Monthly Receipt\n"
        b"Content-Type: text/plain\n\n"
        b"Thank you for your business. Visit https://trusted.com/invoices"
    )

    # 1. Scan email under user 'carol'
    file_payload = {"file": ("invoice.eml", io.BytesIO(sample_email), "message/rfc822")}
    scan_resp = client.post("/scan?username=carol", files=file_payload)
    
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["subject"] == "Your Monthly Receipt"
    assert scan_data["risk_level"] == "SAFE"
    assert scan_data["link_count"] == 1
    assert "https://trusted.com/invoices" in scan_data["links"]

    # 2. Check history for carol
    hist_resp = client.get("/history?username=carol")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 1
    assert history[0]["subject"] == "Your Monthly Receipt"

    # 3. Check stats for carol
    stats_resp = client.get("/stats?username=carol")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_scans"] == 1
    assert stats["safe"] == 1
    assert stats["high_risk"] == 0

    # 4. History for a different user should be empty
    other_hist = client.get("/history?username=dave")
    assert other_hist.status_code == 200
    assert len(other_hist.json()) == 0

