"""
backend/app/routers/auth.py
Auth endpoints:
  POST /api/auth/login   — authenticate, set session_token cookie
  POST /api/auth/logout  — delete session row, clear cookie
  GET  /api/auth/me      — return current user info
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session as DBSession

from app.auth import create_session, get_current_user, verify_password
from app.database import get_db
from app.models import Session as SessionModel, User
from app.schemas import LoginRequest, UserOut

router = APIRouter(tags=["auth"])

_COOKIE_NAME = "session_token"
_COOKIE_MAX_AGE = 86400  # 24 h in seconds


# ─── POST /login ──────────────────────────────────────────────────────────────

@router.post("/login")
def login(
    body: LoginRequest,
    response: Response,
    db: DBSession = Depends(get_db),
):
    """
    Authenticate with username + password.
    On success: set httpOnly session_token cookie, return {user: {...}}.
    On failure: 401 {"detail": "Invalid username or password"}.
    """
    user: User | None = (
        db.query(User).filter(User.username == body.username).first()
    )
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_session(db, user)
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
    )
    return {"user": UserOut.model_validate(user)}


# ─── POST /logout ─────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Invalidate the current session and clear the cookie.
    Requires an active session (get_current_user raises 401 if not logged in).
    """
    token = request.cookies.get(_COOKIE_NAME)
    if token:
        session = db.query(SessionModel).filter(SessionModel.token == token).first()
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(key=_COOKIE_NAME)
    return {}


# ─── GET /me ──────────────────────────────────────────────────────────────────

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {"user": UserOut.model_validate(current_user)}
