// Cross-platform start entry point.
//
// Pushes the Prisma schema to the database (creating tables on a freshly
// provisioned PostgreSQL database) and then starts the server. `prisma db
// push` is idempotent — it reports "no changes" if the schema already
// matches — so it is safe to run on every deploy.
//
// DATABASE_URL is normally provided by the hosting platform (Render wires
// it from the attached database). If it is missing or points at a
// non-PostgreSQL URL (e.g. the local SQLite dev value), fail fast with a
// clear message instead of attempting a push against a placeholder
// localhost URL — a failed push against localhost just buries the real
// problem (no database attached) under a misleading connection error.
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
if (!/^postgres(ql)?:\/\/.+/.test(env.DATABASE_URL || '')) {
  console.error(
    '\n❌ DATABASE_URL is missing or not a PostgreSQL URL. Render wires it ' +
    'from the attached database — attach the careerzen-db database to this ' +
    'service and ensure DATABASE_URL is set as an env var.'
  );
  process.exit(1);
}

function run(label, cmd, args) {
  console.log(`\n── ${label} ──`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', env, shell: true });
  if (result.status !== 0) {
    console.error(`\n❌ ${label} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

// 1. Create database tables from the PostgreSQL schema
run('Pushing schema to database', 'npm', ['--prefix', 'server', 'run', 'db:postgres:push']);

// 2. Start the server
run('Starting server', 'node', ['server/src/index.js']);