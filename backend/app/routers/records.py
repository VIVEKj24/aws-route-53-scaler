"""
backend/app/routers/records.py
DNS Record CRUD endpoints (Phase 4):
  GET    /api/hosted-zones/{zone_id}/records              — paginated list
  POST   /api/hosted-zones/{zone_id}/records              — create record
  PUT    /api/hosted-zones/{zone_id}/records/{record_id}  — update record
  DELETE /api/hosted-zones/{zone_id}/records/{record_id}  — delete record

All routes require an active session (get_current_user) and a valid zone_id (404 if missing).
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.auth import get_current_user
from app.database import get_db
from app.models import HostedZone, Record, User
from app.schemas import PaginatedRecords, RecordCreate, RecordOut, RecordUpdate
from app.validators.records import USER_ALLOWED_TYPES, validate_record

router = APIRouter(tags=["records"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_zone_or_404(zone_id: int, db: DBSession) -> HostedZone:
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if zone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hosted zone not found",
        )
    return zone


def _get_record_or_404(zone_id: int, record_id: int, db: DBSession) -> Record:
    record = (
        db.query(Record)
        .filter(Record.id == record_id, Record.hosted_zone_id == zone_id)
        .first()
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )
    return record


# ─── GET /{record_id} (get single) ───────────────────────────────────────────

@router.get("/{record_id}", response_model=RecordOut)
def get_record(
    zone_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return a single record by ID, or 404 if not found."""
    _get_zone_or_404(zone_id, db)
    return _get_record_or_404(zone_id, record_id, db)


# ─── GET / (list) ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedRecords)
def list_records(
    zone_id: int,
    search: str | None = Query(None, description="LIKE filter on record name"),
    type: str | None = Query(None, description="Exact match on record type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return a paginated list of records for *zone_id*."""
    _get_zone_or_404(zone_id, db)  # 404 if zone missing

    q = db.query(Record).filter(Record.hosted_zone_id == zone_id)
    if search:
        q = q.filter(Record.name.ilike(f"%{search}%"))
    if type:
        q = q.filter(Record.type == type.upper())

    total = q.count()
    items = q.order_by(Record.id).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedRecords(items=items, total=total, page=page, page_size=page_size)


# ─── POST / (create) ──────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=RecordOut)
def create_record(
    zone_id: int,
    body: RecordCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Create a new DNS record in *zone_id*.

    - SOA type is rejected (system-only).
    - Values are validated per-type; CNAME enforces exactly one value.
    - is_default is always False for user-created records.
    """
    _get_zone_or_404(zone_id, db)

    rtype = body.type.upper()
    if rtype not in USER_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Record type '{rtype}' is not allowed. "
                   f"Supported: {sorted(USER_ALLOWED_TYPES)}",
        )

    try:
        validate_record(rtype, body.values)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    record = Record(
        hosted_zone_id=zone_id,
        name=body.name,
        type=rtype,
        ttl=body.ttl,
        values_json=json.dumps(body.values),
        is_default=False,  # always false for user-created records
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ─── PUT /{record_id} (update) ────────────────────────────────────────────────

@router.put("/{record_id}", response_model=RecordOut)
def update_record(
    zone_id: int,
    record_id: int,
    body: RecordUpdate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Update a record.

    - Default records (is_default=True): only ttl may change.
      Attempts to change name or values return 400.
    - Non-default records: name, ttl, and values may all change.
    - values are re-validated against the record's existing type if provided.
    """
    _get_zone_or_404(zone_id, db)
    record = _get_record_or_404(zone_id, record_id, db)

    if record.is_default:
        if body.name is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change the name of a default record",
            )
        if body.values is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change the values of a default record",
            )

    if body.ttl is not None:
        record.ttl = body.ttl

    if body.name is not None:
        record.name = body.name

    if body.values is not None:
        try:
            validate_record(record.type, body.values)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        record.values_json = json.dumps(body.values)

    db.commit()
    db.refresh(record)
    return record


# ─── DELETE /{record_id} ──────────────────────────────────────────────────────

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    zone_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Delete a record.
    - Default records (is_default=True) cannot be deleted (400).
    - Returns 204 on success; 404 if record or zone doesn't exist.
    """
    _get_zone_or_404(zone_id, db)
    record = _get_record_or_404(zone_id, record_id, db)

    if record.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default records cannot be deleted",
        )

    db.delete(record)
    db.commit()
