import { Router, type Request, type Response } from 'express';
import type { ZodError } from 'zod';

import {
  barberBlocksQuerySchema,
  createTimeBlockSchema,
  weeklyHoursSchema,
} from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import {
  BarberNotFoundError,
  BlockConflictError,
  BlockNotFoundError,
  ScheduleConflictError,
} from './repository.js';
import {
  createTimeBlock,
  getTimeBlocks,
  getWeeklyHours,
  InvalidBlockRangeError,
  removeTimeBlock,
  setWeeklyHours,
} from './service.js';

export const scheduleRoutes = Router();
const barberAccess = [requireUser, requireRole('BARBER')];

scheduleRoutes.get('/barber/weekly-hours', ...barberAccess, async (request, response) => {
  try {
    response.status(200).json({ data: { intervals: await getWeeklyHours(request.session.userId!) } });
  } catch (error) {
    if (!sendMissingBarber(response, error)) throw error;
  }
});

scheduleRoutes.put('/barber/weekly-hours', ...barberAccess, requireJson, async (request, response) => {
  const input = weeklyHoursSchema.safeParse(request.body);
  if (!input.success) {
    sendValidationError(response, input.error);
    return;
  }

  try {
    const intervals = await setWeeklyHours(request.session.userId!, input.data);
    response.status(200).json({ data: { intervals } });
  } catch (error) {
    if (sendMissingBarber(response, error)) return;
    if (error instanceof ScheduleConflictError) {
      response.status(409).json({
        error: { code: 'SCHEDULE_CONFLICT', message: 'Future appointments do not fit the new working hours.' },
      });
      return;
    }
    throw error;
  }
});

scheduleRoutes.get('/barber/blocks', ...barberAccess, async (request, response) => {
  const range = barberBlocksQuerySchema.safeParse(request.query);
  if (!range.success) {
    sendValidationError(response, range.error);
    return;
  }
  try {
    response.status(200).json({ data: await getTimeBlocks(request.session.userId!, range.data) });
  } catch (error) {
    if (!sendMissingBarber(response, error)) throw error;
  }
});

scheduleRoutes.post('/barber/blocks', ...barberAccess, requireJson, async (request, response) => {
  const input = createTimeBlockSchema.safeParse(request.body);
  if (!input.success) {
    sendValidationError(response, input.error);
    return;
  }

  try {
    response.status(201).json({ data: await createTimeBlock(request.session.userId!, input.data) });
  } catch (error) {
    if (sendMissingBarber(response, error)) return;
    if (error instanceof BlockConflictError) {
      response.status(409).json({
        error: { code: 'BLOCK_CONFLICT', message: 'The block overlaps an appointment or another block.' },
      });
      return;
    }
    if (error instanceof InvalidBlockRangeError) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: error.message, fields: { endsAt: error.message } },
      });
      return;
    }
    throw error;
  }
});

scheduleRoutes.delete('/barber/blocks/:id', ...barberAccess, async (request, response) => {
  const blockId = request.params.id;
  if (typeof blockId !== 'string' || !isUuid(blockId)) {
    response.status(400).json({ error: { code: 'INVALID_ID', message: 'Block id must be a UUID.' } });
    return;
  }

  try {
    await removeTimeBlock(request.session.userId!, blockId);
    response.status(204).end();
  } catch (error) {
    if (error instanceof BlockNotFoundError || error instanceof BarberNotFoundError) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Block not found.' } });
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

function sendMissingBarber(response: Response, error: unknown): boolean {
  if (!(error instanceof BarberNotFoundError)) return false;
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Active barber profile not found.' },
  });
  return true;
}