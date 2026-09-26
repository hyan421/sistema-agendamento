import { DateTime } from 'luxon';

import type {
  AppointmentDTO,
  AvailabilityQuery,
  AvailabilitySlot,
  CreateAppointmentInput,
} from '@navalha/contracts';
import { getAvailabilityContext } from '../schedule/repository.js';
import {
  buildAvailabilitySlots,
  findAvailableSlot,
} from '../schedule/availability.js';
import {
  AppointmentBarberNotFoundError,
  AppointmentServiceNotFoundError,
  AppointmentSlotConflictError,
  createAppointmentAtomically,
  type LockedBookingContext,
} from './repository.js';

export {
  AppointmentBarberNotFoundError,
  AppointmentServiceNotFoundError,
  AppointmentSlotConflictError,
};

export async function getAvailability(
  query: AvailabilityQuery,
): Promise<AvailabilitySlot[]> {
  const context = await getAvailabilityContext(query);
  return buildAvailabilitySlots(query.date, context);
}

export async function reserveAppointment(
  clientId: string,
  input: CreateAppointmentInput,
): Promise<AppointmentDTO> {
  const startsAt = DateTime.fromISO(input.startsAt, { setZone: true });
  if (!startsAt.isValid) {
    throw new AppointmentSlotConflictError('The requested slot is invalid.');
  }

  return createAppointmentAtomically(clientId, input, (context) => validateSlot(context));
}

function validateSlot(context: LockedBookingContext): AvailabilitySlot {
  const requested = findAvailableSlot(context.requestedStartsAt, context);
  if (!requested) {
    throw new AppointmentSlotConflictError('The requested slot is no longer available.');
  }
  return requested;
}