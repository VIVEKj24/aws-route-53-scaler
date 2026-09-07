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
| 5     | App shell, routing & notifications             | ✅ Done   |
| 6     | Hosted zones list, search, pagination, CRUD    | ✅ Done   |
| 7     | Zone detail page & DNS records CRUD            | ✅ Done   |
| 8     | Dashboard, "Coming soon" pages & nav QA        | ✅ Done   |
| 9+    | Additional features & deployment               | 🔲 Pending |

**Current phase**: 8 — Dashboard with live stats, unified Coming Soon placeholders, and navigation QA complete.

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
    ├── middleware.ts        # Cookie-based session guard redirecting unauth to /login
    ├── .env.local.example   # Document env vars (copy → .env.local to use)
    ├── package.json
    ├── tsconfig.json
    ├── lib/
    │   ├── api.ts              # apiFetch<T> client + ApiError
    │   ├── auth-context.tsx    # AuthProvider & useAuth hook
    │   ├── notification-context.tsx # NotificationProvider & useNotify hook
    │   └── hooks/
    │       ├── use-hosted-zones.ts  # useHostedZones hook
    │       └── use-records.ts       # useRecords hook
    ├── components/
    │   ├── AppLayout.tsx       # Cloudscape TopNavigation + SideNavigation + Flashbar
    │   ├── ComingSoon.tsx      # Centered placeholder component with icon and back-link
    │   ├── hosted-zones/
    │   │   ├── HostedZonesTable.tsx
    │   │   ├── CreateEditZoneModal.tsx
    │   │   └── DeleteZoneModal.tsx
    │   └── records/
    │       ├── RecordsTable.tsx
    │       ├── CreateEditRecordModal.tsx
    │       └── DeleteRecordModal.tsx
    └── app/
        ├── layout.tsx          # Root layout; imports Cloudscape global styles, wraps Providers
        ├── providers.tsx       # NotificationProvider > AuthProvider wrapper
        ├── page.tsx            # Root route — redirects to /hosted-zones
        ├── globals.css
        ├── login/
        │   └── page.tsx        # Centered Cloudscape login form
        └── (protected)/
            ├── layout.tsx      # Route guard with spinner and AppLayout shell
            ├── hosted-zones/
            │   ├── page.tsx    # Hosted zones list page
            │   └── [id]/
            │       └── page.tsx # Zone detail page (metadata + records table)
            ├── dashboard/
            │   └── page.tsx    # Live statistics dashboard & get started cards
            ├── health-checks/
            │   └── page.tsx    # Health checks coming soon page
            ├── traffic-policies/
            │   └── page.tsx    # Traffic policies coming soon page
            ├── resolver/
            │   └── page.tsx    # Resolver coming soon page
            └── profiles/
                └── page.tsx    # Profiles coming soon page
