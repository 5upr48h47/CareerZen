// Cross-platform build entry point.
//
// Render's build container runs on Linux, but this script also works on
// Windows, where `DATABASE_URL=foo npm ...` inline-env syntax is not
// recognized by cmd.exe. Setting the env var in Node first sidesteps
// that entirely.
//
// Steps:
//   1. Build the React frontend (client/dist)
//   2. Generate a PostgreSQL Prisma Client. The real DATABASE_URL is only
//      resolved at runtime (Render wires it from the attached database), so
//      the build step uses a placeholder — the generated client is
//      provider-bound, not URL-bound.
import { spawnSync } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://build@localhost:5432/build';
const env = { ...process.env, DATABASE_URL };

function run(label, cmd, args) {
  console.log(`\n── ${label} ──`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', env, shell: true });
  if (result.status !== 0) {
    console.error(`\n❌ ${label} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

// 1. Build the React frontend
run('Building React frontend', 'npm', ['--prefix', 'client', 'run', 'build']);

// 2. Generate a PostgreSQL Prisma Client
run('Generating PostgreSQL Prisma Client', 'npm', ['--prefix', 'server', 'run', 'db:postgres:generate']);

console.log('\n✅ Build complete');