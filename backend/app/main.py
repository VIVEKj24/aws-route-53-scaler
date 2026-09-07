"""
backend/app/main.py
FastAPI application entry-point.

Phase 0: CORS + health check
Phase 1: database create_all on startup
Phase 2: auth router (/api/auth/*)
Phase 3: hosted-zones CRUD (/api/hosted-zones/*)
Phase 4: records CRUD (/api/hosted-zones/{zone_id}/records/*)
"""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.auth import get_current_user
from app.database import Base, engine, get_db
from app.models import HostedZone, Record, Session, User  # noqa: F401 — register models
from app.routers import auth as auth_router
from app.routers import hosted_zones as zones_router
from app.routers import records as records_router

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
app.include_router(zones_router.router, prefix="/api/hosted-zones")
app.include_router(
    records_router.router,
    prefix="/api/hosted-zones/{zone_id}/records",
)

# ─── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe — returns {\"status\": \"ok\"}."""
    return {"status": "ok"}


# ─── Statistics (Phase 8) ──────────────────────────────────────────────────────

@app.get("/api/stats", tags=["stats"])
def get_stats(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
) -> dict[str, int]:
    """Return total counts of hosted zones and DNS records."""
    zones_count = db.query(func.count(HostedZone.id)).scalar() or 0
    records_count = db.query(func.count(Record.id)).scalar() or 0
    return {
        "hosted_zones": zones_count,
        "records": records_count,
    }
