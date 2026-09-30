import { Router, type Request, type Response } from 'express';
import type { ZodError } from 'zod';

import { registerSchema } from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import { BarberEmailAlreadyExistsError } from './repository.js';
import { registerBarber } from './service.js';

export const adminRoutes = Router();

adminRoutes.post('/admin/barbers', requireJson, requireUser, requireRole('ADMIN'), async (request, response) => {
  const input = registerSchema.safeParse(request.body);
  if (!input.success) {
    sendValidationError(response, input.error);
    return;
  }

  try {
    response.status(201).json({ data: await registerBarber(input.data) });
  } catch (error) {
    if (error instanceof BarberEmailAlreadyExistsError) {
      response.status(409).json({
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account already uses this email.' },
      });
      return;
    }
    throw error;
  }
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

function sendValidationError(response: Response, error: ZodError): void {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || '_', issue.message]),
  );
  response.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', fields },
  });
}