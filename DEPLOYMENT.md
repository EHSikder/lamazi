# LAMAZI Sweets — Deployment Guide

This guide gets the **exact same** site you see in development live on the public internet, on Vercel + Render + Supabase. **Free tier on all three.** Follow each step in order — don't skip.

If you've followed this guide before and the build failed, scroll to "If things go wrong" at the bottom and read that section first.

---

## 0 · What you'll need before you start

| Service | What for | Free? | Sign-up link |
|---|---|---|---|
| **GitHub** | Hosts the code | yes | https://github.com/signup |
| **Vercel** | Hosts the website (React) | yes | https://vercel.com/signup |
| **Render** | Hosts the API (FastAPI) | yes | https://render.com/register |
| **Supabase** | Database, login, realtime | yes (already set up) | https://supabase.com |

It also helps to have:
- A password manager (1Password / Bitwarden / Apple Keychain) — you'll be copy-pasting secret keys.
- Chrome or Safari (not Internet Explorer 😄).

---

## 1 · Get the code into your own GitHub

You can't deploy directly from Emergent — the deployment platforms read from GitHub.

1. Go to https://github.com/new and create a **new private** repo called `lamazi-sweets` (don't add a README or .gitignore — leave it empty).
2. Back in Emergent's chat, type: **"Push to GitHub"** and confirm the repo you just created. Wait until you see "pushed".
3. Open https://github.com/<your-username>/lamazi-sweets in your browser and verify you see folders `backend/` and `frontend/`. If yes, ✅.

---

## 2 · Deploy the backend on Render

The backend is a small Python (FastAPI) service. We'll pin it to **Python 3.11** because newer versions (3.14) don't yet have wheels for some packages.

1. Go to https://dashboard.render.com → **New +** → **Web Service**.
2. **Connect a Git repository** → pick `lamazi-sweets` (you may need to authorise Render to read your repo first — click "Configure GitHub app").
3. Fill in **exactly** as below:

   | Field | Value |
   |---|---|
   | Name | `lamazi-api` |
   | Region | `Frankfurt` (closest to Kuwait) |
   | Branch | `main` |
   | **Root Directory** | **`backend`** ← important! |
   | Runtime | `Python 3` |
   | Build Command | `pip install --upgrade pip && pip install -r requirements.txt` |
   | Start Command | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | `Free` |

4. Scroll to **Environment Variables** → click **Advanced** → add the following one at a time. Get the actual values from the secure note we agreed on; **do not paste them into screenshots or chats**:

   ```
   PYTHON_VERSION       = 3.11.10
   SUPABASE_URL         = https://sqhjsctsxlnivcbeclrn.supabase.co
   SUPABASE_ANON_KEY    = <your Supabase anon key>
   SUPABASE_SERVICE_KEY = <your Supabase service_role key — SECRET>
   TENANT_ID            = f1b0c252-6921-40c2-9f39-77e0c35225b9
   BRANCH_ID            = e5895a11-73cb-4c39-be93-a6b4f90acd05
   TAP_PUBLIC_KEY       = <Tap publishable key>
   TAP_SECRET_KEY       = <Tap secret key — SECRET>
   TAP_MERCHANT_ID      = 68010541
   ARMADA_BASE_URL      = https://api.armadadelivery.com/v2
   ARMADA_API_KEY       = <Armada access token>
   ARMADA_API_SECRET    = <Armada api secret>
   ARMADA_BRANCH_ID     = 249cae6d-eeb9-485d-823d-b1cf01b64e98
   CORS_ORIGINS         = *
   FRONTEND_URL         = (leave empty for now — we fill this AFTER Step 3)
   ```

   The keys marked **SECRET** must never be put anywhere else. Especially not on the frontend.

5. Click **Create Web Service** at the bottom. Render starts building. The first build takes **3–6 minutes**.
6. When the status turns green (you see "Live"), copy the URL at the top — it looks like `https://lamazi-api.onrender.com`.
7. **Test it now:** open `https://lamazi-api.onrender.com/api/health` in your browser. You should see:
   ```json
   {"status":"healthy","time_kw":"…"}
   ```
   If you see this, ✅ backend is live.
   If not, jump to "If things go wrong → Render".

> ⚠ Free tier note: Render free instances **sleep after 15 minutes of inactivity** and take ~30 seconds to wake on the next request. That's fine for a small bakery — but the very first order of the day might feel slow. Upgrade to Render Starter ($7/mo) to keep it always-on.

---

## 3 · Deploy the frontend on Vercel

The frontend is a React (Create React App) app. We'll pin it to **Node 20**.

1. Go to https://vercel.com/new and click **Import** next to your `lamazi-sweets` repo.
2. On the **Configure Project** screen:

   | Field | Value |
   |---|---|
   | Framework Preset | **Create React App** (Vercel should auto-detect this) |
   | **Root Directory** | **`frontend`** ← click "Edit", then pick the `frontend` folder |
   | Build Command | leave the default (`yarn build` — already set in `vercel.json`) |
   | Output Directory | `build` |
   | Install Command | leave default (`yarn install --frozen-lockfile` — set in `vercel.json`) |
   | Node.js Version | `20.x` (Vercel reads `.nvmrc` automatically) |

