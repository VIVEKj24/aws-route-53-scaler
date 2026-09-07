"""
backend/app/schemas.py
Pydantic v2 request/response schemas.

Key serialisation note
----------------------
RecordOut.values is a list[str] — it is populated from Record.values_json via
the model_validator so callers never see the raw JSON string.
"""
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


# ─── Shared config ────────────────────────────────────────────────────────────

class _ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── User ─────────────────────────────────────────────────────────────────────

class UserOut(_ORMBase):
    id: int
    username: str
    is_active: bool

    @computed_field  # type: ignore[misc]
    @property
    def display_name(self) -> str:
        """Derived from username until a dedicated column is added."""
        return self.username


class LoginRequest(BaseModel):
    username: str
    password: str


# ─── HostedZone ───────────────────────────────────────────────────────────────

class HostedZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    comment: str | None = None


class HostedZoneUpdate(BaseModel):
    comment: str | None = None


class HostedZoneOut(_ORMBase):
    id: int
    name: str
    comment: str | None
    record_count: int = 0

    @model_validator(mode="before")
    @classmethod
    def compute_record_count(cls, data: Any) -> Any:
        """Populate record_count from the ORM relationship list if present."""
        if hasattr(data, "records"):
            data.__dict__["record_count"] = len(data.records)
        return data


class PaginatedHostedZones(BaseModel):
    items: list[HostedZoneOut]
    total: int
    page: int
    page_size: int


# ─── Record ───────────────────────────────────────────────────────────────────

class RecordCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern=r"^(A|AAAA|CNAME|MX|NS|PTR|SOA|SRV|TXT)$")
    ttl: int = Field(300, ge=0)
    values: list[str] = Field(..., min_length=1)
    is_default: bool = False


class RecordUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    ttl: int | None = Field(None, ge=0)
    values: list[str] | None = None


class RecordOut(_ORMBase):
    id: int
    hosted_zone_id: int
    name: str
    type: str
    ttl: int
    values: list[str]
    is_default: bool

    @model_validator(mode="before")
    @classmethod
    def deserialise_values(cls, data: Any) -> Any:
        """
        Convert values_json (str from ORM) → list[str].
        Works whether data is an ORM object or a plain dict.
        """
        if hasattr(data, "values_json"):
            # ORM object: use the .values property
            raw = data.values_json
            try:
                data.__dict__["values"] = json.loads(raw)
            except (TypeError, json.JSONDecodeError):
                data.__dict__["values"] = []
        elif isinstance(data, dict) and "values_json" in data and "values" not in data:
            try:
                data["values"] = json.loads(data["values_json"])
            except (TypeError, json.JSONDecodeError):
                data["values"] = []
        return data


class PaginatedRecords(BaseModel):
    items: list[RecordOut]
    total: int
    page: int
    page_size: int
