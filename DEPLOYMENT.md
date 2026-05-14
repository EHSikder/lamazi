# LAMAZI Sweets — Deployment Guide

**This guide assumes you've never deployed an app before.** Follow it step by step. If something is unclear, just stop and ask — don't try to "figure it out" by changing files randomly.

## What you're deploying

LAMAZI is two pieces that need to be hosted separately, plus one cloud database:

1. **Frontend** (the website customers see) — React app, deploys to **Vercel**.
2. **Backend** (the API behind it) — FastAPI app, deploys to **Render**.
3. **Database + Auth + Realtime** — already running on **Supabase**, nothing to deploy.

You will need accounts on all three (all free to start):
- https://vercel.com
- https://render.com
- https://supabase.com (already set up — you already have it)
- A GitHub account to host the code: https://github.com

---

## Step 1 · Push the code to GitHub

1. Go to https://github.com/new and create a new private repository named `lamazi-sweets`.
2. In the Emergent workspace, open the chat and type **"Push to GitHub"** — Emergent will push everything for you to that new repo.
   (Or if you prefer manual: download the project zip from Emergent and `git push` from your computer.)

After this step, your code is on GitHub at `https://github.com/<you>/lamazi-sweets`.

---

## Step 2 · Deploy the backend to Render

1. Open https://dashboard.render.com and click **New +** → **Web Service**.
2. Connect your GitHub account and pick the `lamazi-sweets` repo.
3. Fill in the fields:
   - **Name**: `lamazi-api`
   - **Region**: Frankfurt (closest to Kuwait)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free (you can upgrade later)
4. Scroll down to **Environment Variables** and add these one by one (paste from your secure note, **not** from this file):

   ```
   SUPABASE_URL                = https://sqhjsctsxlnivcbeclrn.supabase.co
   SUPABASE_ANON_KEY           = <your anon key>
   SUPABASE_SERVICE_KEY        = <your service role key — keep secret>
   TENANT_ID                   = f1b0c252-6921-40c2-9f39-77e0c35225b9
   BRANCH_ID                   = e5895a11-73cb-4c39-be93-a6b4f90acd05
   TAP_PUBLIC_KEY              = <Tap publishable key>
   TAP_SECRET_KEY              = <Tap secret key — keep secret>
   TAP_MERCHANT_ID             = 68010541
   ARMADA_BASE_URL             = https://api.armadadelivery.com/v2
   ARMADA_API_KEY              = <Armada access token>
   ARMADA_API_SECRET           = <Armada api secret>
   ARMADA_BRANCH_ID            = 249cae6d-eeb9-485d-823d-b1cf01b64e98
   CORS_ORIGINS                = *
   FRONTEND_URL                = (leave blank for now — we'll fill this after Step 3)
   ```

   ⚠ The ones marked "keep secret" must **never** be shared, screenshotted, or pasted in any frontend file.

5. Click **Create Web Service**. Render will build for a few minutes. When it's green, copy the URL — it will look like `https://lamazi-api.onrender.com`.
6. Quick test: visit `https://lamazi-api.onrender.com/api/health` in your browser. You should see `{"status":"healthy", ...}`. If not, check Render → Logs and fix any errors.

---

## Step 3 · Deploy the frontend to Vercel

1. Open https://vercel.com/new and import the same GitHub repo.
2. Fill in the fields:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `frontend`
   - **Build Command**: (leave the default — `yarn build`)
   - **Output Directory**: `build`
3. Expand **Environment Variables** and add:

   ```
   REACT_APP_BACKEND_URL       = https://lamazi-api.onrender.com   (← your Render URL from Step 2)
   REACT_APP_SUPABASE_URL      = https://sqhjsctsxlnivcbeclrn.supabase.co
   REACT_APP_SUPABASE_ANON_KEY = <your Supabase anon key>
   REACT_APP_TENANT_ID         = f1b0c252-6921-40c2-9f39-77e0c35225b9
   REACT_APP_BRANCH_ID         = e5895a11-73cb-4c39-be93-a6b4f90acd05
   ```

   ⚠ **Never** put `SUPABASE_SERVICE_KEY`, `TAP_SECRET_KEY` or `ARMADA_API_SECRET` here. Those belong on the backend only.

