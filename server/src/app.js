import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { optionalAuth } from './auth.js';
import { CATEGORIES, CHECKPOINTS, VENUE_GROUPS } from './constants.js';
import { errorHandler, notFound } from './errors.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import claimRoutes from './routes/claims.js';
import meRoutes from './routes/me.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '20kb' }));

  const limiter = (windowMin, max, message) =>
    rateLimit({
      windowMs: windowMin * 60 * 1000,
      limit: max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => config.isTest,
      handler: (_req, res) => res.status(429).json({ error: { message } }),
    });

  app.use('/api/auth', limiter(15, 30, 'Too many sign-in attempts. Wait 15 minutes and try again.'));
  app.use('/api', limiter(1, 120, 'Too many requests. Slow down and try again in a minute.'));
  app.use('/api', optionalAuth(db));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/meta', (_req, res) =>
    res.json({ venueGroups: VENUE_GROUPS, categories: CATEGORIES, checkpoints: CHECKPOINTS }),
  );
  app.use('/api/auth', authRoutes(db));
  app.use('/api/items', itemRoutes(db));
  app.use('/api/claims', claimRoutes(db));
  app.use('/api/me', meRoutes(db));
  app.use('/api', (_req, _res, next) => next(notFound('That API endpoint doesn’t exist.')));

  // In production, serve the built React app from client/dist.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
