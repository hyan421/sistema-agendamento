import type { PoolClient, QueryResultRow } from 'pg';
import { DateTime } from 'luxon';

import type {
  AvailabilityQuery,
  BarberBlocksQuery,
  CreateTimeBlockInput,
  TimeBlockDTO,
  WeeklyHourInterval,
} from '@navalha/contracts';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { localDayBounds, type AvailabilityContext } from './availability.js';

export class BarberNotFoundError extends Error {}
export class ScheduleConflictError extends Error {}
export class BlockConflictError extends Error {}
export class BlockNotFoundError extends Error {}
export class ServiceUnavailableError extends Error {}

interface WeeklyHourRow extends QueryResultRow {
  weekday: number;
  startTime: string;
  endTime: string;
}

interface TimeBlockRow extends QueryResultRow {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  createdAt: Date;
}

interface AvailabilityServiceRow extends QueryResultRow {
  durationMinutes: number;
}

interface ShopTimezoneRow extends QueryResultRow {
  timezone: string;
}

interface InstantRangeRow extends QueryResultRow {
  startsAt: Date;
  endsAt: Date;
}

const timeBlockColumns = `
  id,
  starts_at AS "startsAt",
  ends_at AS "endsAt",
  reason,
  created_at AS "createdAt"
`;

export async function getAvailabilityContext(
  queryInput: AvailabilityQuery,
): Promise<AvailabilityContext> {
  const [service, barber, shop] = await Promise.all([
    pool.query<AvailabilityServiceRow>(
      `SELECT duration_minutes AS "durationMinutes"
       FROM services WHERE id = $1 AND active = TRUE`,
      [queryInput.serviceId],
    ),
    pool.query(
      `SELECT 1
       FROM barbers b JOIN users u ON u.id = b.user_id
       WHERE b.id = $1 AND b.active = TRUE AND u.active = TRUE AND u.role = 'BARBER'`,
      [queryInput.barberId],
    ),
    pool.query<ShopTimezoneRow>('SELECT timezone FROM shop WHERE id = 1'),
  ]);

  if (!service.rows[0]) throw new ServiceUnavailableError('Active service not found.');
  if (barber.rowCount === 0) throw new BarberNotFoundError('Active barber not found.');
  const timezone = shop.rows[0]?.timezone;
  if (!timezone) throw new Error('Shop timezone has not been configured.');

  const day = DateTime.fromISO(queryInput.date, { zone: timezone });
  const bounds = localDayBounds(queryInput.date, timezone);
  const weekday = day.weekday;
  const [hours, appointments, blocks] = await Promise.all([
    pool.query<WeeklyHourRow>(
      `SELECT weekday, start_time AS "startTime", end_time AS "endTime"
       FROM weekly_hours WHERE barber_id = $1 AND weekday = $2
       ORDER BY start_time`,
      [queryInput.barberId, weekday],
    ),
    pool.query<InstantRangeRow>(
      `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
       FROM appointments
       WHERE barber_id = $1 AND status IN ('CONFIRMED', 'COMPLETED')
         AND starts_at < $3 AND ends_at > $2`,
      [queryInput.barberId, bounds.start, bounds.end],
    ),
    pool.query<InstantRangeRow>(
      `SELECT starts_at AS "startsAt", ends_at AS "endsAt"
       FROM time_blocks
       WHERE barber_id = $1 AND starts_at < $3 AND ends_at > $2`,
      [queryInput.barberId, bounds.start, bounds.end],
    ),
  ]);

  return {
    timezone,
    durationMinutes: service.rows[0].durationMinutes,
    intervals: hours.rows.map((row) => ({
      weekday: row.weekday,
      startTime: row.startTime.slice(0, 5),
      endTime: row.endTime.slice(0, 5),
    })),
    busyIntervals: [...appointments.rows, ...blocks.rows],
  };
}

export async function findWeeklyHours(userId: string): Promise<WeeklyHourInterval[]> {
  const result = await pool.query<WeeklyHourRow>(
    `SELECT wh.weekday, wh.start_time AS "startTime", wh.end_time AS "endTime"
     FROM weekly_hours wh
     JOIN barbers b ON b.id = wh.barber_id
     WHERE b.user_id = $1 AND b.active = TRUE
     ORDER BY wh.weekday, wh.start_time`,
    [userId],
  );
  if (result.rowCount === 0) {
    await assertBarberExists(userId);
  }
  return result.rows.map((row) => ({
    weekday: row.weekday,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
  }));
}

