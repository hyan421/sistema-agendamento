import { Router, type Request, type Response } from 'express';
import type { ZodError } from 'zod';

import {
  appointmentListQuerySchema,
  barberAppointmentsQuerySchema,
  createAppointmentSchema,
} from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import { AvailabilityDateOutOfRangeError } from '../schedule/availability.js';
import {
  AppointmentBarberNotFoundError,
  AppointmentNotFoundError,
  AppointmentServiceNotFoundError,
  AppointmentSlotConflictError,
  AppointmentStateConflictError,
  cancelAppointment,
  completeAppointment,
  listForBarber,
  listMine,
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
      if (error instanceof AppointmentBarberNotFoundError || error instanceof AppointmentServiceNotFoundError) {
        response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service or barber not found.' } });
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

appointmentRoutes.get('/appointments/mine', requireUser, requireRole('CLIENT'), async (request, response) => {
  const query = appointmentListQuerySchema.safeParse(request.query);
  if (!query.success) {
    sendValidationError(response, query.error);
    return;
  }
  const page = await listMine(request.session.userId!, query.data);
  response.status(200).json({
    data: page.items,
    meta: { page: page.page, pageSize: page.pageSize, total: page.total },
  });
});

appointmentRoutes.post(
  '/appointments/:id/cancel',
  requireUser,
  requireRole('CLIENT', 'BARBER'),
  async (request, response) => {
    const appointmentId = request.params.id;
    if (typeof appointmentId !== 'string' || !isUuid(appointmentId)) {
      response.status(400).json({
        error: { code: 'INVALID_ID', message: 'Appointment id must be a UUID.' },
      });
      return;
    }

    const user = response.locals.user as { role: 'CLIENT' | 'BARBER' };
    try {
      const appointment = await cancelAppointment(
        appointmentId,
        request.session.userId!,
        user.role,
      );
      response.status(200).json({ data: appointment });
    } catch (error) {
      if (error instanceof AppointmentNotFoundError) {
        response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }
      if (error instanceof AppointmentStateConflictError) {
        response.status(409).json({ error: { code: 'APPOINTMENT_CONFLICT', message: error.message } });
        return;
      }
      throw error;
    }
  },
);

appointmentRoutes.get('/barber/appointments', requireUser, requireRole('BARBER'), async (request, response) => {
  const query = barberAppointmentsQuerySchema.safeParse(request.query);
  if (!query.success) {
    sendValidationError(response, query.error);
    return;
  }
  try {
    const page = await listForBarber(request.session.userId!, query.data);
    response.status(200).json({
      data: page.items,
      meta: { page: page.page, pageSize: page.pageSize, total: page.total },
    });
  } catch (error) {
    if (error instanceof AppointmentBarberNotFoundError) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active barber profile not found.' } });
      return;
    }
    throw error;
  }
});

appointmentRoutes.post(
  '/barber/appointments/:id/complete',
  requireUser,
  requireRole('BARBER'),
  async (request, response) => {
    const appointmentId = request.params.id;
    if (typeof appointmentId !== 'string' || !isUuid(appointmentId)) {
      response.status(400).json({
        error: { code: 'INVALID_ID', message: 'Appointment id must be a UUID.' },
      });
      return;
    }
    try {
      const appointment = await completeAppointment(appointmentId, request.session.userId!);
      response.status(200).json({ data: appointment });
    } catch (error) {
      if (error instanceof AppointmentNotFoundError) {
        response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }
      if (error instanceof AppointmentStateConflictError) {
        response.status(409).json({ error: { code: 'APPOINTMENT_CONFLICT', message: error.message } });
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sendValidationError(response: Response, error: ZodError): void {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || '_', issue.message]),
  );
  response.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', fields },
  });
}