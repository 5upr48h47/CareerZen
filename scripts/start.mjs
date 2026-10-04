// Cross-platform start entry point.
//
// Pushes the Prisma schema to the database (creating tables on a freshly
// provisioned PostgreSQL database) and then starts the server. `prisma db
// push` is idempotent — it reports "no changes" if the schema already
// matches — so it is safe to run on every deploy.
import { spawnSync } from 'node:child_process';

function run(label, cmd, args) {
  console.log(`\n── ${label} ──`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: true });
  if (result.status !== 0) {
    console.error(`\n❌ ${label} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

// 1. Create database tables from the PostgreSQL schema
run('Pushing schema to database', 'npm', ['--prefix', 'server', 'run', 'db:postgres:push']);

// 2. Start the server
run('Starting server', 'node', ['server/src/index.js']);