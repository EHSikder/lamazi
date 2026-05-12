# LAMAZI Sweets — Deployment Guide

This project is **adapted for the Emergent platform** (React + FastAPI + Supabase). The original spec asked for Next.js on Vercel + Express on Render; the equivalent deployment maps directly because:

- **Frontend (React, port 3000)** — replaces the Next.js app
- **Backend (FastAPI, port 8001)** — replaces the Express server (Tap charges, Armada dispatch, Supabase REST proxy)
- **Database + Auth** — Supabase (unchanged)

If you later migrate to Vercel + Render, the env-var layout below transfers 1:1.

---

## 1 · Environment variables

### Backend (`/app/backend/.env` on Emergent, or Render → Environment)
```
SUPABASE_URL=https://sqhjsctsxlnivcbeclrn.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key — server-side only>
TENANT_ID=f1b0c252-6921-40c2-9f39-77e0c35225b9
BRANCH_ID=e5895a11-73cb-4c39-be93-a6b4f90acd05

TAP_PUBLIC_KEY=pk_live_...
TAP_SECRET_KEY=sk_live_...           # never exposed to client
TAP_MERCHANT_ID=68010541

ARMADA_BASE_URL=https://api.armadadelivery.com/v2
ARMADA_API_KEY=main_...
ARMADA_API_SECRET=...
ARMADA_BRANCH_ID=249cae6d-eeb9-485d-823d-b1cf01b64e98

FRONTEND_URL=https://<your-public-url>
CORS_ORIGINS=*
```

### Frontend (`/app/frontend/.env` on Emergent, or Vercel → Environment)
```
REACT_APP_BACKEND_URL=https://<backend public url>
REACT_APP_SUPABASE_URL=https://sqhjsctsxlnivcbeclrn.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon key>
REACT_APP_TENANT_ID=f1b0c252-6921-40c2-9f39-77e0c35225b9
REACT_APP_BRANCH_ID=e5895a11-73cb-4c39-be93-a6b4f90acd05
```

⚠ **Never** put `SUPABASE_SERVICE_KEY`, `TAP_SECRET_KEY` or `ARMADA_API_SECRET` in any file that starts with `REACT_APP_`.

---

## 2 · Supabase setup

The schema is already in place. Two one-time configuration steps are required from the dashboard:

1. **Realtime**: Database → Replication → enable replication on the `orders` table (used by `/order/:id` tracking page and `/admin/orders` new-order alert).
2. **Admin user**: Auth → Users → invite/create your admin email + password. Then in the Table Editor, insert a row in `public.users`:
   ```
   id            <auto>
   tenant_id     f1b0c252-6921-40c2-9f39-77e0c35225b9
   branch_id     e5895a11-73cb-4c39-be93-a6b4f90acd05
   email         admin@lamazi.com
   name          Lamazi Admin
   role          admin
   status        active
   ```

Row Level Security: this template intentionally uses the **service role key from the backend** to bypass RLS. If you choose to enable RLS later, scope all policies by `tenant_id` + `branch_id`.

---

## 3 · Webhook URLs to register

Once your backend is publicly reachable (e.g. on Render at `https://lamazi-api.onrender.com`):

| Provider | Path | Method |
|---|---|---|
| Tap Payments | `/api/tap/webhook` | POST |
| Armada | `/api/armada/webhook` | POST |

Register both URLs in their respective dashboards. Tap's webhook is a backup — the primary success path is the redirect `→ /payment-result?tap_id=…` which calls `/api/payment/verify`.

---

## 4 · Initial data checklist

- [ ] At least one **category** in `public.categories` (already seeded — "Gathering")
- [ ] At least one **item** in `public.items` (already seeded — 6 cakes)
- [ ] **Loyalty settings** row in `public.loyalty_settings` (seeded)
- [ ] At least one **delivery zone** in `public.delivery_zones` (otherwise zone check is skipped at checkout)
- [ ] `branches.operating_hours` JSON for your branch
- [ ] One **admin user** in `public.users` (see step 2)

---

## 5 · Quick smoke test

After deploying, hit:

- `GET <backend>/api/health` → `{"status":"healthy"}`
- `GET <backend>/api/menu/categories` → array of categories
- `GET <backend>/api/branch/status` → `{"is_open": true, ...}` during operating hours
- Visit `<frontend>/` → home page loads with hero + cakes
- Visit `<frontend>/admin/login` → admin login screen

---

## 6 · Migrating to Vercel + Render (later, optional)

| Original (Next.js) | This template (CRA) | Effort |
|---|---|---|
| `app/(main)/page.tsx` | `src/pages/Home.jsx` | rename + import paths |
| `app/api/*` route handlers | `backend/server.py` FastAPI routes | already separate |
| `import.meta.env.VITE_*` | `process.env.REACT_APP_*` | search/replace |
| `next/link`, `next/navigation` | `react-router-dom` | search/replace |

The Tap, Armada, Supabase and business logic are unchanged.
