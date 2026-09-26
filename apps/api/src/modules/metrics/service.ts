import type { MetricsDTO, MetricsQuery } from '@navalha/contracts';
import { env } from '../../config/env.js';
import { localDayBounds } from '../schedule/availability.js';
import { countMetrics } from './repository.js';

export async function getMetrics(period: MetricsQuery): Promise<MetricsDTO> {
  const start = localDayBounds(period.from, env.shopTimezone).start;
  const end = localDayBounds(period.to, env.shopTimezone).end;
  return { ...period, timezone: env.shopTimezone, ...await countMetrics(start, end) };
}
