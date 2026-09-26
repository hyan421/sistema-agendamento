import express, { type ErrorRequestHandler } from 'express';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import helmet from 'helmet';

import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { authRoutes } from './modules/auth/routes.js';
import { appointmentRoutes } from './modules/appointments/routes.js';
import { scheduleRoutes } from './modules/schedule/routes.js';
import { serviceRoutes } from './modules/services/routes.js';

import { notificationRoutes } from './modules/notifications/routes.js';

import { metricsRoutes } from './modules/metrics/routes.js';

const app = express();
const PgSession = connectPgSimple(session);
const sessionCookieMaxAge = 8 * 60 * 60 * 1000;
const allowedOrigin = new URL(env.appOrigin).origin;

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb', strict: true }));
app.use((request, response, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    next();
    return;
  }

  if (request.get('origin') !== allowedOrigin) {
    response.status(403).json({
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' },
    });
    return;
  }
  next();
});
app.use(
  session({
    name: 'connect.sid',
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: sessionCookieMaxAge,
    },
  }),
);

app.use('/api/v1', authRoutes, serviceRoutes, scheduleRoutes, appointmentRoutes, notificationRoutes, metricsRoutes);
app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : 500;
  const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : 'INTERNAL_ERROR';
  const message = status === 413 ? 'Request body exceeds 32 KiB.' : status === 400 ? 'Request body is invalid.' : 'An internal error occurred.';

  if (status >= 500) {
    console.error('API request failed.', error);
  }
  response.status(status).json({ error: { code, message } });
};

app.use(errorHandler);

export default app;