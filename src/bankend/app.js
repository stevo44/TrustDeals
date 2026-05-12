/**
 * app.js
 * -------
 * Express application with Kang payment integration.
 *
 * Key integration points:
 *  1. Webhook route registered FIRST (needs raw body, not JSON parsed)
 *  2. express.json() applied AFTER webhook route
 *  3. Payment routes protected by JWT middleware
 *
 * Usage:
 *   node app.js
 *   # or with nodemon:
 *   nodemon app.js
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database.js';
import paymentRoutes from './routes/paymentRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
}));

// ─── ⚠️  WEBHOOK ROUTES MUST BE FIRST ─────────────────────────────────────────
//    These routes use express.raw() internally — they MUST be mounted
//    before express.json() so the body is not pre-parsed.
app.use('/webhooks', webhookRoutes);

// ─── JSON body parser (for all other routes) ──────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Payment routes ───────────────────────────────────────────────────────────
app.use('/payments', paymentRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  const status  = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ success: false, message });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] TrustDeals Payment Server running on :${PORT}`);
    console.log(`[Server] Webhook endpoint: POST /webhooks/fapshi`);
    console.log(`[Server] Payment endpoint: POST /payments/initiate`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

export default app;
