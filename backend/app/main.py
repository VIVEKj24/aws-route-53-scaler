"""
backend/app/main.py
FastAPI application entry-point.

Phase 0: CORS + health check
Phase 1: database create_all on startup (routers, models added here in Phase 2+)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import HostedZone, Record, Session, User  # noqa: F401 — register models

# ─── Create all tables on startup ─────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Scaler API", version="0.1.0")

# ─── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe — returns {\"status\": \"ok\"}."""
    return {"status": "ok"}