3. Expand **Environment Variables** and add **all 5** below. Make sure each one is set for **Production, Preview, AND Development**:

   ```
   REACT_APP_BACKEND_URL       = https://lamazi-api.onrender.com    (← URL from Step 2)
   REACT_APP_SUPABASE_URL      = https://sqhjsctsxlnivcbeclrn.supabase.co
   REACT_APP_SUPABASE_ANON_KEY = <your Supabase anon key — same as backend>
   REACT_APP_TENANT_ID         = f1b0c252-6921-40c2-9f39-77e0c35225b9
   REACT_APP_BRANCH_ID         = e5895a11-73cb-4c39-be93-a6b4f90acd05
   ```

   ⚠ **Never** put `SUPABASE_SERVICE_KEY`, `TAP_SECRET_KEY` or `ARMADA_API_SECRET` here. Anything that starts with `REACT_APP_` ends up in the browser bundle and would be public.

4. Click **Deploy**. The build takes ~2 minutes.
5. Vercel gives you a URL like `https://lamazi-sweets.vercel.app`. Open it and check the home page loads with cakes.
6. **Now go back to Render** → your `lamazi-api` → **Environment** → set:
   ```
   FRONTEND_URL = https://lamazi-sweets.vercel.app   (or whatever Vercel gave you)
   ```
   Save. Render auto-redeploys (~2 min). This step is needed so that Tap Payments can redirect back to your site after a successful payment.

---

## 4 · One-time Supabase setup

1. Open https://supabase.com and sign in. Pick the `lamazi` project.

### 4.1 Enable Realtime on the `orders` table

Without this, new orders won't trigger the alert sound in the admin panel and customers won't see live order status updates.

1. Sidebar → **Database** → **Replication**.
2. Find the `supabase_realtime` publication → click **0 tables** (or similar).
3. Toggle the `orders` table to **ON**. Save.

### 4.2 Set Site URL and Redirect URLs

1. Sidebar → **Authentication** → **URL Configuration**.
2. **Site URL** → `https://lamazi-sweets.vercel.app` (your Vercel URL).
3. **Redirect URLs** → add the same URL with a trailing slash too, plus any custom domain you'll add later.

### 4.3 Create your first admin user

1. **Authentication** → **Users** → **Add user** → **Create new user** (NOT invitation). Use your real email + a strong password. Tick "Auto Confirm User" so you can log in immediately.
2. Once created, click the user row and copy the **UID** (a UUID like `4d0e…`).
3. Sidebar → **Table Editor** → switch to the **`public`** schema → click the **`users`** table → **Insert row**:

   | Column | Value |
   |---|---|
   | `id` | leave empty (auto-generated) |
   | `tenant_id` | `f1b0c252-6921-40c2-9f39-77e0c35225b9` |
   | `branch_id` | `e5895a11-73cb-4c39-be93-a6b4f90acd05` |
   | `email` | the email you used above |
   | `name` | your name |
   | `role` | `admin` |
   | `status` | `active` |

   Click Save. Now you can sign in at `https://lamazi-sweets.vercel.app/admin/login`.

---

## 5 · Register the webhooks

Webhooks are how Tap and Armada notify your backend that something happened (payment captured, driver delivered, etc.).

### Tap Payments

1. Log in to https://www.tap.company/ → Dashboard.
2. Find **Webhooks** (sometimes under Developers → Webhooks).
3. Add a new endpoint:
   - URL: `https://lamazi-api.onrender.com/api/tap/webhook`
   - Events: `charge.captured`, `charge.failed`
4. Save.

### Armada Deliveries

1. Log in to Armada dashboard.
2. Find webhook / callback settings.
3. Add: `https://lamazi-api.onrender.com/api/armada/webhook` (method POST).
4. If you can't find the page in their UI, email Armada support with that URL — they'll add it.

---

## 6 · Smoke test (5 minutes)

Open these URLs in order. Each should pass before moving on.

