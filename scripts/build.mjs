// Production build for Render.
import { spawnSync } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build';
const env = { ...process.env, DATABASE_URL };

function run(label, cmd, args) {
  console.log('\n-- ' + label + ' --');
  const result = spawnSync(cmd, args, { stdio: 'inherit', env, shell: true });
  if (result.status !== 0) {
    console.error('\nBuild step failed: ' + label);
    process.exit(result.status || 1);
  }
}

run('Building React frontend', 'npm', ['--prefix', 'client', 'run', 'build']);
run('Generating PostgreSQL Prisma Client', 'npm', ['--prefix', 'server', 'run', 'db:postgres:generate']);

console.log('\nCareerZen production build complete');