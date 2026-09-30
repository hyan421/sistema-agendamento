import type { PaginationQuery } from '@navalha/contracts';
import { query } from '../../db/pool.js';

export async function findNotifications(userId: string, page: PaginationQuery) {
  const items = await query(`SELECT n.id, n.kind, n.message, b.display_name AS "barberName",
      n.read_at AS "readAt", n.created_at AS "createdAt"
    FROM notifications n
    JOIN appointments a ON a.id = n.appointment_id
    JOIN barbers b ON b.id = a.barber_id
    WHERE n.user_id = $1 ORDER BY n.created_at DESC, n.id DESC
    LIMIT $2 OFFSET $3`, [userId, page.pageSize, (page.page - 1) * page.pageSize]);
  const counts = await query<{ total: number; unread: number }>(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE read_at IS NULL)::int AS unread FROM notifications WHERE user_id = $1`, [userId]);
  return { data: items.rows, meta: { ...page, ...counts.rows[0] } };
}

export async function markRead(userId: string, id: string): Promise<boolean> {
  const result = await query(`UPDATE notifications SET read_at = COALESCE(read_at, now())
    WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  return result.rowCount === 1;
}
