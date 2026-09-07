"""
backend/app/main.py
FastAPI application entry-point.

Phase 0: CORS + health check
Phase 1: database create_all on startup
Phase 2: auth router (/api/auth/login, /logout, /me)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import HostedZone, Record, Session, User  # noqa: F401 — register models
from app.routers import auth as auth_router

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

# ─── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router, prefix="/api/auth")

# ─── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe — returns {\"status\": \"ok\"}."""
    return {"status": "ok"}