4. Click **Deploy**. Wait ~2 minutes. Vercel gives you a URL like `https://lamazi-sweets.vercel.app`.
5. Go back to Render → your `lamazi-api` service → Environment → set `FRONTEND_URL = https://lamazi-sweets.vercel.app` (or whatever Vercel gave you). Save. Render redeploys automatically.

---

## Step 4 · One-time Supabase setup

1. Log into https://supabase.com and open the **lamazi** project.
2. **Database → Replication** → find the `orders` table → enable **realtime**. (Without this, the admin "new order" alert and live order tracking won't update.)
3. **Authentication → URL Configuration** → set:
   - Site URL: `https://lamazi-sweets.vercel.app` (your Vercel URL)
   - Redirect URLs: add the same URL.

4. Create your first admin user:
   - **Authentication → Users → Add User** (Send invitation OR create with password). Use your email + a strong password.
   - **Table Editor → users (under `public`)** → click **Insert row** → fill in:
     - `tenant_id` = `f1b0c252-6921-40c2-9f39-77e0c35225b9`
     - `branch_id` = `e5895a11-73cb-4c39-be93-a6b4f90acd05`
     - `email` = (the same email you used above)
     - `name` = your name
     - `role` = `admin`
     - `status` = `active`
   - Save. You can now log in at `https://lamazi-sweets.vercel.app/admin/login`.

---

## Step 5 · Register the webhooks

Webhooks are how Tap and Armada tell our backend "something happened" (payment captured, driver delivered, etc.).

1. **Tap Payments dashboard** → Webhooks → add:
   `https://lamazi-api.onrender.com/api/tap/webhook` · Method POST · Events: `charge.captured`, `charge.failed`.
2. **Armada dashboard** → Webhooks → add:
   `https://lamazi-api.onrender.com/api/armada/webhook` · Method POST.

If Tap or Armada don't show a Webhooks page, ask their support to register the URLs — just give them those two URLs.

---

## Step 6 · Smoke-test the whole thing

Open these in a browser, in order:

1. `https://lamazi-api.onrender.com/api/health` → should say healthy.
2. `https://lamazi-sweets.vercel.app/` → home page loads with cakes.
3. `https://lamazi-sweets.vercel.app/menu` → all menu items show.
4. `https://lamazi-sweets.vercel.app/admin/login` → log in with the admin user you made in Step 4.

If everything passes, **you're live**. 🎉

---

## Common issues

| Problem | Likely cause | Fix |
|---|---|---|
| Vercel deploy fails with "out of memory" | Free tier limit | Switch to Vercel Pro, or use Netlify with the same env vars |
| Backend says "401 Unauthorized" on every call | Wrong Supabase service key on Render | Re-copy the service_role key from Supabase → Settings → API, paste into Render |
| New orders don't trigger the alert sound | Forgot Step 4.2 (Realtime replication) | Enable realtime on `orders` table |
| Tap redirects to a "trust this site" page | Mixed protocols / wrong FRONTEND_URL | Make sure `FRONTEND_URL` on Render is **exactly** your Vercel `https://` URL |
| Admin login says "Not authorised" | Missed Step 4.4 (insert `users` row) | Insert the row with `role=admin` and `status=active` |
| Map tiles are blank | Browser blocked OpenStreetMap | Disable ad blocker on the site, or try a different browser |

---

## Production files in this repo

- `frontend/vercel.json` — single-page-app rewrite so direct URLs like `/menu` work after refresh.
- `backend/render.yaml` — Render service blueprint (so future redeploys can be one-click).
- `backend/requirements.txt` — Python deps (auto-installed by Render).
- `frontend/package.json` → `build` script (auto-detected by Vercel).

You shouldn't need to edit these.

---

## Updating the site

After your initial setup, **every push to GitHub** automatically redeploys both Vercel and Render. No buttons to click. To make a small change:

1. Edit a file in the Emergent workspace or your laptop.
2. Save / commit / push.
3. Wait 2 minutes.
4. Refresh the live site.

---

If you get stuck, message the engineer with:
- The page URL where the error shows up
- A screenshot of the browser
- The first error line from Render → Logs (if backend) or Vercel → Functions → Logs (if frontend)
