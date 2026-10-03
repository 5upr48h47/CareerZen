import jwt from 'jsonwebtoken';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
const secret = env.match(/JWT_SECRET=(.+)/)[1].trim();
const token = jwt.sign({ id: 18, username: 'suprabhatsaha0966', role: 'admin', email: 'suprabhatsaha49@gmail.com' }, secret, { expiresIn: '1h' });
console.log(token);