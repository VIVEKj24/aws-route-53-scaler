# CONTEXT.md — Scaler Project

> **Template instructions**: Update this file at the end of every phase. Fill in every section.
> Leave `(added in Phase N)` placeholders for items not yet implemented.

---

## 1. Status

| Phase | Description                                    | Status    |
|-------|------------------------------------------------|-----------|
| 0     | Repository scaffold                            | ✅ Done   |
| 1     | Database models & migrations                   | ✅ Done   |
| 2     | Auth endpoints & sessions                      | ✅ Done   |
| 3     | Hosted zones CRUD API                          | ✅ Done   |
| 4     | DNS records CRUD API + per-type validation     | ✅ Done   |
| 5+    | Frontend & remaining features                  | 🔲 Pending |

**Current phase**: 4 — DNS records CRUD complete. Frontend integration is Phase 5+.

---

## 2. Repository Structure

```
scaler/
├── .gitignore               # Python + Node ignores
├── README.md                # Placeholder (setup instructions in Phase 10)
├── CONTEXT.md               # This file
├── docs/                    # Empty — content added in later phases
│
├── backend/
│   ├── requirements.txt     # fastapi, uvicorn[standard], sqlalchemy, pydantic,
│   │                        #   passlib[bcrypt], bcrypt==4.0.1, python-multipart, python-dotenv
│   ├── route53.db           # SQLite database (git-ignored)
│   ├── venv/                # Python virtualenv (git-ignored)
│   └── app/
│       ├── __init__.py
│       ├── main.py          # FastAPI app + CORS + health + routers wired
│       ├── database.py      # Engine (SQLite), SessionLocal, Base, get_db()
│       ├── models.py        # ORM: User, Session, HostedZone, Record
│       ├── schemas.py       # Pydantic v2: *Out, *Create, *Update, Paginated*
│       ├── auth.py          # hash_password, verify_password, create_session, get_current_user
│       ├── seed.py          # Demo data seed (run: python -m app.seed from backend/)
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py          # POST /login, /logout; GET /me
│       │   ├── hosted_zones.py  # GET / (list), POST / (create), GET/PUT/DELETE /{id}
│       │   └── records.py       # GET / (list), POST / (create), GET/PUT/DELETE /{record_id}
│       └── validators/
│           ├── __init__.py
│           └── records.py       # Per-record-type value validators + composite validator
│
└── frontend/
    ├── next.config.ts       # transpilePackages, rewrite proxy /api/* → backend
    ├── .env.local.example   # Document env vars (copy → .env.local to use)
    ├── package.json
    ├── tsconfig.json
    └── app/
        ├── layout.tsx       # Root layout; imports Cloudscape global styles
        ├── page.tsx         # Home page — Cloudscape <Button> smoke test
        └── globals.css
```

---

## 3. Data Flow Summary

```
Browser → http://localhost:3000/api/*
                ↓  (Next.js rewrite, server-side)
         http://127.0.0.1:8000/api/*
                ↓
         FastAPI (uvicorn)
```

- The browser **never** calls the FastAPI origin directly. All `/api/*` traffic goes
  through the Next.js dev server (or production server) which rewrites it to the backend.
- `API_URL` env var (default `http://127.0.0.1:8000`) controls the rewrite destination.
  Use `127.0.0.1` instead of `localhost` to avoid IPv6 resolution mismatches on Windows.
- `NEXT_PUBLIC_API_URL` is set to `http://localhost:3000` — client code uses its own
  origin and relies on the rewrite.

---

## 4. Database Schema

**File**: `backend/route53.db` (SQLite)  
**ORM**: `backend/app/models.py`  
**DB URL**: `sqlite:///./route53.db` (relative to `backend/`, check_same_thread=False)

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK, autoincrement |
| username | VARCHAR(255) | UNIQUE NOT NULL |
| hashed_password | VARCHAR(255) | NOT NULL |
| created_at | DATETIME (tz) | NOT NULL, default=now |
| is_active | BOOLEAN | NOT NULL, default=True |

### sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| user_id | INTEGER | FK→users.id ON DELETE CASCADE |
| token | VARCHAR(255) | UNIQUE NOT NULL |
| created_at | DATETIME (tz) | NOT NULL |
| expires_at | DATETIME (tz) | NOT NULL |

### hosted_zones
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| name | VARCHAR(255) | UNIQUE NOT NULL |
| comment | TEXT | nullable |
| created_at | DATETIME (tz) | NOT NULL |

### records
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| hosted_zone_id | INTEGER | FK→hosted_zones.id ON DELETE CASCADE |
| name | VARCHAR(255) | NOT NULL |
| type | VARCHAR(10) | NOT NULL, CHECK IN (A,AAAA,CNAME,MX,NS,PTR,SOA,SRV,TXT) |
| ttl | INTEGER | NOT NULL, default=300 |
| values_json | TEXT | NOT NULL — JSON-encoded list[str] |
| is_default | BOOLEAN | NOT NULL, default=False |
| created_at | DATETIME (tz) | NOT NULL |

