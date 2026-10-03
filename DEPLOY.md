# Deploying CareerZen

This app deploys as **one Node service**. Render builds the React frontend and
Express serves it from the same origin, so the SPA and API share a domain — no
CORS configuration, no reverse proxy, one TLS certificate.

---

## 1. Prerequisites

| Thing | Why | Free? |
|---|---|---|
| GitHub account | Render deploys from your repo | ✅ |
| Render account | Hosting + PostgreSQL | ✅ free tier |
| Razorpay account | Live payments (`rzp_live_*` keys) | ✅ |
| Google account | Gemini API key for real AI features | ✅ |

---

## 2. Push the code

```bash
cd careerconnect
git add .
git commit -m "CareerZen deployment prep"
git branch -M main
git remote add origin https://github.com/<you>/careerzen.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `*.db`, `node_modules`, and `dist`, so no
secrets or database files get committed. Verify before pushing:

```bash
git status --ignored | grep -E "\.env|\.db$"   # these must NOT appear as tracked
```

---

## 3. Create the database

Two free options:

**Option A — Render PostgreSQL** (declared in `render.yaml`)
Provisioned automatically when you connect the Blueprint. Note: Render's free
Postgres **expires after 30 days**, so you must recreate it or migrate.

**Option B — Neon** (recommended, no expiry)
1. Sign up at https://neon.tech
2. Create a project, copy the connection string
3. Paste it into Render's `DATABASE_URL` env var

Then create the tables:

```bash
# From server/, with DATABASE_URL set to your Postgres string:
npx prisma generate --schema prisma/schema.postgres.prisma
npx prisma db push --schema prisma/schema.postgres.prisma
```

> `schema.postgres.prisma` is generated from `schema.prisma` by
> `node scripts/use-postgres.mjs`. Prisma requires the datasource provider to
> be a literal, so the two dialects live in separate schema files.

---

## 4. Deploy on Render

1. Render dashboard → **New → Blueprint**
2. Select your repo — it reads `render.yaml` automatically
3. Fill in the `sync: false` env vars it asks for:

| Variable | Value |
|---|---|
| `CORS_ORIGINS` | `https://your-app.onrender.com` |
| `CLIENT_URL` | `https://your-app.onrender.com` |
| `RAZORPAY_KEY_ID` | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | from Razorpay dashboard |
| `GEMINI_API_KEY` | optional, enables real LLM inference |

`JWT_SECRET` is generated automatically. `DATABASE_URL` is wired to the
attached database.

---

## 5. After first deploy

```bash
# Remove the demo accounts and all their seeded content (jobs, posts,
# collaborations, profiles with demo projects). They all share the password
# "password123" and one of them is a recruiter who can post jobs.
node server/scripts/remove-demo-data.mjs --yes

# Remove every remaining non-admin account and its data — keeps only your
# real admin account(s). Run this after promoting yourself, so the public
# database starts with nothing but genuine self-registered users.
node server/scripts/promote-admin.mjs you@example.com
node server/scripts/wipe-nonadmin.mjs --yes

# Promote your real account to admin
node server/scripts/promote-admin.mjs you@example.com
```

Then register your account through the UI, and run the promote command.

---

## Free-tier limits to expect

| Limitation | Impact | Workaround |
|---|---|---|
| Service sleeps after ~15 min idle | First request takes ~30s | Acceptable for a demo |
| Free Postgres expires in 30 days (Render) | Database disappears | Use Neon instead |
| 512 MB RAM | Fine for this app | — |
| No persistent disk | Uploads are lost on redeploy | Move to Cloudinary/R2 (below) |

---

## Uploads (optional but recommended)

Avatars, resumes, and QR images are written to `server/public/uploads`, which
is **ephemeral on Render** — they vanish on every deploy. For free durable
storage, either:

- **Cloudinary** — 25 GB free, no egress fees
- **Cloudflare R2** — 10 GB free, zero egress

Both need a small change in `server/src/services/upload.js` to swap the multer
disk destination for their SDK. I can write that integration if you want it.

---

## Verify the deployment

```bash
curl https://your-app.onrender.com/api/health
# {"status":"ok","service":"CareerZen Backend API",...}
```

If that returns JSON, the backend is live and the SPA is being served from the
same origin.