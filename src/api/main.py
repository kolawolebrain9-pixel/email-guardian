from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from src.core.database import init_db, save_scan, get_all_scans, create_user, get_user
from src.core.email_parser.parser import EmailParser
from src.core.verifier.analyzer import EmailThreatAnalyzer

STATIC_FILE_PATH = Path(__file__).resolve().parent / "static" / "index.html"
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema upon server startup
    init_db()
    yield


app = FastAPI(
    title="Email Guardian",
    description="Intelligent Email Phishing and Threat Analysis API",
    version="1.0.0",
    lifespan=lifespan
)

email_parser = EmailParser()
threat_analyzer = EmailThreatAnalyzer()


# Pydantic Schemas
class ScanResult(BaseModel):
    scan_id: str
    sender: str
    subject: str
    link_count: int
    risk_level: str
    risk_score: int
    reasons: List[str] = []
    links: List[str] = []


class UserAuth(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class ScanHistoryItem(BaseModel):
    id: int
    scan_id: str
    sender: str
    subject: str
    link_count: int
    risk_level: str
    risk_score: int
    reasons: List[str] = []
    created_at: str


class StatsResponse(BaseModel):
    total_scans: int
    high_risk: int
    medium_risk: int
    safe: int


@app.post("/scan", response_model=ScanResult)
async def scan_email(
    file: UploadFile = File(...),
    username: str = Query(default="anonymous", max_length=50)
):
    """Parse and analyze an uploaded .eml or email file for threats."""
    raw_email = await file.read()
    
    if len(raw_email) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10 MB maximum limit."
        )

    if not raw_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 1. Parse email components
    parsed = email_parser.parse(raw_email)

    # 2. Multi-factor threat analysis
    analysis = threat_analyzer.analyze(parsed)

    # 3. Generate unique scan ID
    scan_id = uuid.uuid4().hex[:12]

    # 4. Persist to database
    save_scan(
        scan_id=scan_id,
        sender=parsed.sender,
        subject=parsed.subject,
        link_count=len(parsed.links),
        risk_level=analysis.risk_level,
        risk_score=analysis.risk_score,
        reasons=analysis.reasons,
        username=username.strip() or "anonymous"
    )

    return ScanResult(
        scan_id=scan_id,
        sender=parsed.sender,
        subject=parsed.subject or "(No Subject)",
        link_count=len(parsed.links),
        risk_level=analysis.risk_level,
        risk_score=analysis.risk_score,
        reasons=analysis.reasons,
        links=parsed.links
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "Email Guardian"}


@app.get("/history", response_model=List[ScanHistoryItem])
async def get_history(username: Optional[str] = Query(default=None)):
    """Retrieve scan history, optionally filtered by username."""
    scans = get_all_scans(username=username)
    return [
        ScanHistoryItem(
            id=s["id"],
            scan_id=s["scan_id"],
            sender=s["sender"],
            subject=s["subject"],
            link_count=s["link_count"],
            risk_level=s["risk_level"],
            risk_score=s["risk_score"],
            reasons=s["reasons"],
            created_at=s["created_at"]
        )
        for s in scans
    ]


@app.get("/stats", response_model=StatsResponse)
async def get_stats(username: Optional[str] = Query(default=None)):
    """Retrieve aggregate scan statistics."""
    scans = get_all_scans(username=username)
    total = len(scans)
    high = sum(1 for s in scans if s["risk_level"] == "HIGH")
    medium = sum(1 for s in scans if s["risk_level"] == "MEDIUM")
    safe = sum(1 for s in scans if s["risk_level"] == "SAFE")

    return StatsResponse(
        total_scans=total,
        high_risk=high,
        medium_risk=medium,
        safe=safe
    )


@app.get("/", response_class=HTMLResponse)
async def home():
    """Serve the single-page dashboard HTML."""
    if not STATIC_FILE_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Static frontend dashboard file not found."
        )
    with open(STATIC_FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()


@app.post("/register")
async def register(user: UserAuth):
    """Register a new user account."""
    username = user.username.strip()
    if not username or not user.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required."
        )

    success = create_user(username, user.password)
    if success:
        return {"message": "User registered successfully", "username": username}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Username already exists"
    )


@app.post("/login")
async def login(user: UserAuth):
    """Authenticate a user account."""
    user_record = get_user(user.username.strip(), user.password)
    if user_record:
        return {"message": "Login successful", "username": user_record["username"]}
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password"
    )