```

### Record Name Construction Convention
- In the Create Record modal, users enter a subdomain prefix (e.g. `www`) or leave it blank / enter `@` for the apex domain.
- The UI automatically constructs and displays the full FQDN:
  - Blank or `@` $\rightarrow$ `zone.name` (apex, e.g. `example.com`).
  - Subdomain prefix $\rightarrow$ `${subdomain}.${zone.name}` (e.g. `www.example.com`).
  - If the user types a name already ending with the zone name suffix, it avoids double-appending.
- The backend always receives and stores the full FQDN in `record.name`.
- In Edit mode, default records (`is_default: true`) have an immutable name and immutable values (only TTL can be changed); user-created records allow editing name, TTL, and values.

### Frontend Auth & Routing Flow

1. **Unauthenticated Visit**:
   - `middleware.ts` inspects incoming request for `session_token` cookie.
   - If missing/empty and route is not `/login`, `/api/*`, or static assets, immediately redirects to `/login` (preventing content flash).
2. **Authoritative State (`useAuth`)**:
   - On initial mount, `AuthProvider` queries `/api/auth/me`.
   - In `(protected)/layout.tsx`, while `loading` is true, a centered Cloudscape `Spinner` is rendered.
   - If `/api/auth/me` returns 401/403 or fails, `user` is `null` and the layout redirects via `router.replace('/login')`.
   - If `user` is authenticated, `<AppLayout>` renders the navigation and children.
3. **Login (`/login/page.tsx`)**:
   - User submits credentials; calls `login(username, password)`.
   - `login()` performs `POST /api/auth/login` setting the `session_token` HTTP-only cookie, then refetches `/api/auth/me` and sets state.
   - On success, routes to `/hosted-zones`. On failure, displays error alert with `ApiError.message`.
4. **Sign Out**:
   - TopNavigation utility menu "Sign out" calls `logout()`.
   - `POST /api/auth/logout` revokes the session on the backend and clears the cookie.
   - `logout()` sets `user = null` and routes to `/login`.

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

### Stats

| Method | Path       | Auth          | Description                                                                     |
|--------|------------|---------------|---------------------------------------------------------------------------------|
| GET    | /api/stats | session_token | Aggregate counts: `{"hosted_zones": <int>, "records": <int>}` (requires auth)  |

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

### `frontend/lib/api.ts`
| Symbol | Kind | Description |
|--------|------|-------------|
| `ApiError` | class | Custom error extending `Error` with `status: number` and `message: string` |
| `apiFetch<T>(path, options)` | function | Client fetch wrapper with auto `/api` prefix, `credentials: "include"`, JSON headers/body formatting, and error parsing |

### `frontend/lib/auth-context.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `AuthProvider({ children })` | component | Context provider managing `user` and `loading` state; exposes `login(username, password)` and `logout()` |
| `useAuth()` | hook | Exposes `{ user, loading, login, logout }` to components |

### `frontend/lib/notification-context.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `NotificationProvider({ children })` | component | Context provider holding Flashbar items in state with 5-second auto-dismissal for success messages |
| `useNotify()` | hook | Exposes `notify({ type, content })`, `items`, and `dismiss(id)` |

### `frontend/app/providers.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `Providers({ children })` | component | Client wrapper mounting `NotificationProvider` > `AuthProvider` around child components |

### `frontend/components/AppLayout.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `AppLayoutShell({ children })` | component | Renders Cloudscape `TopNavigation` (Route 53 brand + user profile dropdown with Sign out), `SideNavigation` (all 6 sections), `Flashbar`, and `content` slot |

### `frontend/app/(protected)/layout.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `ProtectedLayout({ children })` | component | Renders centered `Spinner` while loading, redirects unauthenticated visitors to `/login`, and wraps authenticated content in `<AppLayoutShell>` |

### `frontend/app/login/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `LoginPage()` | component | Centered Cloudscape `Form` with username/password inputs, demo credentials hint, error alert, and sign-in action |

### `frontend/middleware.ts`
| Symbol | Kind | Description |
|--------|------|-------------|
| `middleware(request)` | function | Next.js Edge middleware performing early check for `session_token` cookie and redirecting to `/login` |

### `frontend/app/(protected)/hosted-zones/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `HostedZonesPage()` | component | Renders `<HostedZonesTable>` inside `<ContentLayout>` and `<Suspense>` boundary |

### `frontend/lib/hooks/use-hosted-zones.ts`
| Symbol | Kind | Description |
|--------|------|-------------|
| `useHostedZones({ search, page, pageSize })` | hook | Queries `GET /api/hosted-zones` with server-side search and pagination, returning `{ data, loading, error, refetch }` |

### `frontend/components/hosted-zones/HostedZonesTable.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `HostedZonesTable()` | component | Cloudscape Table displaying hosted zones with URL-synced debounced TextFilter, Pagination, CollectionPreferences, selection actions, and CRUD modal orchestration |

### `frontend/components/hosted-zones/CreateEditZoneModal.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `CreateEditZoneModal({ visible, zoneToEdit, onDismiss, onSuccess })` | component | Cloudscape Modal + Form for creating (POST) or editing (PUT comment) a hosted zone with inline FormField errorText on 400/409 duplicate conflicts |

### `frontend/components/hosted-zones/DeleteZoneModal.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `DeleteZoneModal({ visible, zone, onDismiss, onSuccess })` | component | Cloudscape confirmation modal requiring exact domain name typing before enabling deletion via DELETE /api/hosted-zones/{id} |

### `frontend/app/(protected)/hosted-zones/[id]/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `ZoneDetailPage()` | component | Zone detail page rendering breadcrumbs, zone metadata summary box, and `<RecordsTable>` |

### `frontend/lib/hooks/use-records.ts`
| Symbol | Kind | Description |
|--------|------|-------------|
| `useRecords({ zoneId, search, type, page, pageSize })` | hook | Queries `GET /api/hosted-zones/{zoneId}/records` with search, type, and pagination filters, returning `{ data, loading, error, refetch }` |

### `frontend/components/records/RecordsTable.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `RecordsTable({ zoneId, zoneName })` | component | Cloudscape Table displaying DNS records with type badges, popovers for truncated values, per-row Edit and Delete actions (disabled for default NS), search, and Type select filter |

### `frontend/components/records/CreateEditRecordModal.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `CreateEditRecordModal({ visible, zoneId, zoneName, recordToEdit, onDismiss, onSuccess })` | component | Cloudscape Modal + Form with dynamic per-type value editors (multi-line textarea, single-line CNAME, repeatable MX/SRV/CAA rows) and inline 400 error handling |

### `frontend/components/records/DeleteRecordModal.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `DeleteRecordModal({ visible, zoneId, record, onDismiss, onSuccess })` | component | Cloudscape confirmation modal calling `DELETE /api/hosted-zones/{zoneId}/records/{id}` |

### `frontend/components/ComingSoon.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `ComingSoon({ feature })` | component | Centered Cloudscape Container displaying info icon, unreleased notice, subtext, and navigation button back to `/hosted-zones` |

### `frontend/app/(protected)/dashboard/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `DashboardPage()` | component | Dashboard overview querying `/api/stats`, rendering 3 summary cards (Hosted zones, DNS records, Name servers) and Get Started guidance |

### `frontend/app/(protected)/health-checks/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `HealthChecksPage()` | component | Renders `<ComingSoon feature="Health checks" />` within ContentLayout |

### `frontend/app/(protected)/traffic-policies/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `TrafficPoliciesPage()` | component | Renders `<ComingSoon feature="Traffic policies" />` within ContentLayout |

### `frontend/app/(protected)/resolver/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `ResolverPage()` | component | Renders `<ComingSoon feature="Resolver" />` within ContentLayout |

### `frontend/app/(protected)/profiles/page.tsx`
| Symbol | Kind | Description |
|--------|------|-------------|
| `ProfilesPage()` | component | Renders `<ComingSoon feature="Profiles" />` within ContentLayout |

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
