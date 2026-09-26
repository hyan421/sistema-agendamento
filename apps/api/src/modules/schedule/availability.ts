import { DateTime } from 'luxon';

import type { AvailabilitySlot, WeeklyHourInterval } from '@navalha/contracts';

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailabilityContext {
  timezone: string;
  durationMinutes: number;
  intervals: WeeklyHourInterval[];
  busyIntervals: BusyInterval[];
}

export class AvailabilityDateOutOfRangeError extends Error {}

export function localDayBounds(date: string, timezone: string): { start: Date; end: Date } {
  const localDay = DateTime.fromISO(date, { zone: timezone });
  if (!localDay.isValid || localDay.toISODate() !== date) {
    throw new AvailabilityDateOutOfRangeError('date must be a valid local calendar date.');
  }
  return {
    start: localDay.startOf('day').toUTC().toJSDate(),
    end: localDay.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
  };
}

export function assertDateInBookingWindow(
  date: string,
  timezone: string,
  now: DateTime = DateTime.now(),
): DateTime {
  const selectedDay = DateTime.fromISO(date, { zone: timezone }).startOf('day');
  const shopToday = now.setZone(timezone).startOf('day');
  const lastBookableDay = shopToday.plus({ days: 30 });
  if (
    !selectedDay.isValid ||
    selectedDay.toISODate() !== date ||
    date < shopToday.toISODate()! ||
    date > lastBookableDay.toISODate()!
  ) {
    throw new AvailabilityDateOutOfRangeError('date must be between today and 30 days from today in the shop timezone.');
  }
  return selectedDay;
}

export function buildAvailabilitySlots(
  date: string,
  context: AvailabilityContext,
  now: DateTime = DateTime.now(),
): AvailabilitySlot[] {
  const localDay = assertDateInBookingWindow(date, context.timezone, now);
  const weekday = localDay.weekday;
  const dayIntervals = context.intervals.filter((interval) => interval.weekday === weekday);
  const minimumStart = now.toMillis() + 30 * 60 * 1000;
  const slots: AvailabilitySlot[] = [];

  for (const interval of dayIntervals) {
    const [startHour, startMinute] = interval.startTime.split(':').map(Number);
    const [endHour, endMinute] = interval.endTime.split(':').map(Number);
    const intervalStartMinute = startHour! * 60 + startMinute!;
    const intervalEndMinute = endHour! * 60 + endMinute!;
    const firstGridMinute = Math.ceil(intervalStartMinute / 15) * 15;
    const intervalEnd = localTime(date, interval.endTime, context.timezone);
    if (!intervalEnd) continue;

    for (let minuteOfDay = firstGridMinute; minuteOfDay < intervalEndMinute; minuteOfDay += 15) {
      const hour = Math.floor(minuteOfDay / 60);
      const minute = minuteOfDay % 60;
      const timeText = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const startsAt = localTime(date, timeText, context.timezone);
      if (!startsAt || startsAt.toMillis() < minimumStart) continue;

      const endsAt = startsAt.plus({ minutes: context.durationMinutes });
      if (endsAt.toMillis() > intervalEnd.toMillis()) continue;

      const overlaps = context.busyIntervals.some((busy) =>
        startsAt.toMillis() < busy.endsAt.getTime() && busy.startsAt.getTime() < endsAt.toMillis(),
      );
      if (overlaps) continue;

      slots.push({
        startsAt: startsAt.toUTC().toISO()!,
        endsAt: endsAt.toUTC().toISO()!,
        durationMinutes: context.durationMinutes,
      });
    }
  }

  return slots;
}

export function findAvailableSlot(
  startsAt: Date,
  context: AvailabilityContext,
  now: DateTime = DateTime.now(),
): AvailabilitySlot | null {
  const localStart = DateTime.fromJSDate(startsAt, { zone: context.timezone });
  const date = localStart.toISODate();
  if (!date) return null;

  const slots = buildAvailabilitySlots(date, context, now);
  const requestedMillis = startsAt.getTime();
  return slots.find((slot) => DateTime.fromISO(slot.startsAt).toMillis() === requestedMillis) ?? null;
}

function localTime(date: string, time: string, timezone: string): DateTime | null {
  const value = `${date}T${time}`;
  const parsed = DateTime.fromISO(value, { zone: timezone });
  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm") !== value) return null;
  return parsed;
}