/**
 * routes/webhookRoutes.js
 * ------------------------
 * Webhook endpoint for Kang payment status updates.
 *
 * ⚠️  IMPORTANT: This route MUST be registered BEFORE express.json()
 *     or use express.raw() specifically here, because webhook signature
 *     verification requires the raw request body bytes.
 *
 * Mount in app.js:
 *   import webhookRoutes from './routes/webhookRoutes.js';
 *   app.use('/webhooks', webhookRoutes);
 */

import { Router } from 'express';
import express from 'express';
import { handleKangWebhook } from '../controllers/webhookController.js';

const router = Router();

// Use raw body parser for this route ONLY.
// express.raw() gives us the Buffer we need for HMAC verification.
router.post(
  '/fapshi',
  express.raw({ type: 'application/json' }),
  handleKangWebhook
);

export default router;