**Unique constraint**: `(hosted_zone_id, name, type)`  
**Index**: `ix_records_zone_name_type` on `(hosted_zone_id, name, type)`  
**Python property**: `Record.values` transparently (de)serialises `values_json`

---

## 5. API Contract

### Meta

| Method | Path             | Auth          | Description                        |
|--------|------------------|---------------|---------------------------------|
| GET    | /api/health      | None          | Liveness probe                  |

### Auth

| Method | Path              | Auth              | Description                                          |
|--------|-------------------|-------------------|------------------------------------------------------|
| POST   | /api/auth/login   | None              | Authenticate; sets `session_token` httpOnly cookie   |
| POST   | /api/auth/logout  | session_token     | Delete session row; clears cookie                    |
| GET    | /api/auth/me      | session_token     | Return current user (`{user:{id,username,display_name,is_active}}`) |

**Cookie**: `session_token` — httpOnly, SameSite=lax, 24 h max-age  
**Auth guard**: `get_current_user` dependency (401 if cookie missing/expired/invalid)

### Hosted Zones

| Method | Path                        | Auth          | Description                                                    |
|--------|-----------------------------|---------------|----------------------------------------------------------------|
| GET    | /api/hosted-zones           | session_token | Paginated list of hosted zones; optional `search` filter       |
| POST   | /api/hosted-zones           | session_token | Create hosted zone and auto-seed default NS record (201)        |
| GET    | /api/hosted-zones/{zone_id} | session_token | Return single hosted zone (404 if missing)                     |
| PUT    | /api/hosted-zones/{zone_id} | session_token | Update comment on hosted zone (404 if missing)                 |
| DELETE | /api/hosted-zones/{zone_id} | session_token | Delete zone and cascade delete its records (204)               |

### Records

| Method | Path                                            | Auth          | Description                                                                 |
|--------|-------------------------------------------------|---------------|-----------------------------------------------------------------------------|
| GET    | /api/hosted-zones/{zone_id}/records             | session_token | Paginated records; optional `search` (name) & `type` filters               |
| POST   | /api/hosted-zones/{zone_id}/records             | session_token | Create record with per-type validation; CNAME requires 1 value; rejects SOA |
| GET    | /api/hosted-zones/{zone_id}/records/{record_id} | session_token | Return single record by ID (404 if missing)                                |
| PUT    | /api/hosted-zones/{zone_id}/records/{record_id} | session_token | Update record (default records: ttl only; re-validates updated values)       |
| DELETE | /api/hosted-zones/{zone_id}/records/{record_id} | session_token | Delete record (400 if is_default; 204 on success; 404 if missing)           |

---

## 6. Function Registry

### `backend/app/database.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `Base` | class | SQLAlchemy `DeclarativeBase` — all models inherit from this |
| `engine` | obj | SQLAlchemy engine for `sqlite:///./route53.db` |
| `SessionLocal` | factory | `sessionmaker` bound to `engine` |
| `get_db()` | generator | FastAPI dependency — yields a `Session`, closes on exit |

### `backend/app/models.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `User` | ORM model | users table — id, username, hashed_password, created_at, is_active |
| `Session` | ORM model | sessions table — id, user_id, token, created_at, expires_at |
| `HostedZone` | ORM model | hosted_zones table — id, name, comment, created_at |
| `Record` | ORM model | records table — id, hosted_zone_id, name, type, ttl, values_json, is_default, created_at |
| `Record.values` | property | JSON-decodes `values_json` to `list[str]`; setter encodes back |

### `backend/app/schemas.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `UserOut` | Pydantic | Response schema for User (no password) |
| `LoginRequest` | Pydantic | username + password for login |
| `HostedZoneCreate` | Pydantic | name (required), comment (optional) |
| `HostedZoneUpdate` | Pydantic | comment (optional) |
| `HostedZoneOut` | Pydantic | Response + computed `record_count` from ORM relationship |
| `PaginatedHostedZones` | Pydantic | items, total, page, page_size |
| `RecordCreate` | Pydantic | name, type (validated enum), ttl, values list, is_default |
| `RecordUpdate` | Pydantic | ttl and/or values (both optional) |
| `RecordOut` | Pydantic | Response — `values` is `list[str]` (deserialised from values_json) |
| `PaginatedRecords` | Pydantic | items, total, page, page_size |

### `backend/app/seed.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `seed(db)` | function | Core seed logic — guarded by user-count check; inserts admin, 15 zones, records |
| `main()` | function | Calls `create_all`, opens session, calls `seed()` |

**Seed command** (from `backend/` with venv active):
```
python -m app.seed
```
**Idempotency**: exits early (no-op) if `users` table already has any row.  
**Reset**: delete `backend/route53.db` then re-run the seed command.

### `backend/app/auth.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `hash_password(plain)` | function | Returns bcrypt hash of *plain* via passlib |
| `verify_password(plain, hashed)` | function | Returns True if *plain* matches *hashed* |
| `create_session(db, user)` | function | Inserts Session row (uuid4 token, 24 h expiry), returns token str |
| `get_current_user(request, db)` | dependency | Reads `session_token` cookie; 401 if missing/expired; returns User |

