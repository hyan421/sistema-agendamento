import { Router, type Request, type Response } from 'express';
import type { ZodError } from 'zod';

import {
  createServiceSchema,
  publicServicesQuerySchema,
  updateServiceSchema,
} from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import { ServiceNotFoundError } from './service.js';
import {
  createService,
  editService,
  listBarbers,
  listManagedServices,
  listServices,
} from './service.js';

export const serviceRoutes = Router();

serviceRoutes.get('/barbers', async (_request, response) => {
  response.status(200).json({ data: await listBarbers() });
});

serviceRoutes.get('/services', async (request, response) => {
  const filters = publicServicesQuerySchema.safeParse(request.query);
  if (!filters.success) {
    sendValidationError(response, filters.error);
    return;
  }

  response.status(200).json({ data: await listServices(filters.data) });
});

serviceRoutes.get('/barber/services', requireUser, requireRole('BARBER'), async (_request, response) => {
  response.status(200).json({ data: await listManagedServices() });
});

serviceRoutes.post('/barber/services', requireJson, requireUser, requireRole('BARBER'), async (request, response) => {
  const input = createServiceSchema.safeParse(request.body);
  if (!input.success) {
    sendValidationError(response, input.error);
    return;
  }

  response.status(201).json({ data: await createService(input.data) });
});

serviceRoutes.patch('/barber/services/:id', requireJson, requireUser, requireRole('BARBER'), async (request, response) => {
  const serviceId = request.params.id;
  if (typeof serviceId !== 'string' || !isUuid(serviceId)) {
    response.status(400).json({ error: { code: 'INVALID_ID', message: 'Service id must be a UUID.' } });
    return;
  }

  const input = updateServiceSchema.safeParse(request.body);
  if (!input.success) {
    sendValidationError(response, input.error);
    return;
  }

  try {
    response.status(200).json({ data: await editService(serviceId, input.data) });
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found.' } });
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

function isUuid(value: string | undefined): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? '');
}

function sendValidationError(response: Response, error: ZodError): void {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || '_', issue.message]),
  );
  response.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', fields },
  });
}