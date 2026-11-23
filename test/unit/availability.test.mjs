import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import {
  assertDateInBookingWindow,
  AvailabilityDateOutOfRangeError,
  buildAvailabilitySlots,
  findAvailableSlot,
  localDayBounds,
} from '../../apps/api/dist/modules/schedule/availability.js';

const now = DateTime.fromISO('2026-02-02T08:40:00-03:00');
const monday = '2026-02-02';
const context = (overrides = {}) => ({
  timezone: 'America/Sao_Paulo',
  durationMinutes: 30,
  intervals: [{ weekday: 1, startTime: '09:00', endTime: '11:00' }],
  busyIntervals: [],
  ...overrides,
});

test('converts local day boundaries to UTC and rejects invalid dates', () => {
  const bounds = localDayBounds(monday, 'America/Sao_Paulo');
  assert.equal(bounds.start.toISOString(), '2026-02-02T03:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-02-03T03:00:00.000Z');
  assert.throws(() => localDayBounds('2026-02-30', 'America/Sao_Paulo'), AvailabilityDateOutOfRangeError);
});

test('accepts dates from today through 30 days ahead in the shop timezone', () => {
  assert.equal(assertDateInBookingWindow(monday, 'America/Sao_Paulo', now).toISODate(), monday);
  assert.equal(assertDateInBookingWindow('2026-03-04', 'America/Sao_Paulo', now).toISODate(), '2026-03-04');
  for (const date of ['2026-02-01', '2026-03-05', '2026-02-30']) {
    assert.throws(() => assertDateInBookingWindow(date, 'America/Sao_Paulo', now), AvailabilityDateOutOfRangeError);
  }
});

test('builds 15-minute slots, respecting the 30-minute notice and service duration', () => {
  const slots = buildAvailabilitySlots(monday, context(), now);
  assert.deepEqual(slots.map((slot) => DateTime.fromISO(slot.startsAt).setZone('America/Sao_Paulo').toFormat('HH:mm')),
    ['09:15', '09:30', '09:45', '10:00', '10:15', '10:30']);
  assert.ok(slots.every((slot) => slot.durationMinutes === 30));
});

test('omits slots that overlap appointments or blocks, but allows touching boundaries', () => {
  const busyIntervals = [
    { startsAt: new Date('2026-02-02T12:30:00Z'), endsAt: new Date('2026-02-02T13:00:00Z') },
    { startsAt: new Date('2026-02-02T13:30:00Z'), endsAt: new Date('2026-02-02T14:00:00Z') },
  ];
  const slots = buildAvailabilitySlots(monday, context({ busyIntervals }), now);
  const localTimes = slots.map((slot) => DateTime.fromISO(slot.startsAt).setZone('America/Sao_Paulo').toFormat('HH:mm'));
  assert.ok(!localTimes.includes('09:30'));
  assert.ok(localTimes.includes('10:00'));
  assert.ok(!localTimes.includes('10:30'));
});

test('returns no slots when the service cannot fit in a work interval', () => {
  const slots = buildAvailabilitySlots(monday, context({
    durationMinutes: 120,
    intervals: [{ weekday: 1, startTime: '09:00', endTime: '10:00' }],
  }), now);
  assert.deepEqual(slots, []);
});

test('ignores a local start time that does not exist during a daylight-saving transition', () => {
  const slots = buildAvailabilitySlots('2026-03-08', context({
    timezone: 'America/New_York',
    durationMinutes: 15,
    intervals: [{ weekday: 7, startTime: '02:00', endTime: '04:00' }],
  }), DateTime.fromISO('2026-03-07T10:00:00-05:00'));
  assert.ok(slots.length > 0);
  assert.ok(slots.every((slot) => DateTime.fromISO(slot.startsAt).setZone('America/New_York').hour !== 2));
});

test('finds an exact available instant and rejects unavailable or out-of-range instants', () => {
  const available = new Date('2026-02-02T12:15:00Z');
  const unavailable = new Date('2026-02-02T12:00:00Z');
  assert.equal(findAvailableSlot(available, context(), now)?.startsAt, available.toISOString());
  assert.equal(findAvailableSlot(unavailable, context(), now), null);
  assert.throws(
    () => findAvailableSlot(new Date('2026-03-10T12:15:00Z'), context(), now),
    AvailabilityDateOutOfRangeError,
  );
});
