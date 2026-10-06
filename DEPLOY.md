# Deploying CareerZen

CareerZen is deployed as one Node/Express service on Render. The React/Vite
frontend is built first and then served by Express from the same origin.

## 1. GitHub

The production-ready repository is:

- 5upr48h47/CareerZen
- main branch

Do not commit real `.env` files, SQLite databases, `node_modules`, build
artifacts, or uploaded user files.

## 2. PostgreSQL

Use an external PostgreSQL provider such as Neon so the database is independent
of Render's expiring/free database offerings.

Create a PostgreSQL database and copy its connection string. It becomes the
Render `DATABASE_URL` value.

## 3. Render

1. Render dashboard → New → Blueprint.
2. Select the GitHub repository `5upr48h47/CareerZen`.
3. Render reads `render.yaml`.
4. Set these environment variables when prompted:
   - `DATABASE_URL` = external PostgreSQL connection string
   - `CORS_ORIGINS` = your Render HTTPS URL
   - `CLIENT_URL` = your Render HTTPS URL
   - `RAZORPAY_KEY_ID` = optional
   - `RAZORPAY_KEY_SECRET` = optional
   - `GEMINI_API_KEY` = optional
5. `JWT_SECRET` is generated automatically by Render.

The service runs:

```text
npm ci
npm run build
npm start
```

At startup, the PostgreSQL schema is pushed automatically before Express starts.

## 4. Health check

After deployment, open:

```text
https://YOUR-APP.onrender.com/api/health
```

A healthy deployment returns JSON from the CareerZen backend.

## 5. Important: uploads

Render's filesystem is ephemeral. Files stored under
`server/src/public/uploads` should not be treated as permanent user storage.

For durable uploads, move avatars/resumes/media to a persistent object-storage
provider such as Cloudinary or Cloudflare R2.

## 6. Local verification

From the project root:

```powershell
npm install
npm run verify:deployment
npm run build
```

The full production build should be verified locally before depending on Render
for the first build.
