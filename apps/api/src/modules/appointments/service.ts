import { DateTime } from 'luxon';

import type {
  AppointmentDTO,
  AvailabilityQuery,
  AvailabilitySlot,
  AppointmentListQuery,
  BarberAppointmentDTO,
  BarberAppointmentsQuery,
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
  AppointmentNotFoundError,
  AppointmentStateConflictError,
  cancelAppointmentAtomically,
  completeAppointmentAtomically,
  createAppointmentAtomically,
  listBarberAppointments,
  listClientAppointments,
  type AppointmentPage,
  type LockedBookingContext,
} from './repository.js';

export {
  AppointmentBarberNotFoundError,
  AppointmentServiceNotFoundError,
  AppointmentSlotConflictError,
  AppointmentNotFoundError,
  AppointmentStateConflictError,
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

export async function listMine(
  clientId: string,
  query: AppointmentListQuery,
): Promise<AppointmentPage<AppointmentDTO>> {
  return listClientAppointments(clientId, query);
}

export async function listForBarber(
  barberId: string,
  query: BarberAppointmentsQuery,
): Promise<AppointmentPage<BarberAppointmentDTO>> {
  return listBarberAppointments(barberId, query);
}

export async function cancelAppointment(
  appointmentId: string,
  actorId: string,
  role: 'CLIENT' | 'BARBER',
): Promise<AppointmentDTO> {
  return cancelAppointmentAtomically(appointmentId, actorId, role);
}

export async function completeAppointment(
  appointmentId: string,
  barberUserId: string,
): Promise<AppointmentDTO> {
  return completeAppointmentAtomically(appointmentId, barberUserId);
}

function validateSlot(context: LockedBookingContext): AvailabilitySlot {
  const requested = findAvailableSlot(context.requestedStartsAt, context);
  if (!requested) {
    throw new AppointmentSlotConflictError('The requested slot is no longer available.');
  }
  return requested;
}