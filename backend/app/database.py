"""
backend/app/database.py
SQLAlchemy engine, session factory, declarative base, and get_db() dependency.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./route53.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ─── FastAPI dependency ────────────────────────────────────────────────────────

def get_db():
    """Yield a DB session; always close it when the request is done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
