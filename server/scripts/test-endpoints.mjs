import jwt from 'jsonwebtoken';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
const secret = env.match(/JWT_SECRET=(.+)/)[1].trim();
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, secret, { expiresIn: '1h' });

const base = 'http://localhost:5009/api';

async function test(path, method = 'GET', body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  console.log(`${method} ${path} → ${res.status}`);
  console.log(JSON.stringify(json).slice(0, 400));
  console.log('---');
}

await test('/feed-topics');
await test('/admin/feed-topics');
await test('/recruiter/dashboard');
await test('/packages');