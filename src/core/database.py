from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
from datetime import datetime
from typing import List, Optional, Dict, Any, Generator

# Root database path ensures consistent location regardless of working directory
DEFAULT_DB_PATH = str(Path(__file__).resolve().parent.parent.parent / "email_guardian.db")


def get_db_path(custom_path: Optional[str] = None) -> str:
    return custom_path or os.getenv("EMAIL_GUARDIAN_DB_PATH", DEFAULT_DB_PATH)


@contextmanager
def db_session(db_path: Optional[str] = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite connections ensuring proper commit and closure."""
    conn = sqlite3.connect(get_db_path(db_path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256 and a random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return f"{salt}:{key.hex()}"


def verify_password(password: str, stored_password: str) -> bool:
    """Verify password against stored salt:hash format or legacy plaintext."""
    if not stored_password:
        return False
    
    if ":" in stored_password:
        salt, stored_hash = stored_password.split(":", 1)
        candidate_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        ).hex()
        return secrets.compare_digest(candidate_key, stored_hash)
    
    # Fallback comparison for legacy plaintext during development
    return secrets.compare_digest(password, stored_password)


def init_db(db_path: Optional[str] = None) -> None:
    """Initialize database tables and add missing columns if upgrading."""
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        
        # Scans table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id TEXT UNIQUE,
                sender TEXT,
                subject TEXT,
                link_count INTEGER,
                risk_level TEXT,
                risk_score INTEGER DEFAULT 0,
                reasons TEXT DEFAULT '[]',
                created_at TEXT,
                username TEXT
            )
        """)
        
        # Check and add columns if upgrading existing older database
        cursor.execute("PRAGMA table_info(scans)")
        existing_cols = {col["name"] for col in cursor.fetchall()}
        
        if "risk_score" not in existing_cols:
            cursor.execute("ALTER TABLE scans ADD COLUMN risk_score INTEGER DEFAULT 0")
        if "reasons" not in existing_cols:
            cursor.execute("ALTER TABLE scans ADD COLUMN reasons TEXT DEFAULT '[]'")
        if "username" not in existing_cols:
            cursor.execute("ALTER TABLE scans ADD COLUMN username TEXT")

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT
            )
        """)


def save_scan(
    scan_id: str,
    sender: str,
    subject: str,
    link_count: int,
    risk_level: str,
    risk_score: int = 0,
    reasons: Optional[List[str]] = None,
    username: str = "anonymous",
    db_path: Optional[str] = None
) -> None:
    """Persist an email scan result associated with the given username."""
    reasons_json = json.dumps(reasons or [])
    created_at = datetime.now().isoformat()
    
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scans (scan_id, sender, subject, link_count, risk_level, risk_score, reasons, created_at, username)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (scan_id, sender, subject, link_count, risk_level, risk_score, reasons_json, created_at, username))


def get_all_scans(username: Optional[str] = None, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve all scans, optionally filtered by username."""
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        if username and username != "":
            cursor.execute(
                "SELECT * FROM scans WHERE username = ? ORDER BY id DESC",
                (username,)
            )
        else:
            cursor.execute("SELECT * FROM scans ORDER BY id DESC")
        
        rows = cursor.fetchall()
        scans = []
        for row in rows:
            reasons_raw = row["reasons"] if "reasons" in row.keys() else "[]"
            try:
                reasons_list = json.loads(reasons_raw) if reasons_raw else []
            except Exception:
                reasons_list = []
                
            scans.append({
                "id": row["id"],
                "scan_id": row["scan_id"],
                "sender": row["sender"] or "",
                "subject": row["subject"] or "(No Subject)",
                "link_count": row["link_count"] or 0,
                "risk_level": row["risk_level"] or "SAFE",
                "risk_score": row["risk_score"] if "risk_score" in row.keys() else 0,
                "reasons": reasons_list,
                "created_at": row["created_at"],
                "username": row["username"]
            })
        return scans


def create_user(username: str, password: str, db_path: Optional[str] = None) -> bool:
    """Create a new user with a hashed password. Returns True on success, False if user exists."""
    if not username or not password:
        return False
        
    hashed = hash_password(password)
    created_at = datetime.now().isoformat()
    
    try:
        with db_session(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)",
                (username.strip(), hashed, created_at)
            )
            return True
    except sqlite3.IntegrityError:
        return False


def get_user(username: str, password: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Authenticate and fetch user by username and password. Returns user dict or None."""
    if not username or not password:
        return None
        
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username.strip(),))
        user = cursor.fetchone()
        
        if user and verify_password(password, user["password"]):
            return {
                "id": user["id"],
                "username": user["username"],
                "created_at": user["created_at"]
            }
    return None