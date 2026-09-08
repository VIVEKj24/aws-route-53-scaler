"""
backend/app/main.py
FastAPI application entry-point.

Phase 0: CORS + health check
Phase 1: database create_all on startup
Phase 2: auth router (/api/auth/*)
Phase 3: hosted-zones CRUD (/api/hosted-zones/*)
Phase 4: records CRUD (/api/hosted-zones/{zone_id}/records/*)
Post-phase: auto-seed on startup if DB is empty (self-healing for ephemeral filesystems)
"""
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.auth import get_current_user
from app.database import Base, SessionLocal, engine, get_db
from app.models import HostedZone, Record, Session, User  # noqa: F401 — register models
from app.routers import auth as auth_router
from app.routers import hosted_zones as zones_router
from app.routers import records as records_router


# ─── Lifespan: create tables + auto-seed if empty ─────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Run once on startup (before the server begins accepting requests):
    1. Create all SQLAlchemy tables (idempotent / no-op if they already exist).
    2. If the users table is empty, seed the database with demo data so the
       app self-heals after any restart on an ephemeral filesystem without
       requiring a manual `python -m app.seed` command.
    """
    # 1. Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # 2. Auto-seed if the DB is empty
    db = SessionLocal()
    try:
        user_count = db.query(func.count(User.id)).scalar() or 0
        if user_count == 0:
            from app.seed import seed  # imported here to avoid circular deps at module load
            print("[startup] Database is empty — seeding demo data …")
            seed(db)
            print("[startup] Seed complete.")
        else:
            print(f"[startup] Database already has {user_count} user(s) — skipping seed.")
    finally:
        db.close()

    yield  # server is now running


# ─── Application ───────────────────────────────────────────────────────────────

app = FastAPI(title="Scaler API", version="0.1.0", lifespan=lifespan)

# ─── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
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
