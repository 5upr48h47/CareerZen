// Cross-platform start entry point.
//
// Pushes the Prisma schema to an external PostgreSQL database and then starts
// the server. `prisma db push` is idempotent and safe to run on deploy.
//
// DATABASE_URL must be supplied by the hosting platform. Fail fast when it is
// missing or still points to the local SQLite development database.
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
if (!/^postgres(ql)?:\/\/.+/.test(env.DATABASE_URL || '')) {
  console.error(
    '\n❌ DATABASE_URL is missing or not a PostgreSQL URL. Set DATABASE_URL ' +
    'to your external PostgreSQL connection string (for example Neon).'
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

run('Pushing schema to external PostgreSQL database', 'npm', [
  '--prefix',
  'server',
  'run',
  'db:postgres:push',
]);

run('Starting server', 'node', ['server/src/index.js']);
