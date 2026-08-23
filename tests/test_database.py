import os
import tempfile
import pytest
from src.core.database import (
    init_db,
    create_user,
    get_user,
    hash_password,
    verify_password,
    save_scan,
    get_all_scans,
)


@pytest.fixture
def test_db():
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "test_guardian.db")
    init_db(db_file)
    yield db_file
    # Cleanup safely
    try:
        if os.path.exists(db_file):
            os.remove(db_file)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
    except Exception:
        pass


def test_password_hashing():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    
    assert ":" in hashed
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_user_creation_and_auth(test_db):
    assert create_user("alice", "password123", db_path=test_db) is True
    # Duplicate registration should return False
    assert create_user("alice", "different_pass", db_path=test_db) is False

    user = get_user("alice", "password123", db_path=test_db)
    assert user is not None
    assert user["username"] == "alice"

    # Wrong credentials
    assert get_user("alice", "wrong_pass", db_path=test_db) is None
    assert get_user("nonexistent", "password", db_path=test_db) is None


def test_scan_saving_and_user_filtering(test_db):
    # Save scans for alice and bob
    save_scan(
        scan_id="scan001",
        sender="alice_friend@example.com",
        subject="Project Update",
        link_count=2,
        risk_level="SAFE",
        risk_score=10,
        reasons=["No threats detected"],
        username="alice",
        db_path=test_db
    )
    
    save_scan(
        scan_id="scan002",
        sender="scammer@fakebank.com",
        subject="Account Suspended",
        link_count=1,
        risk_level="HIGH",
        risk_score=85,
        reasons=["Spoofed link", "Urgency phrase"],
        username="bob",
        db_path=test_db
    )

    # Filter for alice
    alice_scans = get_all_scans(username="alice", db_path=test_db)
    assert len(alice_scans) == 1
    assert alice_scans[0]["scan_id"] == "scan001"
    assert alice_scans[0]["username"] == "alice"
    assert alice_scans[0]["risk_score"] == 10
    assert "No threats detected" in alice_scans[0]["reasons"]

    # Filter for bob
    bob_scans = get_all_scans(username="bob", db_path=test_db)
    assert len(bob_scans) == 1
    assert bob_scans[0]["scan_id"] == "scan002"
    assert bob_scans[0]["risk_level"] == "HIGH"

    # All scans
    all_scans = get_all_scans(username=None, db_path=test_db)
    assert len(all_scans) == 2

