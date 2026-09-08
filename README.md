# Scaler — AWS Route 53 Clone

A full-stack demo application replicating the core AWS Route 53 DNS management experience: hosted zones, DNS records, and a live dashboard — built with **Next.js 15 + Cloudscape Design System** on the frontend and **FastAPI + SQLite** on the backend.

---

## Features

| Area | Capability |
|---|---|
| **Hosted Zones** | Create, edit, delete; paginated list with URL-synced search |
| **DNS Records** | Full CRUD for A, AAAA, CAA, CNAME, MX, NS, PTR, SOA, SRV, TXT |
| **Bulk Operations** | Multi-select delete for zones and records |
| **BIND Import/Export** | Import RFC-compliant zone files; export as JSON or BIND format |
| **Dashboard** | Live aggregate stats (zone count, record count) |
| **Auth** | Session-cookie login/logout with 24 h expiry |
| **Dark Mode** | Persisted in `localStorage`; anti-flash inline script |

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| UI Library | [Cloudscape Design System](https://cloudscape.design/) |
| Language | TypeScript |
| API client | Custom `apiFetch<T>` wrapper (`frontend/lib/api.ts`) |
| State | React Context (auth, notifications) + custom hooks |
| Proxy | `next.config.ts` rewrites `/api/*` → FastAPI |

### Backend
| Layer | Technology |
|---|---|
| Framework | [FastAPI](https://fastapi.tiangolo.com/) |
| ORM | SQLAlchemy 2 (declarative, mapped columns) |
| Database | SQLite (`backend/route53.db`) |
| Auth | `passlib[bcrypt]` password hashing + httpOnly session cookie |
| Validation | Pydantic v2 schemas + per-record-type value validators |

---

## Repository Structure

```
scaler/
├── CONTEXT.md               # Architecture, API contract, DB schema & function registry
├── README.md                # This file
│
├── backend/
│   ├── requirements.txt
│   ├── route53.db           # SQLite database (git-ignored)
│   └── app/
│       ├── main.py          # FastAPI app + CORS + routers
│       ├── database.py      # Engine, SessionLocal, get_db()
│       ├── models.py        # ORM: User, Session, HostedZone, Record
│       ├── schemas.py       # Pydantic request/response schemas
│       ├── auth.py          # Password hashing, session management
│       ├── seed.py          # Demo data seeder
│       ├── bind_parser.py   # BIND zone file parser
│       ├── routers/
│       │   ├── auth.py          # POST /login, /logout; GET /me
│       │   ├── hosted_zones.py  # Hosted zones CRUD + import/export
│       │   └── records.py       # DNS records CRUD
│       └── validators/
│           └── records.py       # Per-type record value validators
│
└── frontend/
    ├── next.config.ts       # Cloudscape transpile + API proxy rewrite
    ├── middleware.ts        # Edge session guard
    ├── lib/
    │   ├── api.ts
    │   ├── auth-context.tsx
    │   ├── notification-context.tsx
    │   └── hooks/
    │       ├── use-hosted-zones.ts
    │       └── use-records.ts
    ├── components/
    │   ├── AppLayout.tsx
    │   ├── ComingSoon.tsx
    │   ├── hosted-zones/    # Table, Create/Edit/Delete/BulkDelete modals
    │   └── records/         # Table, Create/Edit/Delete/BulkDelete modals
    └── app/
        └── (protected)/
            ├── hosted-zones/
            ├── hosted-zones/[id]/
            ├── dashboard/
            ├── health-checks/
            ├── traffic-policies/
            ├── resolver/
            └── profiles/
```

---

## Local Development Setup

### Prerequisites

- **Node.js** 20 or 22 (LTS)
- **Python** 3.11+
- **npm** (comes with Node.js)

---

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database (creates route53.db and inserts demo data)
python -m app.seed

# Start the FastAPI dev server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend will be available at `http://127.0.0.1:8000`.

> **Windows note:** Use `127.0.0.1` (not `localhost`) to avoid IPv6 resolution mismatches with Node.js.

---

### 2. Frontend

Open a **second terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the Next.js dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

### 3. Login

Navigate to `http://localhost:3000` and sign in with the demo credentials:

| Field | Value |
|---|---|
| Username | `admin@example.com` |
| Password | `Password123!` |

---

## Environment Variables

The frontend reads from `frontend/.env.local`. An example file is provided at `frontend/.env.local.example`.

| Variable | Default | Description |
|---|---|---|
| `API_URL` | `http://127.0.0.1:8000` | Backend URL used by Next.js server-side rewrites |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Public base URL for client-side fetch (uses the rewrite proxy) |

Copy the example and edit if needed:
```bash
cp frontend/.env.local.example frontend/.env.local
```

---

## Database

- **File**: `backend/route53.db` (SQLite, git-ignored via `*.db`)
- **ORM**: SQLAlchemy 2 with typed mapped columns
- **Reset**: Delete `backend/route53.db` then re-run `python -m app.seed`

### Schema Summary

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK |
| username | VARCHAR(255) | UNIQUE NOT NULL |
| hashed_password | VARCHAR(255) | bcrypt |
| created_at | DATETIME | UTC |
| is_active | BOOLEAN | default True |

#### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK |
| user_id | INTEGER | FK → users.id CASCADE |
| token | VARCHAR(255) | UNIQUE, uuid4 |
| created_at | DATETIME | UTC |
| expires_at | DATETIME | UTC, 24 h from creation |

#### `hosted_zones`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK |
| name | VARCHAR(255) | UNIQUE NOT NULL |
| comment | TEXT | nullable |
| created_at | DATETIME | UTC |

#### `records`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PK |
| hosted_zone_id | INTEGER | FK → hosted_zones.id CASCADE |
| name | VARCHAR(255) | Full FQDN |
| type | VARCHAR(10) | CHECK IN (A, AAAA, CAA, CNAME, MX, NS, PTR, SOA, SRV, TXT) |
| ttl | INTEGER | default 300 |
| values_json | TEXT | JSON-encoded `list[str]` |
| is_default | BOOLEAN | default False; protects auto-seeded NS records |
| created_at | DATETIME | UTC |

**Unique constraint**: `(hosted_zone_id, name, type)`

---

## API Overview

All API routes are prefixed with `/api/` and proxied through the Next.js dev server.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Set `session_token` httpOnly cookie |
| POST | `/api/auth/logout` | Revoke session and clear cookie |
| GET | `/api/auth/me` | Return current user info |

### Hosted Zones
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones` | Paginated list (`search`, `page`, `page_size`) |
| POST | `/api/hosted-zones` | Create zone (auto-seeds default NS) |
| GET | `/api/hosted-zones/{id}` | Get single zone |
| PUT | `/api/hosted-zones/{id}` | Update zone comment |
| DELETE | `/api/hosted-zones/{id}` | Delete zone and cascade records |
| POST | `/api/hosted-zones/{id}/import` | Import BIND zone file (multipart) |
| GET | `/api/hosted-zones/{id}/export` | Export zone (`?format=json` or `?format=bind`) |

### DNS Records
| Method | Path | Description |
|---|---|---|
| GET | `/api/hosted-zones/{zid}/records` | Paginated (`search`, `type`, `page`, `page_size`) |
| POST | `/api/hosted-zones/{zid}/records` | Create record with per-type validation |
| GET | `/api/hosted-zones/{zid}/records/{rid}` | Get single record |
| PUT | `/api/hosted-zones/{zid}/records/{rid}` | Update record (default records: TTL only) |
| DELETE | `/api/hosted-zones/{zid}/records/{rid}` | Delete record (400 if default) |

### Stats
| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | `{"hosted_zones": N, "records": N}` |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus search filter |
| `n` | Open "Create" modal |
| `g` then `h` | Go to Hosted Zones |
| `g` then `d` | Go to Dashboard |
| `?` | Open keyboard shortcuts help |

> Shortcuts are disabled when focus is inside a text input, textarea, or modal dialog.

---

## DNS Record Types & Validation

| Type | Value Format | Notes |
|---|---|---|
| A | IPv4 address | e.g. `192.0.2.1` |
| AAAA | IPv6 address | e.g. `2001:db8::1` |
| CAA | `<flags> <tag> <value>` | tags: `issue`, `issuewild`, `iodef` |
| CNAME | Hostname | Exactly 1 value; cannot coexist with other types at same name |
| MX | `<priority> <hostname>` | e.g. `10 mail.example.com` |
| NS | Hostname | Nameserver FQDN |
| PTR | Hostname | Reverse DNS |
| SOA | (read-only) | Auto-managed; cannot be created or deleted via UI |
| SRV | `<priority> <weight> <port> <target>` | e.g. `10 20 443 sip.example.com` |
| TXT | Any string | SPF, DKIM, verification strings |

---

## Resetting Demo Data

```bash
# From the backend/ directory with venv active:
rm route53.db          # or: del route53.db  (Windows CMD)
python -m app.seed
```

Then restart the uvicorn server.

---

## Architecture Notes

- The browser **never** calls FastAPI directly. All `/api/*` traffic is handled by the Next.js proxy (rewrite in `next.config.ts`).
- Auth uses an httpOnly session cookie (`session_token`, 24 h max-age). The Next.js Edge middleware (`middleware.ts`) provides a fast early redirect for unauthenticated requests.
- `Record.values` is stored as a JSON-encoded `TEXT` column (`values_json`). A Python property on the ORM model transparently serialises/deserialises it to `list[str]`.
- Cloudscape components require `"use client"` in Next.js App Router and `transpilePackages` in `next.config.ts`.

---

## Known Issues / Deviations

| # | Issue | Resolution |
|---|---|---|
| 1 | `create-next-app` generates `next.config.ts` (TypeScript) | Used `.ts` throughout; functionally identical |
| 2 | Windows Node.js resolves `localhost` as `::1` (IPv6), uvicorn binds to `127.0.0.1` | `API_URL` defaults to `http://127.0.0.1:8000` |
| 3 | npm warns about `eslint-visitor-keys` engine mismatch | Non-blocking; build succeeds |
| 4 | `passlib 1.7.4` + `bcrypt >= 4.1` fails on Windows | Pinned `bcrypt==4.0.1` in `requirements.txt` |

---

## Detailed Documentation

See [`CONTEXT.md`](./CONTEXT.md) for the full architecture reference, complete API contract, database schema, and per-file function registry.
