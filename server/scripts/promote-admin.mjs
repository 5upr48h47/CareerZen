import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../prisma/careerzen.db');
const email = String(process.argv[2] || '').trim().toLowerCase();

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/promote-admin.mjs your-email@example.com');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err); else resolve({ changes: this.changes });
  });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

try {
  const user = await get('SELECT id, username, email, role FROM users WHERE lower(email)=?', [email]);
  if (!user) {
    console.error(`No user found for ${email}. Register/login once first, then run this command again.`);
    process.exitCode = 1;
  } else {
    await run("UPDATE users SET role='admin', is_active=1 WHERE id=?", [user.id]);
    console.log(`Admin access enabled for ${user.email} (user #${user.id}).`);
    console.log('Log out and log in again, then open the Admin tab.');
  }
} catch (err) {
  console.error('Could not promote user:', err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
