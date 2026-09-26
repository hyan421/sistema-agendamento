import { DateTime } from 'luxon';

import { env } from '../config/env.js';

export class InvalidShopDateTimeError extends Error {}

export function parseShopDateTime(value: string): Date {
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const parsed = hasOffset
    ? DateTime.fromISO(value, { setZone: true })
    : DateTime.fromISO(value, { zone: env.shopTimezone });

  if (!parsed.isValid) {
    throw new InvalidShopDateTimeError('The date-time is invalid in the shop timezone.');
  }

  if (!hasOffset) {
    const hasSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
    const format = hasSeconds ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd'T'HH:mm";
    const wallTime = hasSeconds ? value.slice(0, 19) : value.slice(0, 16);
    if (parsed.toFormat(format) !== wallTime) {
      throw new InvalidShopDateTimeError('The local date-time does not exist in the shop timezone.');
    }
  }

  return parsed.toUTC().toJSDate();
}