import { Router, type Request, type Response } from 'express';
import type { ZodError } from 'zod';

import { createAppointmentSchema } from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import { AvailabilityDateOutOfRangeError } from '../schedule/availability.js';
import {
  AppointmentBarberNotFoundError,
  AppointmentServiceNotFoundError,
  AppointmentSlotConflictError,
  reserveAppointment,
} from './service.js';

export const appointmentRoutes = Router();

appointmentRoutes.post(
  '/appointments',
  requireJson,
  requireUser,
  requireRole('CLIENT'),
  async (request, response) => {
    const input = createAppointmentSchema.safeParse(request.body);
    if (!input.success) {
      sendValidationError(response, input.error);
      return;
    }

    try {
      const appointment = await reserveAppointment(request.session.userId!, input.data);
      response.status(201).json({ data: appointment });
    } catch (error) {
      if (error instanceof AvailabilityDateOutOfRangeError) {
        response.status(400).json({ error: { code: 'INVALID_DATE', message: error.message } });
        return;
      }
      if (
        error instanceof AppointmentBarberNotFoundError ||
        error instanceof AppointmentServiceNotFoundError
      ) {
        response.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
        return;
      }
      if (error instanceof AppointmentSlotConflictError) {
        response.status(409).json({
          error: { code: 'SLOT_UNAVAILABLE', message: 'The requested slot is no longer available.' },
        });
        return;
      }
      throw error;
    }
  },
);

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