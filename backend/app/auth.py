"""
backend/app/auth.py
Auth helpers and the get_current_user FastAPI dependency.

Functions
---------
hash_password(plain)          -> str   bcrypt hash
verify_password(plain, hashed)-> bool  bcrypt verify
create_session(db, user)      -> str   insert Session row, return token
get_current_user(request, db) -> User  read cookie, validate session, return User
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Session as SessionModel, User

# ─── Password helpers ─────────────────────────────────────────────────────────

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*."""
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_ctx.verify(plain, hashed)


# ─── Session management ───────────────────────────────────────────────────────

_SESSION_TTL_HOURS = 24


def create_session(db: DBSession, user: User) -> str:
    """
    Insert a new Session row for *user*.

    Returns the opaque session token (uuid4 hex string) that the caller
    must set as an httpOnly cookie named ``session_token``.
    """
    token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_SESSION_TTL_HOURS)
    session = SessionModel(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    return token


# ─── Current-user dependency ──────────────────────────────────────────────────

def get_current_user(
    request: Request,
    db: DBSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency: validates the ``session_token`` cookie and returns
    the owning User.

    Raises HTTP 401 if:
    - the cookie is absent
    - the Session row does not exist
    - the session has expired (also deletes the stale row)
    """
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    session = db.query(SessionModel).filter(SessionModel.token == token).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    now = datetime.now(timezone.utc)
    # Normalise expires_at to aware datetime if SQLite stored it without tz
    exp = session.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    if now > exp:
        # Clean up the expired row
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    user = db.query(User).filter(User.id == session.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user