export async function replaceWeeklyHours(
  userId: string,
  intervals: WeeklyHourInterval[],
): Promise<WeeklyHourInterval[]> {
  return withTransaction(async (client) => {
    const barberId = await lockBarber(client, userId);
    const conflict = await client.query<{ hasConflict: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM appointments a
         JOIN shop s ON s.id = 1
         WHERE a.barber_id = $1
           AND a.status = 'CONFIRMED'
           AND a.starts_at > now()
           AND NOT EXISTS (
             SELECT 1
             FROM jsonb_to_recordset($2::jsonb)
               AS proposed(weekday SMALLINT, start_time TIME, end_time TIME)
             WHERE proposed.weekday = EXTRACT(ISODOW FROM a.starts_at AT TIME ZONE s.timezone)::SMALLINT
               AND (a.starts_at AT TIME ZONE s.timezone)::TIME >= proposed.start_time
               AND (a.ends_at AT TIME ZONE s.timezone)::TIME <= proposed.end_time
           )
       ) AS "hasConflict"`,
      [
        barberId,
        JSON.stringify(
          intervals.map(({ weekday, startTime, endTime }) => ({
            weekday,
            start_time: startTime,
            end_time: endTime,
          })),
        ),
      ],
    );

    if (conflict.rows[0]?.hasConflict) {
      throw new ScheduleConflictError('Future appointments do not fit the new working hours.');
    }

    await client.query('DELETE FROM weekly_hours WHERE barber_id = $1', [barberId]);
    if (intervals.length > 0) {
      await client.query(
        `INSERT INTO weekly_hours (barber_id, weekday, start_time, end_time)
         SELECT $1, proposed.weekday, proposed.start_time, proposed.end_time
         FROM jsonb_to_recordset($2::jsonb)
           AS proposed(weekday SMALLINT, start_time TIME, end_time TIME)`,
        [
          barberId,
          JSON.stringify(
            intervals.map(({ weekday, startTime, endTime }) => ({
              weekday,
              start_time: startTime,
              end_time: endTime,
            })),
          ),
        ],
      );
    }

    return intervals;
  });
}

export async function findTimeBlocks(
  userId: string,
  range: BarberBlocksQuery,
): Promise<TimeBlockDTO[]> {
  const result = await pool.query<TimeBlockRow>(
    `SELECT ${timeBlockColumns}
     FROM time_blocks tb
     JOIN barbers b ON b.id = tb.barber_id
     JOIN shop s ON s.id = 1
     WHERE b.user_id = $1
       AND b.active = TRUE
       AND tb.starts_at < (($3::date + 1 + TIME '00:00') AT TIME ZONE s.timezone)
       AND tb.ends_at > (($2::date + TIME '00:00') AT TIME ZONE s.timezone)
     ORDER BY tb.starts_at, tb.id`,
    [userId, range.from, range.to],
  );
  if (result.rowCount === 0) {
    await assertBarberExists(userId);
  }
  return result.rows.map(toTimeBlockDTO);
}

export async function insertTimeBlock(
  userId: string,
  input: CreateTimeBlockInput,
  startsAt: Date,
  endsAt: Date,
): Promise<TimeBlockDTO> {
  return withTransaction(async (client) => {
    const barberId = await lockBarber(client, userId);
    const appointmentConflict = await client.query<{ found: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM appointments
         WHERE barber_id = $1
           AND status = 'CONFIRMED'
           AND starts_at > now()
           AND starts_at < $3
           AND ends_at > $2
       ) AS found`,
      [barberId, startsAt, endsAt],
    );
    if (appointmentConflict.rows[0]?.found) {
      throw new BlockConflictError('The block overlaps a future confirmed appointment.');
    }

    const blockConflict = await client.query<{ found: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM time_blocks
         WHERE barber_id = $1 AND starts_at < $3 AND ends_at > $2
       ) AS found`,
      [barberId, startsAt, endsAt],
    );
    if (blockConflict.rows[0]?.found) {
      throw new BlockConflictError('The block overlaps another block.');
    }

    try {
      const inserted = await client.query<TimeBlockRow>(
        `INSERT INTO time_blocks (barber_id, starts_at, ends_at, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING ${timeBlockColumns}`,
        [barberId, startsAt, endsAt, input.reason],
      );
      return toTimeBlockDTO(inserted.rows[0]!);
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new BlockConflictError('The block overlaps another block.');
      }
      throw error;
    }
  });
}

export async function deleteTimeBlock(userId: string, blockId: string): Promise<void> {
  await withTransaction(async (client) => {
    const barberId = await lockBarber(client, userId);
    const result = await client.query(
      'DELETE FROM time_blocks WHERE id = $1 AND barber_id = $2',
      [blockId, barberId],
    );
    if (result.rowCount === 0) {
      throw new BlockNotFoundError('Block not found.');
    }
  });
}

async function lockBarber(client: PoolClient, userId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    'SELECT id FROM barbers WHERE user_id = $1 AND active = TRUE FOR UPDATE',
    [userId],
  );
  const barberId = result.rows[0]?.id;
  if (!barberId) {
    throw new BarberNotFoundError('Active barber profile not found.');
  }
  return barberId;
}

async function assertBarberExists(userId: string): Promise<void> {
  const result = await pool.query(
    'SELECT 1 FROM barbers WHERE user_id = $1 AND active = TRUE LIMIT 1',
    [userId],
  );
  if (result.rowCount === 0) {
    throw new BarberNotFoundError('Active barber profile not found.');
  }
}

function toTimeBlockDTO(row: TimeBlockRow): TimeBlockDTO {
  return {
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reason: row.reason,
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