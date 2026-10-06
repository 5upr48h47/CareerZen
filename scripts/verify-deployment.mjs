import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = ['package.json','package-lock.json','render.yaml','scripts/build.mjs','scripts/start.mjs','server/prisma/schema.prisma','server/scripts/use-postgres.mjs','client/package.json'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) { console.error('Missing deployment files:', missing.join(', ')); process.exit(1); }
const forbidden = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (['.git','node_modules','dist'].includes(entry.name)) continue; const full=path.join(dir,entry.name); if (entry.isDirectory()) walk(full); else if (/\.env($|\.(?!example$))/.test(entry.name) || /\.db($|-journal|-wal|-shm)$/.test(entry.name)) forbidden.push(path.relative(root,full)); } }
walk(root);
if (forbidden.length) { console.error('Forbidden deployment artifacts found:', forbidden.join(', ')); process.exit(1); }
console.log('CareerZen deployment package verification passed.');
