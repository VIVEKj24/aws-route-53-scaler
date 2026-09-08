# Scaler — AWS Route 53 Clone

> A full-stack DNS management dashboard that mirrors the AWS Route 53 experience,
> built as a graded engineering deliverable.

<!-- TODO: fill in after deploy -->

## Demo

| | URL |
|---|---|
| Live demo | _&lt;URL — to be added&gt;_ |
| Backend API | _&lt;URL — to be added&gt;_ |

> **Note (free-tier hosting):** The backend is deployed on a free-tier service with
> ephemeral storage and cold-start delays. The first request after a period of inactivity
> may take 20–30 seconds. On cold start the database is re-created and re-seeded
> automatically — demo credentials always work.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| UI components | [Cloudscape Design System](https://cloudscape.design/) (`@cloudscape-design/components`) |
| Backend | FastAPI + Uvicorn |
| ORM | SQLAlchemy (declarative, sync) |
| Database | SQLite (`backend/route53.db`) — ephemeral dev/demo store |
| Auth | Session-token cookie (httpOnly, SameSite=lax, 24 h) via passlib/bcrypt |
| API proxy | Next.js `rewrites` — all `/api/*` traffic proxied server-side to FastAPI |

---

## Features

- **Mocked authentication** with server-side session persistence (login / logout / `/me`).
- **Hosted Zones — full CRUD**: create, list (paginated + searchable), edit comment, delete with exact-name confirmation, and bulk-delete multiple zones at once.
- **DNS Records — full CRUD**: create, list (paginated, searchable, filterable by type), edit, delete, and bulk-delete selected records within a zone.
- **9 supported record types** with per-type backend validation:
  `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA`
- **Route 53-styled UI** — Cloudscape Design System components throughout (tables, modals, breadcrumbs, flashbar notifications, side navigation).
- **Dashboard** — live statistics showing total hosted zones, DNS records, and name servers.
- **Coming Soon pages** — Traffic Policies, Health Checks, Resolver, and Profiles are navigation placeholders.
- **Dark Mode** — toggle in the top navigation bar; preference persisted to `localStorage` with an anti-flash inline script.
- **BIND import / export** — upload a BIND zone file to import records into a zone; export any zone as JSON or BIND format.
- **Bulk operations** — select 2+ rows in the hosted-zones or records table to trigger a bulk-delete confirmation modal.
- **Keyboard shortcuts** — see table below.
- **Auto-seed on startup** — the backend seeds 15 demo zones and an admin user on first run (no manual seed command needed).

### Keyboard Shortcuts

| Key(s) | Action |
|---|---|
| `/` | Focus the search / filter input |
| `n` | Open the Create modal |
| `g` then `h` | Navigate to Hosted Zones |
| `g` then `d` | Navigate to Dashboard |
| `?` | Show the keyboard shortcuts help dialog |

---

## Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+ (tested on 22.x)

### Backend

```bash
# 1. Create and activate a virtual environment
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
#    Tables are created and demo data is seeded automatically on first startup.
#    No need to run `python -m app.seed` manually.
uvicorn app.main:app --reload
```

The API is available at **http://127.0.0.1:8000**.  
Interactive docs: http://127.0.0.1:8000/docs

> **Manual seed (optional):** If you prefer to seed separately (e.g. after deleting
> `route53.db` for a full reset), you can still run `python -m app.seed` from the
> `backend/` directory with the venv active. It is idempotent — a no-op if any user
> already exists.

### Frontend

```bash
# From the repository root
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.local.example .env.local
# The defaults in .env.local.example are correct for local development:
#   NEXT_PUBLIC_API_URL=http://localhost:3000
#   API_URL=http://127.0.0.1:8000

# 3. Start the dev server
npm run dev
```

The app is available at **http://localhost:3000**.

### Demo Credentials

| Field | Value |
|---|---|
| Username | `admin@example.com` |
| Password | `Password123!` |

---

## Architecture Overview

### Data Flow

```
Browser  ->  http://localhost:3000/api/*
                   |  (Next.js server-side rewrite)
                   v
            http://127.0.0.1:8000/api/*
                   |
                   v
            FastAPI  (uvicorn)
                   |
                   v
            SQLAlchemy  ->  route53.db (SQLite)
```

The browser **never** calls FastAPI directly. All `/api/*` requests are handled
by Next.js, which rewrites them to the FastAPI backend (`API_URL` env var,
default `http://127.0.0.1:8000`). This means CORS is only needed between the
two servers, not between the browser and FastAPI. `127.0.0.1` is used explicitly
(rather than `localhost`) to avoid IPv6 resolution mismatches on Windows.

### Auth & Routing Flow

1. **Unauthenticated visit** — `middleware.ts` (Next.js Edge) inspects every
   incoming request for the `session_token` cookie. If it is missing and the
   route is not `/login`, `/api/*`, or a static asset, the middleware immediately
   redirects to `/login` (prevents content flash).

2. **Authoritative state** — `AuthProvider` queries `/api/auth/me` on mount.
   While loading, the `(protected)/layout.tsx` shows a centered Cloudscape
   spinner. A 401/403 response or network failure redirects to `/login`; a
   successful response renders the `AppLayout` shell.

3. **Login** — `POST /api/auth/login` verifies credentials and sets the
   `session_token` httpOnly cookie. On success, the frontend refetches `/api/auth/me`
   and routes to `/hosted-zones`. On failure an error alert is shown.

4. **Sign out** — `POST /api/auth/logout` revokes the session row in the DB and
   clears the cookie. The frontend sets `user = null` and routes to `/login`.

---

## Database Schema

**File:** `backend/route53.db` (SQLite)  
**ORM:** `backend/app/models.py`  
**Connection string:** `sqlite:///./route53.db` (relative to `backend/`, `check_same_thread=False`)

### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK, autoincrement |
| `username` | VARCHAR(255) | UNIQUE NOT NULL |
| `hashed_password` | VARCHAR(255) | NOT NULL |
| `created_at` | DATETIME (tz-aware) | NOT NULL, default = now |
| `is_active` | BOOLEAN | NOT NULL, default = True |

### `sessions`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `user_id` | INTEGER | FK -> users.id ON DELETE CASCADE |
| `token` | VARCHAR(255) | UNIQUE NOT NULL |
| `created_at` | DATETIME (tz-aware) | NOT NULL |
| `expires_at` | DATETIME (tz-aware) | NOT NULL |

### `hosted_zones`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `name` | VARCHAR(255) | UNIQUE NOT NULL |
| `comment` | TEXT | nullable |
| `created_at` | DATETIME (tz-aware) | NOT NULL |

### `records`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK |
| `hosted_zone_id` | INTEGER | FK -> hosted_zones.id ON DELETE CASCADE |
| `name` | VARCHAR(255) | NOT NULL |
| `type` | VARCHAR(10) | NOT NULL, CHECK IN (A, AAAA, CAA, CNAME, MX, NS, PTR, SOA, SRV, TXT) |
| `ttl` | INTEGER | NOT NULL, default = 300 |
| `values_json` | TEXT | NOT NULL — JSON-encoded `list[str]` |
| `is_default` | BOOLEAN | NOT NULL, default = False |
| `created_at` | DATETIME (tz-aware) | NOT NULL |

**Unique constraint:** `(hosted_zone_id, name, type)`  
**Index:** `ix_records_zone_name_type` on `(hosted_zone_id, name, type)`  
**Python property:** `Record.values` transparently (de)serialises `values_json` <-> `list[str]`

> **SOA in the type check constraint** — the DB constraint allows SOA to satisfy
> BIND import compatibility, but the API rejects user-creation of SOA records via
> `USER_ALLOWED_TYPES`. No SOA record is seeded by default.

---

## API Overview

All endpoints are prefixed with `/api/`. Auth endpoints are unauthenticated;
all others require the `session_token` httpOnly cookie set at login.

### Meta

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Liveness probe — returns `{"status": "ok"}` |

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Verify credentials; set `session_token` cookie |
| POST | `/api/auth/logout` | `session_token` | Delete session row; clear cookie |
| GET | `/api/auth/me` | `session_token` | Return current user `{id, username, is_active}` |

**Cookie:** `session_token` — httpOnly, SameSite=lax, 24 h max-age.  
**Auth guard:** `get_current_user` dependency — returns HTTP 401 if cookie is missing, expired, or invalid.

### Hosted Zones

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hosted-zones` | `session_token` | Paginated list; optional `search` query param |
| POST | `/api/hosted-zones` | `session_token` | Create zone; auto-seeds a default NS record (201) |
| GET | `/api/hosted-zones/{zone_id}` | `session_token` | Single zone (404 if missing) |
| PUT | `/api/hosted-zones/{zone_id}` | `session_token` | Update zone comment (404 if missing) |
| DELETE | `/api/hosted-zones/{zone_id}` | `session_token` | Delete zone and cascade-delete its records (204) |
| POST | `/api/hosted-zones/{zone_id}/import` | `session_token` | Import BIND zone file (multipart); returns `{"imported": N, "skipped": [...]}` |
| GET | `/api/hosted-zones/{zone_id}/export` | `session_token` | Export zone as JSON (`?format=json`) or BIND (`?format=bind`) |

### Records

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hosted-zones/{zone_id}/records` | `session_token` | Paginated records; optional `search` (name) and `type` filters |
| POST | `/api/hosted-zones/{zone_id}/records` | `session_token` | Create record with per-type validation; CNAME requires exactly 1 value; SOA rejected |
| GET | `/api/hosted-zones/{zone_id}/records/{record_id}` | `session_token` | Single record (404 if missing) |
| PUT | `/api/hosted-zones/{zone_id}/records/{record_id}` | `session_token` | Update record; default records allow TTL change only; values re-validated on update |
| DELETE | `/api/hosted-zones/{zone_id}/records/{record_id}` | `session_token` | Delete record (400 if `is_default`; 204 on success; 404 if missing) |

### Stats

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/stats` | `session_token` | Aggregate counts: `{"hosted_zones": <int>, "records": <int>}` |

---

## Known Limitations

These are intentional tradeoffs for a demo / assessment project, not untracked bugs.

| # | Limitation | Notes |
|---|---|---|
| 1 | No CNAME-exclusivity validation | Per DNS spec a CNAME should not coexist with other record types at the same name. Not enforced at the API layer. |
| 2 | No Alembic migrations | Schema changes require deleting `route53.db` and restarting. Auto-seed re-populates demo data on first startup. |
| 3 | No rate limiting on `/api/auth/login` | Brute-force protection is out of scope for a demo. Add a middleware layer (e.g. `slowapi`) before any production use. |
| 4 | No test suite | Unit and integration tests are a planned next step (Phase 10+). |
| 5 | SOA in DB type constraint but unused | The `records.type` CHECK constraint includes `SOA` for BIND import compatibility; the API blocks user creation of SOA records via `USER_ALLOWED_TYPES`. No SOA is seeded. |
| 6 | Bulk delete is client-side sequential | The frontend loops individual `DELETE` calls rather than calling a single batch endpoint. Sufficient for demo scale; a dedicated batch endpoint would be needed for production. |

---

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Browser-visible base URL (uses rewrite; points to its own origin) |
| `API_URL` | `http://127.0.0.1:8000` | Server-side rewrite target (FastAPI origin) |

### Backend (shell / host environment)

| Variable | Default | Description |
|---|---|---|
| `COOKIE_SECURE` | `false` | Set to `true` in production (HTTPS) to add the `Secure` flag to `session_token` |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allowed origins (e.g. `https://app.example.com,https://preview.example.com`) |

---

## Project Structure (abbreviated)

```
scaler/
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI app, lifespan (create tables + auto-seed), CORS, routers
│       ├── database.py      # Engine, SessionLocal, Base, get_db()
│       ├── models.py        # ORM: User, Session, HostedZone, Record
│       ├── schemas.py       # Pydantic v2 request/response schemas
│       ├── auth.py          # Password hashing, session creation, get_current_user dependency
│       ├── seed.py          # Demo data seed (idempotent)
│       ├── bind_parser.py   # BIND zone file parser
│       ├── routers/
│       │   ├── auth.py          # /api/auth/*
│       │   ├── hosted_zones.py  # /api/hosted-zones/*
│       │   └── records.py       # /api/hosted-zones/{id}/records/*
│       └── validators/
│           └── records.py       # Per-type DNS record validators
└── frontend/
    ├── next.config.ts       # transpilePackages + /api/* rewrite proxy
    ├── middleware.ts        # Edge middleware: cookie-based session guard
    ├── .env.local.example
    └── app/
        ├── login/           # Login page
        └── (protected)/     # Auth-guarded pages: hosted-zones, dashboard, coming-soon pages
```
