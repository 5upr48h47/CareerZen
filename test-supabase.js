// ESM-compatible connectivity check. Run from the repo root:
//   node test-supabase.js
// Requires DATABASE_URL to point at your Supabase Postgres instance.
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => { console.log('CONNECTED'); return p.$queryRaw`SELECT current_database(), current_user`; })
  .then(r => console.log(JSON.stringify(r)))
  .catch(e => { console.error('FAILED:', e.message); process.exit(1); });