"""
backend/app/models.py
SQLAlchemy ORM models: User, Session, HostedZone, Record.

Column notes
------------
- Record.values_json  : TEXT column storing a JSON-encoded list[str]
- Record.values       : Python property that transparently (de)serialises values_json
"""
import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ─── helpers ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )


# ─── Session ──────────────────────────────────────────────────────────────────

class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="sessions")


# ─── HostedZone ───────────────────────────────────────────────────────────────

class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    records: Mapped[list["Record"]] = relationship(
        "Record", back_populates="hosted_zone", cascade="all, delete-orphan"
    )


# ─── Record ───────────────────────────────────────────────────────────────────

_VALID_TYPES = ("A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SOA", "SRV", "TXT")

class Record(Base):
    __tablename__ = "records"

    __table_args__ = (
        UniqueConstraint("hosted_zone_id", "name", "type", name="uq_record_zone_name_type"),
        CheckConstraint(
            f"type IN {_VALID_TYPES}",
            name="ck_record_valid_type",
        ),
        Index("ix_records_zone_name_type", "hosted_zone_id", "name", "type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hosted_zone_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("hosted_zones.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    ttl: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    # Stored as JSON array string; use the .values property instead of this column directly
    values_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    hosted_zone: Mapped["HostedZone"] = relationship(
        "HostedZone", back_populates="records"
    )

    # ── Python-level (de)serialisation of values ───────────────────────────────

    @property
    def values(self) -> list[str]:
        """Return values_json decoded as a list of strings."""
        try:
            return json.loads(self.values_json)
        except (TypeError, json.JSONDecodeError):
            return []

    @values.setter
    def values(self, v: list[str]) -> None:
        """Accept a list of strings and serialise to values_json."""
        self.values_json = json.dumps(v)
