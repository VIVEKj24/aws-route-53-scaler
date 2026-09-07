"""
backend/app/routers/hosted_zones.py
Hosted-zone CRUD endpoints (Phase 3):
  GET    /api/hosted-zones          — paginated list with search
  POST   /api/hosted-zones          — create zone
  GET    /api/hosted-zones/{id}     — single zone
  PUT    /api/hosted-zones/{id}     — update comment
  DELETE /api/hosted-zones/{id}     — delete zone (cascades to records)
All routes require an active session (get_current_user).
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.auth import get_current_user
from app.database import get_db
from app.models import HostedZone, Record, User
from app.schemas import (
    HostedZoneCreate,
    HostedZoneOut,
    HostedZoneUpdate,
    PaginatedHostedZones,
)

router = APIRouter(tags=["hosted-zones"])

_DEFAULT_NS_VALUES = [
    "ns-1.demo-dns.com",
    "ns-2.demo-dns.org",
    "ns-3.demo-dns.net",
    "ns-4.demo-dns.co.uk",
]


def _get_zone_or_404(zone_id: int, db: DBSession) -> HostedZone:
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")
    return zone


# ─── GET / (list) ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedHostedZones)
def list_zones(
    search: str | None = Query(None, description="LIKE filter on zone name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return a paginated list of hosted zones. Optionally filter by name."""
    q = db.query(HostedZone)
    if search:
        q = q.filter(HostedZone.name.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(HostedZone.id).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedHostedZones(items=items, total=total, page=page, page_size=page_size)


# ─── POST / (create) ──────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=HostedZoneOut)
def create_zone(
    body: HostedZoneCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Create a new hosted zone and seed a default NS record."""
    existing = db.query(HostedZone).filter(HostedZone.name == body.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Hosted zone '{body.name}' already exists",
        )
    zone = HostedZone(name=body.name, comment=body.comment)
    db.add(zone)
    db.flush()  # get zone.id

    # Auto-create default NS record
    ns = Record(
        hosted_zone_id=zone.id,
        name=body.name,
        type="NS",
        ttl=172800,
        values_json=json.dumps(_DEFAULT_NS_VALUES),
        is_default=True,
    )
    db.add(ns)
    db.commit()
    db.refresh(zone)
    return zone


# ─── GET /{zone_id} (single) ──────────────────────────────────────────────────

@router.get("/{zone_id}", response_model=HostedZoneOut)
def get_zone(
    zone_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return _get_zone_or_404(zone_id, db)


# ─── PUT /{zone_id} (update) ──────────────────────────────────────────────────

@router.put("/{zone_id}", response_model=HostedZoneOut)
def update_zone(
    zone_id: int,
    body: HostedZoneUpdate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Update the comment on a hosted zone."""
    zone = _get_zone_or_404(zone_id, db)
    zone.comment = body.comment
    db.commit()
    db.refresh(zone)
    return zone


# ─── DELETE /{zone_id} ────────────────────────────────────────────────────────

@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Delete a hosted zone and all its records (cascade)."""
    zone = _get_zone_or_404(zone_id, db)
    db.delete(zone)
    db.commit()
