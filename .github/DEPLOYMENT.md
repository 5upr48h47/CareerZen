# CareerZen Deployment

## Architecture

GitHub -> Render Free Web Service -> external PostgreSQL.

The React/Vite frontend is built into `client/dist`, and Express serves that build together with the `/api` backend from the same Render service.

## Render environment variables

Required: `DATABASE_URL`, `CORS_ORIGINS`, `CLIENT_URL`.

Generated automatically: `JWT_SECRET`.

Optional: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `GEMINI_API_KEY`.

## Database

Use an external PostgreSQL provider such as Neon. Do not add a Render PostgreSQL database to the Blueprint if the goal is a long-lived free setup.

At startup, `scripts/start.mjs` pushes the generated PostgreSQL Prisma schema before starting Express.

## Deployment commands

Render runs:

`npm ci && npm run build`

then:

`npm start`

## Storage

Render's free filesystem is ephemeral. User uploads under `server/src/public/uploads` should eventually be moved to durable object storage such as Cloudinary or Cloudflare R2.

## Local checks

`npm install`

`npm run verify:deployment`

`npm run build`
