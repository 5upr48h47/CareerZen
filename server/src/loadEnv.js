// Load .env before anything else reads process.env.
//
// This must be its own module, imported first by index.js. ES module imports
// are hoisted and evaluated before any statement in the importing file, so a
// dotenv.config() call placed in index.js's body still runs *after* the whole
// import graph has been evaluated — too late for socket.js, which calls
// JWT_SECRET() at module scope and throws when the env var is missing.
//
// The path is explicit because the process cwd is the repo root under
// `npm run dev`, not server/ — a bare config() would not find server/.env.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });
