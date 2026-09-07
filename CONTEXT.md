# CONTEXT.md — Scaler Project

> **Template instructions**: Update this file at the end of every phase. Fill in every section.
> Leave `(added in Phase N)` placeholders for items not yet implemented.

---

## 1. Status

| Phase | Description                   | Status    |
|-------|-------------------------------|-----------|
| 0     | Repository scaffold           | ✅ Done   |
| 1     | Database models & migrations  | 🔲 Next   |
| 2+    | ...                           | 🔲 Pending |

**Current phase**: 0 — scaffold only. No routers, models, or DB code exist yet.

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
│   │                        #   passlib[bcrypt], python-multipart, python-dotenv
│   ├── venv/                # Python virtualenv (git-ignored)
│   └── app/
│       ├── __init__.py
│       └── main.py          # FastAPI app + CORS + GET /api/health
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

*(added in Phase 1)*

---

## 5. API Contract

### Meta

| Method | Path          | Auth | Description       |
|--------|---------------|------|-------------------|
| GET    | /api/health   | None | Liveness probe    |

*(additional endpoints added in Phase 1+)*

---

## 6. Function Registry

*(added in Phase 1)*

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