### `backend/app/routers/auth.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `login(body, response, db)` | endpoint | POST /api/auth/login — verifies creds, sets cookie |
| `logout(request, response, current_user, db)` | endpoint | POST /api/auth/logout — deletes Session row, clears cookie |
| `me(current_user)` | endpoint | GET /api/auth/me — returns current user info |

### `backend/app/routers/hosted_zones.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `_get_zone_or_404(zone_id, db)` | helper | Query HostedZone by ID; raises 404 if not found |
| `list_zones(search, page, page_size, current_user, db)` | endpoint | GET /api/hosted-zones — paginated list with optional name filter |
| `create_zone(body, current_user, db)` | endpoint | POST /api/hosted-zones — creates zone and default NS record |
| `get_zone(zone_id, current_user, db)` | endpoint | GET /api/hosted-zones/{zone_id} — returns single zone |
| `update_zone(zone_id, body, current_user, db)` | endpoint | PUT /api/hosted-zones/{zone_id} — updates zone comment |
| `delete_zone(zone_id, current_user, db)` | endpoint | DELETE /api/hosted-zones/{zone_id} — deletes zone and cascades |

### `backend/app/validators/records.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `_valid_hostname(value)` | helper | Validates hostname regex shape and length <= 253 |
| `validate_a(value)` | function | Validates value parses as IPv4 address |
| `validate_aaaa(value)` | function | Validates value parses as IPv6 address |
| `validate_cname(value)` | function | Validates hostname format for CNAME target |
| `validate_ns(value)` | function | Validates hostname format for NS nameserver |
| `validate_ptr(value)` | function | Validates hostname format for PTR target |
| `validate_txt(value)` | function | Validates non-empty string |
| `validate_mx(value)` | function | Validates `<priority> <hostname>` format |
| `validate_srv(value)` | function | Validates `<priority> <weight> <port> <target>` format |
| `validate_caa(value)` | function | Validates `<flags> <tag> <value>` with issue/issuewild/iodef |
| `RECORD_VALIDATORS` | dict | Maps supported record type strings to validator functions |
| `USER_ALLOWED_TYPES` | frozenset | Set of allowed user-creatable types (excluding SOA) |
| `validate_record(record_type, values)` | function | Validates all values for type; enforces CNAME length == 1 |

### `backend/app/routers/records.py`
| Symbol | Kind | Description |
|--------|------|-------------|
| `_get_zone_or_404(zone_id, db)` | helper | Query HostedZone by ID; raises 404 if not found |
| `_get_record_or_404(zone_id, record_id, db)` | helper | Query Record by zone_id and record_id; raises 404 if not found |
| `get_record(zone_id, record_id, current_user, db)` | endpoint | GET /api/hosted-zones/{zone_id}/records/{record_id} — returns single record |
| `list_records(zone_id, search, type, page, page_size, current_user, db)` | endpoint | GET /api/hosted-zones/{zone_id}/records — paginated records list |
| `create_record(zone_id, body, current_user, db)` | endpoint | POST /api/hosted-zones/{zone_id}/records — creates validated record |
| `update_record(zone_id, record_id, body, current_user, db)` | endpoint | PUT /api/hosted-zones/{zone_id}/records/{record_id} — updates record |
| `delete_record(zone_id, record_id, current_user, db)` | endpoint | DELETE /api/hosted-zones/{zone_id}/records/{record_id} — deletes record |

**UI Framework note (Phase 0):**
The project uses **Cloudscape Design System** (`@cloudscape-design/components` +
`@cloudscape-design/global-styles`). Cloudscape was installed successfully and the
production build exits 0 with no TypeScript errors. No Tailwind fallback was needed.

Cloudscape-specific conventions:
- All Cloudscape components require `"use client"` in App Router pages/components
  because they use React hooks internally.
- `transpilePackages: ["@cloudscape-design/components"]` is required in `next.config.ts`
  so Next.js bundles Cloudscape's ESM output correctly.

---

## 7. Known Issues / Deviations

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | `create-next-app` generates `next.config.ts` (TypeScript), not `next.config.js` | Used `.ts` throughout; functionally identical. |
| 2 | Windows: Node.js resolves `localhost` as `::1` (IPv6), but uvicorn binds to `127.0.0.1` (IPv4) | Default `API_URL` in `next.config.ts` uses `http://127.0.0.1:8000` explicitly. |
| 3 | npm warns about `eslint-visitor-keys` engine mismatch (requires Node ≥20.19, running 22.12) | Non-blocking warning; build and dev both succeed. Update Node if it becomes an issue. |
| 4 | `passlib 1.7.4` + `bcrypt >= 4.1` fails on Windows — backend detection throws `ValueError` on load | Pinned `bcrypt==4.0.1` in `requirements.txt`. Last version passlib fully supports. |
