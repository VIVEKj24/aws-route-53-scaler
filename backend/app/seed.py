"""
backend/app/seed.py
Seed the database with demo data.

Idempotency strategy
--------------------
If the users table already has ANY row the script exits early (no-op).
This means it is safe to run repeatedly in a demo environment without
duplicating data.  To do a full reset: delete route53.db and re-run.

Run command (from the backend/ directory, with venv active):
    python -m app.seed
"""
import json
import sys

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import HostedZone, Record, User

# ─── Password hashing ─────────────────────────────────────────────────────────

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Demo data ────────────────────────────────────────────────────────────────

ADMIN_USERNAME = "admin@example.com"
ADMIN_PASSWORD = "Password123!"

NS_VALUES = [
    "ns-1.demo-dns.com",
    "ns-2.demo-dns.org",
    "ns-3.demo-dns.net",
    "ns-4.demo-dns.co.uk",
]

ZONE_NAMES = [f"example-{i}.com" for i in range(1, 16)]

# Extra records added to the first 5 zones
EXTRA_RECORDS: dict[str, list[dict]] = {
    "example-1.com": [
        {"name": "example-1.com", "type": "A",     "ttl": 300,  "values": ["192.0.2.1"]},
        {"name": "www.example-1.com", "type": "CNAME", "ttl": 300, "values": ["example-1.com"]},
        {"name": "mail.example-1.com", "type": "MX",  "ttl": 3600, "values": ["10 mail.example-1.com"]},
    ],
    "example-2.com": [
        {"name": "example-2.com", "type": "A",     "ttl": 300,  "values": ["192.0.2.2"]},
        {"name": "www.example-2.com", "type": "CNAME", "ttl": 300, "values": ["example-2.com"]},
        {"name": "example-2.com", "type": "TXT",  "ttl": 3600, "values": ["v=spf1 include:mailgun.org ~all"]},
        {"name": "mail.example-2.com", "type": "MX",  "ttl": 3600, "values": ["10 mail.example-2.com"]},
    ],
    "example-3.com": [
        {"name": "example-3.com", "type": "A",     "ttl": 300,  "values": ["192.0.2.3"]},
        {"name": "api.example-3.com", "type": "CNAME", "ttl": 60,  "values": ["example-3.com"]},
        {"name": "example-3.com", "type": "TXT",  "ttl": 3600, "values": ["v=spf1 ~all"]},
    ],
    "example-4.com": [
        {"name": "example-4.com", "type": "A",     "ttl": 300,  "values": ["192.0.2.4", "192.0.2.5"]},
        {"name": "www.example-4.com", "type": "CNAME", "ttl": 300, "values": ["example-4.com"]},
        {"name": "mail.example-4.com", "type": "MX",  "ttl": 3600, "values": ["20 mail.example-4.com"]},
        {"name": "example-4.com", "type": "TXT",  "ttl": 3600, "values": ["google-site-verification=abc123"]},
    ],
    "example-5.com": [
        {"name": "example-5.com", "type": "A",     "ttl": 300,  "values": ["192.0.2.6"]},
        {"name": "shop.example-5.com", "type": "CNAME", "ttl": 300, "values": ["myshop.shopify.com"]},
        {"name": "example-5.com", "type": "TXT",  "ttl": 3600, "values": ["v=spf1 include:sendgrid.net ~all"]},
    ],
}


# ─── Seed logic ───────────────────────────────────────────────────────────────

def seed(db: Session) -> None:
    # ── Idempotency guard ──────────────────────────────────────────────────────
    if db.query(User).count() > 0:
        print("Database already seeded — exiting (no changes made).")
        print("To reseed: delete backend/route53.db and re-run this script.")
        return

    # ── Admin user ────────────────────────────────────────────────────────────
    admin = User(
        username=ADMIN_USERNAME,
        hashed_password=pwd_ctx.hash(ADMIN_PASSWORD),
    )
    db.add(admin)
    db.flush()  # get admin.id without committing
    print(f"  [OK] Created user: {ADMIN_USERNAME}")

    # ── Hosted zones + default NS records ─────────────────────────────────────
    for zone_name in ZONE_NAMES:
        zone = HostedZone(name=zone_name, comment=f"Demo zone for {zone_name}")
        db.add(zone)
        db.flush()  # get zone.id

        # Default NS record
        ns_record = Record(
            hosted_zone_id=zone.id,
            name=zone_name,
            type="NS",
            ttl=172800,
            values_json=json.dumps(NS_VALUES),
            is_default=True,
        )
        db.add(ns_record)

        # Extra non-default records (only for zones that have them)
        for rec_data in EXTRA_RECORDS.get(zone_name, []):
            extra = Record(
                hosted_zone_id=zone.id,
                name=rec_data["name"],
                type=rec_data["type"],
                ttl=rec_data["ttl"],
                values_json=json.dumps(rec_data["values"]),
                is_default=False,
            )
            db.add(extra)

    db.commit()
    print(f"  [OK] Created {len(ZONE_NAMES)} hosted zones with default NS records")
    print(f"  [OK] Added extra records to {len(EXTRA_RECORDS)} zones")
    print("Seed complete.")


def main() -> None:
    print("Creating tables …")
    Base.metadata.create_all(bind=engine)
    print("Seeding …")
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
