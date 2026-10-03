import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { initDB } from './db.js';
import { initSocketServer } from './socket.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

import searchService from './search/index.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import postRoutes from './routes/postRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import collaborationRoutes from './routes/collaborationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import premiumRoutes from './routes/premiumRoutes.js';
import paymentOptionsRoutes from './routes/paymentOptionsRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

dotenv.config();

// Sentry initialization
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

const app = express();
const PORT = process.env.PORT || 5002;

// Trust proxy for rate limiting behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Only meaningful over HTTPS; harmless locally.
  strictTransportSecurity: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true }
    : false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Stricter rate limit for credential endpoints — 20 attempts per 15 min is
// generous for a human and hostile to password spraying. The automated test
// suite registers several users per run, so raise it outside production.
const isProduction = process.env.NODE_ENV === 'production';
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: isProduction
    ? (Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 20)
    : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
    // Tell the user how long they have to wait instead of a generic "try
    // again later". Without this, a locked-out user has no way to know when
    // the block lifts — and on a shared IP one bad actor can lock out
    // everyone behind the same NAT/mobile connection.
    handler: (req, res) => {
      const retryAfter = res.getHeader('Retry-After');
      res.status(429).json({
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: retryAfter ? `${retryAfter} seconds` : null
      });
    },
});

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Serve uploaded files (avatars, banners, documents)
// __dirname is server/src, but multer writes to server/public/uploads (see
// services/upload.js) — so walk up one level. Mismatching these two made every
// stored /uploads/... URL fall through to the SPA catch-all and return index.html.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, 'HTTP Request');
  });
  next();
});

// Health check - before auth middleware
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CareerZen Backend API', timestamp: new Date().toISOString() });
});

// Search routes - before auth middleware to allow public access
app.use('/api', searchRoutes);

// Premium public routes - before auth middleware to allow public access
app.use('/api/premium', premiumRoutes);

// API Routes - apply stricter rate limiting to auth only
// Credential endpoints get a stricter limit — without it, login/registration
// are only covered by the global 200/15min, leaving the door open to password
// spraying. Mounted before authRoutes so it applies to every route below.
const credentialPaths = [
  '/login', '/register', '/send-otp', '/verify-otp',
  '/register-phone', '/auth/google'
];
credentialPaths.forEach((p) => app.use(`/api${p}`, authLimiter));
app.use('/api', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', postRoutes);
app.use('/api', connectionRoutes);
app.use('/api', jobRoutes);
app.use('/api', paymentRoutes);
app.use('/api', applicationRoutes);
app.use('/api', messageRoutes);
app.use('/api', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', collaborationRoutes);
app.use('/api', adminRoutes);
app.use('/api', paymentOptionsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Sentry error handler (must be after all routes)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler({
    shouldHandleError: (error) => {
      // Don't handle 4xx errors
      return error.statusCode >= 500 || !error.statusCode;
    },
  }));
}

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  const status = err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

// ─────────────────────────────────────────────
// Serve the production React build as the SPA shell.
// Registered LAST so /api, /uploads, and /assets all resolve before the
// catch-all. The Vite client calls /api and /ws relatively, so serving it
// from the same origin means no CORS, no proxy, and one TLS cert.
// ─────────────────────────────────────────────
const CLIENT_DIST = process.env.CLIENT_DIST || path.join(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback — any non-API route loads index.html so client-side
  // routing (feed, jobs, profile, etc.) works behind a single origin.
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  logger.info({ dir: CLIENT_DIST }, 'Serving production frontend build');
} else {
  logger.warn({ dir: CLIENT_DIST }, 'No frontend build found — running API-only');
}

const server = http.createServer(app);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use, exiting`);
    process.exit(1);
  }
  throw err;
});
initSocketServer(server);

async function start() {
  try {
    await initDB();
    // Search service is initialized in its constructor
    logger.info('Search service ready');
    server.listen(PORT, () => {
      console.log(`🚀 CareerZen server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
