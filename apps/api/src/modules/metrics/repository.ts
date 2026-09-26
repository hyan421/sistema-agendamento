import { query } from '../../db/pool.js';
import type { MetricsDTO } from '@navalha/contracts';

export async function countMetrics(start: Date, end: Date) {
  const [appointments, users, services] = await Promise.all([
    query<{ status: keyof MetricsDTO['appointments']; total: number }>(
      `SELECT status, count(*)::int AS total FROM appointments
       WHERE starts_at >= $1 AND starts_at < $2 GROUP BY status`, [start, end]),
    query<{ total: number }>(`SELECT count(*)::int AS total FROM users
      WHERE active AND last_login_at >= $1 AND last_login_at < $2`, [start, end]),
    query<{ id: string; name: string; total: number }>(`SELECT s.id, s.name, count(*)::int AS total
      FROM appointments a JOIN services s ON s.id = a.service_id
      WHERE a.status = 'COMPLETED' AND a.starts_at >= $1 AND a.starts_at < $2
      GROUP BY s.id, s.name ORDER BY total DESC, s.id`, [start, end]),
  ]);
  const counts = { CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0 };
  for (const row of appointments.rows) counts[row.status] = row.total;
  return { appointments: counts, activeUsers: users.rows[0]!.total, services: services.rows };
}
