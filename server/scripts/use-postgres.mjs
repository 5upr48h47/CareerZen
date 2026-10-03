// Generate a PostgreSQL variant of the Prisma schema.
//
// Prisma requires the datasource provider to be a literal, not env(), so we
// keep schema.prisma as the SQLite (local dev) source of truth and derive
// schema.postgres.prisma for production. Run this after changing schema.prisma,
// then: npx prisma generate --schema prisma/schema.postgres.prisma
//
//   node scripts/use-postgres.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const target = path.join(__dirname, '..', 'prisma', 'schema.postgres.prisma');

const src = fs.readFileSync(schemaPath, 'utf8');

const out = src.replace(
  /datasource db \{\s*\n\s*provider = "sqlite"/,
  'datasource db {\n  provider = "postgresql"'
);

if (out === src) {
  console.error('Could not find the sqlite datasource block — check schema.prisma.');
  process.exit(1);
}

fs.writeFileSync(target, out);
console.log('Wrote', target);
console.log('Next: npx prisma generate --schema prisma/schema.postgres.prisma');
console.log('Then set DATABASE_URL and run: npx prisma db push --schema prisma/schema.postgres.prisma');