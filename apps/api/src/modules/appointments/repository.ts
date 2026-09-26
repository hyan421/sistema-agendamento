import type { PoolClient, QueryResultRow } from 'pg';
import { DateTime } from 'luxon';

import type {
  AppointmentDTO,
  AvailabilitySlot,
  CreateAppointmentInput,
  WeeklyHourInterval,
} from '@navalha/contracts';
import { withTransaction } from '../../db/transaction.js';
import { localDayBounds } from '../schedule/availability.js';

export class AppointmentBarberNotFoundError extends Error {}
export class AppointmentServiceNotFoundError extends Error {}
export class AppointmentSlotConflictError extends Error {}

interface LockedBarberRow extends QueryResultRow {
  id: string;
  userId: string;
}

interface LockedServiceRow extends QueryResultRow {
  name: string;
  durationMinutes: number;
  priceCents: number;
}

interface TimezoneRow extends QueryResultRow {
  timezone: string;
}

interface WeeklyHourRow extends QueryResultRow {
  weekday: number;
  startTime: string;
  endTime: string;
}

interface InstantRangeRow extends QueryResultRow {
  startsAt: Date;
  endsAt: Date;
}

interface AppointmentRow extends QueryResultRow {
  id: string;
  serviceId: string;
  barberId: string;
  startsAt: Date;
  endsAt: Date;
  status: 'CONFIRMED';
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  createdAt: Date;
}

export interface LockedBookingContext {
  serviceId: string;
  barberId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  timezone: string;
  intervals: WeeklyHourInterval[];
  busyIntervals: Array<{ startsAt: Date; endsAt: Date }>;
  requestedStartsAt: Date;
}

export type BookingSlotValidator = (context: LockedBookingContext) => AvailabilitySlot;

export async function createAppointmentAtomically(
  clientId: string,
  input: CreateAppointmentInput,
  validateSlot: BookingSlotValidator,
): Promise<AppointmentDTO> {
  try {
    return await withTransaction(async (client) => {
      const barber = await lockActiveBarber(client, input.barberId);
      const service = await lockActiveService(client, input.serviceId);
      const timezone = await getShopTimezone(client);
      const requestedStartsAt = new Date(input.startsAt);
      const localStart = DateTime.fromJSDate(requestedStartsAt, { zone: timezone });
      const localDate = localStart.toISODate();
      if (!localDate) throw new AppointmentSlotConflictError('The requested slot is invalid.');

      const bounds = localDayBounds(localDate, timezone);
      const [hoursResult, appointmentsResult, blocksResult] = await Promise.all([
        client.query<WeeklyHourRow>(
          `SELECT weekday, start_time AS "startTime", end_time AS "endTime"
           FROM weekly_hours
           WHERE barber_id = $1 AND weekday = $2
           ORDER BY start_time`,
          [barber.id, localStart.weekday],
        ),
        client.query<InstantRangeRow>(
          `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
           FROM appointments
           WHERE barber_id = $1 AND status IN ('CONFIRMED', 'COMPLETED')
             AND starts_at < $3 AND ends_at > $2`,
          [barber.id, bounds.start, bounds.end],
        ),
        client.query<InstantRangeRow>(
          `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
           FROM time_blocks
           WHERE barber_id = $1 AND starts_at < $3 AND ends_at > $2`,
          [barber.id, bounds.start, bounds.end],
        ),
      ]);

      const context: LockedBookingContext = {
        serviceId: input.serviceId,
        barberId: barber.id,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        timezone,
        intervals: hoursResult.rows.map((row) => ({
          weekday: row.weekday,
          startTime: row.startTime.slice(0, 5),
          endTime: row.endTime.slice(0, 5),
        })),
        busyIntervals: [...appointmentsResult.rows, ...blocksResult.rows],
        requestedStartsAt,
      };
      const slot = validateSlot(context);

      const appointmentResult = await client.query<AppointmentRow>(
        `INSERT INTO appointments (
           client_id, barber_id, service_id, starts_at, ends_at, service_name_snapshot,
           price_cents_snapshot, duration_minutes_snapshot
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, service_id AS "serviceId", barber_id AS "barberId",
           starts_at AS "startsAt", ends_at AS "endsAt", status,
           service_name_snapshot AS "serviceName", price_cents_snapshot AS "priceCents",
           duration_minutes_snapshot AS "durationMinutes", created_at AS "createdAt"`,
        [
          clientId,
          barber.id,
          input.serviceId,
          slot.startsAt,
          slot.endsAt,
          service.name,
          service.priceCents,
          service.durationMinutes,
        ],
      );
      const appointment = appointmentResult.rows[0]!;
      const localStartText = DateTime.fromJSDate(new Date(slot.startsAt), { zone: timezone })
        .toFormat('dd/LL/yyyy HH:mm');
      const message = `Agendamento confirmado: ${service.name}, ${localStartText} (horario da barbearia).`;

      await client.query(
        `INSERT INTO notifications (user_id, appointment_id, kind, message)
         VALUES
           ($1, $3, 'BOOKING_CONFIRMED', $4),
           ($2, $3, 'BOOKING_CONFIRMED', $4)
         ON CONFLICT (user_id, appointment_id, kind) DO NOTHING`,
        [clientId, barber.userId, appointment.id, message],
      );

      return toAppointmentDTO(appointment);
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new AppointmentSlotConflictError('The requested slot is no longer available.');
    }
    throw error;
  }
}

async function lockActiveBarber(client: PoolClient, barberId: string): Promise<LockedBarberRow> {
  const result = await client.query<LockedBarberRow>(
    `SELECT b.id, b.user_id AS "userId"
     FROM barbers b
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1 AND b.active = TRUE AND u.active = TRUE AND u.role = 'BARBER'
     FOR UPDATE OF b`,
    [barberId],
  );
  const barber = result.rows[0];
  if (!barber) throw new AppointmentBarberNotFoundError('Active barber not found.');
  return barber;
}

async function lockActiveService(client: PoolClient, serviceId: string): Promise<LockedServiceRow> {
  const result = await client.query<LockedServiceRow>(
    `SELECT name, duration_minutes AS "durationMinutes", price_cents AS "priceCents"
     FROM services WHERE id = $1 AND active = TRUE FOR SHARE`,
    [serviceId],
  );
  const service = result.rows[0];
  if (!service) throw new AppointmentServiceNotFoundError('Active service not found.');
  return service;
}

async function getShopTimezone(client: PoolClient): Promise<string> {
  const result = await client.query<TimezoneRow>('SELECT timezone FROM shop WHERE id = 1');
  const timezone = result.rows[0]?.timezone;
  if (!timezone) throw new Error('Shop timezone has not been configured.');
  return timezone;
}

function toAppointmentDTO(row: AppointmentRow): AppointmentDTO {
  return {
    id: row.id,
    serviceId: row.serviceId,
    barberId: row.barberId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    serviceName: row.serviceName,
    priceCents: row.priceCents,
    durationMinutes: row.durationMinutes,
    createdAt: row.createdAt.toISOString(),
  };
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23P01'
  );
}