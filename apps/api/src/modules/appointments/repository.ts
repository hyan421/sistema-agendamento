import type { PoolClient, QueryResultRow } from 'pg';
import { DateTime } from 'luxon';

import type {
  AppointmentListQuery,
  AppointmentDTO,
  AppointmentStatus,
  BarberAppointmentDTO,
  BarberAppointmentsQuery,
  AvailabilitySlot,
  CreateAppointmentInput,
  WeeklyHourInterval,
} from '@navalha/contracts';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { localDayBounds } from '../schedule/availability.js';

export class AppointmentBarberNotFoundError extends Error {}
export class AppointmentServiceNotFoundError extends Error {}
export class AppointmentSlotConflictError extends Error {}
export class AppointmentNotFoundError extends Error {}
export class AppointmentStateConflictError extends Error {}

interface AppointmentListRow extends QueryResultRow {
  id: string;
  serviceId: string;
  barberId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  createdAt: Date;
  clientName?: string;
}

interface AppointmentIdentityRow extends QueryResultRow {
  id: string;
  clientId: string;
  barberId: string;
  barberUserId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  createdAt: Date;
}

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
  status: AppointmentStatus;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  createdAt: Date;
}

export interface AppointmentPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
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

export async function listClientAppointments(
  clientId: string,
  query: AppointmentListQuery,
): Promise<AppointmentPage<AppointmentDTO>> {
  const upcoming = query.scope === 'upcoming';
  const filter = upcoming
    ? "status = 'CONFIRMED' AND starts_at > now()"
    : "NOT (status = 'CONFIRMED' AND starts_at > now())";
  const [countResult, itemsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM appointments WHERE client_id = $1 AND ${filter}`,
      [clientId],
    ),
    pool.query<AppointmentListRow>(
      `SELECT id, service_id AS "serviceId", barber_id AS "barberId",
         starts_at AS "startsAt", ends_at AS "endsAt", status,
         service_name_snapshot AS "serviceName", price_cents_snapshot AS "priceCents",
         duration_minutes_snapshot AS "durationMinutes", created_at AS "createdAt"
       FROM appointments
       WHERE client_id = $1 AND ${filter}
       ORDER BY starts_at, id
       LIMIT $2 OFFSET $3`,
      [clientId, query.pageSize, (query.page - 1) * query.pageSize],
    ),
  ]);
  return {
    items: itemsResult.rows.map(toAppointmentDTO),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function listBarberAppointments(
  userId: string,
  query: BarberAppointmentsQuery,
): Promise<AppointmentPage<BarberAppointmentDTO>> {
  const barberResult = await pool.query<{ id: string }>(
    'SELECT id FROM barbers WHERE user_id = $1 AND active = TRUE',
    [userId],
  );
  const barberId = barberResult.rows[0]?.id;
  if (!barberId) throw new AppointmentBarberNotFoundError('Active barber profile not found.');

  const timezoneResult = await pool.query<TimezoneRow>('SELECT timezone FROM shop WHERE id = 1');
  const timezone = timezoneResult.rows[0]?.timezone;
  if (!timezone) throw new Error('Shop timezone has not been configured.');
  const bounds = localDayBounds(query.date, timezone);
  const [countResult, itemsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM appointments
       WHERE barber_id = $1 AND starts_at >= $2 AND starts_at < $3`,
      [barberId, bounds.start, bounds.end],
    ),
    pool.query<AppointmentListRow>(
      `SELECT a.id, a.service_id AS "serviceId", a.barber_id AS "barberId",
         a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.status,
         a.service_name_snapshot AS "serviceName", a.price_cents_snapshot AS "priceCents",
         a.duration_minutes_snapshot AS "durationMinutes", a.created_at AS "createdAt",
         u.name AS "clientName"
       FROM appointments a
       JOIN users u ON u.id = a.client_id
       WHERE a.barber_id = $1 AND a.starts_at >= $2 AND a.starts_at < $3
       ORDER BY a.starts_at, a.id
       LIMIT $4 OFFSET $5`,
      [barberId, bounds.start, bounds.end, query.pageSize, (query.page - 1) * query.pageSize],
    ),
  ]);
  return {
    items: itemsResult.rows.map((row) => ({ ...toAppointmentDTO(row), clientName: row.clientName! })),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function cancelAppointmentAtomically(
  appointmentId: string,
  actorId: string,
  actorRole: 'CLIENT' | 'BARBER',
): Promise<AppointmentDTO> {
  return withTransaction(async (client) => {
    const identity = await findAppointmentIdentity(client, appointmentId);
    const barber = await client.query<LockedBarberRow>(
      'SELECT id, user_id AS "userId" FROM barbers WHERE id = $1 FOR UPDATE',
      [identity.barberId],
    );
    const barberRow = barber.rows[0];
    if (!barberRow) throw new AppointmentNotFoundError('Appointment not found.');

    const appointment = await lockAppointment(client, appointmentId);
    if (
      appointment.barberId !== barberRow.id ||
      !canManageAppointment(actorId, actorRole, appointment, barberRow.userId)
    ) {
      throw new AppointmentNotFoundError('Appointment not found.');
    }
    if (appointment.status === 'CANCELLED') return toAppointmentDTO(appointment);
    if (appointment.status !== 'CONFIRMED' || appointment.startsAt <= new Date()) {
      throw new AppointmentStateConflictError('Only future confirmed appointments can be cancelled.');
    }

    const updated = await client.query<AppointmentRow>(
      `UPDATE appointments
       SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2
       WHERE id = $1 AND status = 'CONFIRMED'
       RETURNING id, service_id AS "serviceId", barber_id AS "barberId",
         starts_at AS "startsAt", ends_at AS "endsAt", status,
         service_name_snapshot AS "serviceName", price_cents_snapshot AS "priceCents",
         duration_minutes_snapshot AS "durationMinutes", created_at AS "createdAt"`,
      [appointmentId, actorId],
    );
    const cancelled = updated.rows[0];
    if (!cancelled) throw new AppointmentStateConflictError('Appointment state changed.');

    const timezone = await getShopTimezone(client);
    const localStartText = DateTime.fromJSDate(cancelled.startsAt, { zone: timezone })
      .toFormat('dd/LL/yyyy HH:mm');
    const message = `Agendamento cancelado: ${cancelled.serviceName}, ${localStartText} (horario da barbearia).`;
    await client.query(
      `INSERT INTO notifications (user_id, appointment_id, kind, message)
       VALUES
         ($1, $3, 'BOOKING_CANCELLED', $4),
         ($2, $3, 'BOOKING_CANCELLED', $4)
       ON CONFLICT (user_id, appointment_id, kind) DO NOTHING`,
      [appointment.clientId, barberRow.userId, appointmentId, message],
    );
    return toAppointmentDTO(cancelled);
  });
}

export async function completeAppointmentAtomically(
  appointmentId: string,
  barberUserId: string,
): Promise<AppointmentDTO> {
  return withTransaction(async (client) => {
    const identity = await findAppointmentIdentity(client, appointmentId);
    const barber = await client.query<LockedBarberRow>(
      `SELECT id, user_id AS "userId" FROM barbers
       WHERE id = $1 AND user_id = $2 AND active = TRUE FOR UPDATE`,
      [identity.barberId, barberUserId],
    );
    const barberRow = barber.rows[0];
    if (!barberRow) throw new AppointmentNotFoundError('Appointment not found.');

    const appointment = await lockAppointment(client, appointmentId);
    if (appointment.barberId !== barberRow.id) throw new AppointmentNotFoundError('Appointment not found.');
    if (appointment.status === 'COMPLETED') return toAppointmentDTO(appointment);
    if (appointment.status !== 'CONFIRMED' || appointment.endsAt > new Date()) {
      throw new AppointmentStateConflictError('Only confirmed appointments that have ended can be completed.');
    }

    const updated = await client.query<AppointmentRow>(
      `UPDATE appointments SET status = 'COMPLETED'
       WHERE id = $1 AND status = 'CONFIRMED'
       RETURNING id, service_id AS "serviceId", barber_id AS "barberId",
         starts_at AS "startsAt", ends_at AS "endsAt", status,
         service_name_snapshot AS "serviceName", price_cents_snapshot AS "priceCents",
         duration_minutes_snapshot AS "durationMinutes", created_at AS "createdAt"`,
      [appointmentId],
    );
    const completed = updated.rows[0];
    if (!completed) throw new AppointmentStateConflictError('Appointment state changed.');
    return toAppointmentDTO(completed);
  });
}

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
      const hoursResult = await client.query<WeeklyHourRow>(
        `SELECT weekday, start_time AS "startTime", end_time AS "endTime"
         FROM weekly_hours
         WHERE barber_id = $1 AND weekday = $2
         ORDER BY start_time`,
        [barber.id, localStart.weekday],
      );
      const appointmentsResult = await client.query<InstantRangeRow>(
        `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
         FROM appointments
         WHERE barber_id = $1 AND status IN ('CONFIRMED', 'COMPLETED')
           AND starts_at < $3 AND ends_at > $2`,
        [barber.id, bounds.start, bounds.end],
      );
      const blocksResult = await client.query<InstantRangeRow>(
        `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
         FROM time_blocks
         WHERE barber_id = $1 AND starts_at < $3 AND ends_at > $2`,
        [barber.id, bounds.start, bounds.end],
      );

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

async function findAppointmentIdentity(
  client: PoolClient,
  appointmentId: string,
): Promise<AppointmentIdentityRow> {
  const result = await client.query<AppointmentIdentityRow>(
    `SELECT a.id, a.client_id AS "clientId", a.barber_id AS "barberId",
       a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.status,
       a.service_id AS "serviceId", a.service_name_snapshot AS "serviceName",
       a.price_cents_snapshot AS "priceCents", a.duration_minutes_snapshot AS "durationMinutes",
       a.created_at AS "createdAt", b.user_id AS "barberUserId"
     FROM appointments a JOIN barbers b ON b.id = a.barber_id
     WHERE a.id = $1`,
    [appointmentId],
  );
  const appointment = result.rows[0];
  if (!appointment) throw new AppointmentNotFoundError('Appointment not found.');
  return appointment;
}

async function lockAppointment(
  client: PoolClient,
  appointmentId: string,
): Promise<AppointmentIdentityRow> {
  const result = await client.query<AppointmentIdentityRow>(
    `SELECT a.id, a.client_id AS "clientId", a.barber_id AS "barberId",
       a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.status,
       a.service_id AS "serviceId", a.service_name_snapshot AS "serviceName",
       a.price_cents_snapshot AS "priceCents", a.duration_minutes_snapshot AS "durationMinutes",
       a.created_at AS "createdAt", b.user_id AS "barberUserId"
     FROM appointments a JOIN barbers b ON b.id = a.barber_id
     WHERE a.id = $1
     FOR UPDATE OF a`,
    [appointmentId],
  );
  const appointment = result.rows[0];
  if (!appointment) throw new AppointmentNotFoundError('Appointment not found.');
  return appointment;
}

function canManageAppointment(
  actorId: string,
  actorRole: 'CLIENT' | 'BARBER',
  appointment: AppointmentIdentityRow,
  barberUserId: string,
): boolean {
  return actorRole === 'CLIENT'
    ? appointment.clientId === actorId
    : barberUserId === actorId;
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23P01'
  );
}