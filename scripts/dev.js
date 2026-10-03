// Run the backend and Vite dev server together, so `npm run dev` works from the
// repo root instead of opening two terminals.
//
// Backend binds the port in server/.env; Vite proxies /api and /ws to it.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const procs = [];

function run(name, cwd, cmd, args) {
  const p = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  p.on('exit', (code) => {
    console.log(`\n[${name}] exited with code ${code}`);
    shutdown(code ?? 0);
  });
  procs.push(p);
  return p;
}

function shutdown(code = 0) {
  for (const p of procs) {
    if (!p.killed) p.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting CareerZen (backend + frontend)...\n');
run('server', path.join(root, 'server'), 'npm', ['run', 'dev']);
run('client', path.join(root, 'client'), 'npm', ['run', 'dev']);

console.log('\nFrontend: http://localhost:5173');
console.log('Backend API: http://localhost:5009/api\n');