| # | URL | Expected |
|---|---|---|
| 1 | `https://lamazi-api.onrender.com/api/health` | `{"status":"healthy"}` |
| 2 | `https://lamazi-api.onrender.com/api/menu/categories` | JSON array with at least one category |
| 3 | `https://lamazi-sweets.vercel.app/` | Home page with hero + cakes |
| 4 | `https://lamazi-sweets.vercel.app/menu` | All cakes show up |
| 5 | Sign up as a new customer at `/auth` | Account created, you're logged in |
| 6 | Place a small test order with COD at `/checkout` (Pickup, so you don't need a real address) | You land on `/order/<id>` |
| 7 | Sign in to `/admin/login` with your admin user (Step 4.3) | You see the dashboard |
| 8 | In admin → Orders, the test order from step 6 should appear with an audio alert | Hear the beep, click Accept |

If all 8 pass: **🎉 you are live**.

---

## 7 · If things go wrong

### Render build fails: "Could not find a version that satisfies the requirement emergentintegrations"

That means the build is reading an old `requirements.txt`. Fixes (in order):

1. In GitHub, open `backend/requirements.txt`. It should have **only these 5 lines**:
   ```
   fastapi==0.115.6
   uvicorn[standard]==0.34.0
   python-dotenv==1.0.1
   httpx==0.28.1
   pydantic==2.10.4
   ```
2. If it has more lines, the latest code wasn't pushed. Push again and trigger a Render **Manual Deploy → Clear build cache & deploy**.

### Render build fails: "ERROR: No matching distribution found for ..." (any package)

You're on Python 3.14 (Render's new default). Fix:

1. In Render → your service → **Environment** → add `PYTHON_VERSION = 3.11.10`. Save.
2. **Manual Deploy → Clear build cache & deploy**.

### Vercel build fails: "ERESOLVE unable to resolve dependency tree"

This is the `date-fns` vs `react-day-picker` peer conflict. Fixes:

1. Make sure `frontend/package.json` has `"date-fns": "^3.6.0"` (not `^4.x`).
2. Make sure `frontend/.npmrc` exists with `legacy-peer-deps=true` inside.
3. Make sure `frontend/yarn.lock` is committed to GitHub.
4. In Vercel → Settings → General → **Install Command** → set explicitly:
   `yarn install --frozen-lockfile`
5. Redeploy.

### Vercel uses npm instead of yarn

Vercel prefers yarn if `yarn.lock` exists. If it's still using npm:

1. Confirm `frontend/yarn.lock` exists in your GitHub repo.
2. In Vercel → Settings → General → **Install Command** → set `yarn install --frozen-lockfile`.
3. Redeploy.

### Vercel build succeeds but pages 404 on refresh

Make sure `frontend/vercel.json` contains:
```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```
That tells Vercel to serve `index.html` for any unknown path so React Router can handle it.

### "CORS error" in the browser when calling the API

Render → Environment → set `CORS_ORIGINS = *` (or specifically your Vercel URL). Save → wait for redeploy.

### Admin login says "Not authorised"

You created the Supabase Auth user but forgot to insert the row in `public.users`. Go back to Step 4.3.

### Map tiles are blank on /checkout

OpenStreetMap is being blocked. Try a different browser, disable any ad-blocker on the site, or try a private window.

### Render free instance is slow

Free instances sleep after 15 minutes of inactivity. First request after a sleep takes ~30 seconds. Either:
- Upgrade to Render Starter ($7/mo), or
- Use a free uptime-pinger like https://cron-job.org to hit `/api/health` every 10 minutes.

---

## 8 · Updating the site after the first deploy

Once everything is wired up, deploying changes is a one-step process:

1. Edit a file (in Emergent or locally).
2. Commit + push to GitHub `main`.
3. Vercel and Render auto-detect the push and redeploy. Wait ~2 minutes.
4. Refresh the live site.

No buttons to click. No SSH. No FTP.

---

## 9 · File reference

These are the production config files already in the repo. You shouldn't need to edit them.

| File | Purpose |
|---|---|
| `backend/requirements.txt` | Python deps (5 lines) — used by Render |
| `backend/.python-version` | Pins Python 3.11.10 |
| `backend/render.yaml` | Optional: Render blueprint (auto-detected) |
| `backend/Procfile` | Optional: also works on Heroku-style hosts |
| `frontend/package.json` | Node deps + `engines: node >=18.18 <21` |
| `frontend/.nvmrc` | Pins Node 20.18.0 |
| `frontend/.npmrc` | `legacy-peer-deps=true` fallback |
| `frontend/vercel.json` | Vercel config: install/build commands + SPA rewrites |
| `frontend/yarn.lock` | Locked dep versions (commit this!) |

---

## 10 · Custom domain (optional)

When you're ready to use `lamazisweets.com` instead of the Vercel default URL:

1. Buy the domain on Namecheap or Cloudflare.
2. Vercel → Settings → Domains → add your domain → Vercel shows DNS records to set.
3. Add those DNS records at your domain registrar.
4. Wait 10–30 minutes for DNS propagation.
5. Go to Supabase → Authentication → URL Configuration → add the new domain to **Site URL** and **Redirect URLs**.
6. Update Tap and Armada webhooks if needed (they call the **backend** URL, not the frontend — so you only need to update if you also move the backend to a custom domain).

---

If you get stuck on a specific step, message the engineer with:

1. Which step number you're on.
2. A screenshot of the page.
3. The first error line from **Render → Logs** (for backend issues) or **Vercel → Deployments → the failed build → Build Logs** (for frontend issues).

That's it. Welcome to production. 🍰
