import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ZodError } from 'zod';

import { loginSchema, registerSchema } from '@navalha/contracts';
import { env } from '../../config/env.js';
import {
  EmailAlreadyExistsError,
  getActiveUser,
  InvalidCredentialsError,
  login,
  register,
} from './service.js';

export const authRoutes = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) =>
    response.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' },
    }),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) =>
    response.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Try again later.' },
    }),
});

authRoutes.post('/auth/register', registerLimiter, requireJson, async (request, response) => {
  const result = registerSchema.safeParse(request.body);
  if (!result.success) {
    sendValidationError(response, result.error);
    return;
  }

  try {
    const user = await register(result.data);
    response.status(201).json({ data: user });
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      response.status(409).json({
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account already uses this email.' },
      });
      return;
    }
    throw error;
  }
});

authRoutes.post('/auth/login', loginLimiter, requireJson, async (request, response) => {
  const result = loginSchema.safeParse(request.body);
  if (!result.success) {
    sendValidationError(response, result.error);
    return;
  }

  try {
    const user = await login(result.data);
    await regenerateSession(request);
    request.session.userId = user.id;
    await saveSession(request);
    response.status(200).json({ data: user });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      response.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }
    throw error;
  }
});

authRoutes.get('/auth/me', async (request, response) => {
  const user = await getSessionUser(request);
  if (!user) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }
  response.status(200).json({ data: user });
});

authRoutes.post('/auth/logout', async (request, response) => {
  const user = await getSessionUser(request);
  if (!user) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }

  await destroySession(request);
  response.clearCookie('connect.sid', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
  });
  response.status(204).end();
});

function requireJson(request: Request, response: Response, next: () => void): void {
  if (!request.is('application/json')) {
    response.status(415).json({
      error: { code: 'JSON_REQUIRED', message: 'Content-Type must be application/json.' },
    });
    return;
  }
  next();
}

async function getSessionUser(request: Request) {
  if (!request.session.userId) {
    return null;
  }
  return getActiveUser(request.session.userId);
}

function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

function sendValidationError(response: Response, error: ZodError): void {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || '_', issue.message]),
  );
  response.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', fields },
  });
}