import type { PaginationQuery } from '@navalha/contracts';
import { query } from '../../db/pool.js';

export async function findNotifications(userId: string, page: PaginationQuery) {
  const items = await query(`SELECT id, kind, message, read_at AS "readAt", created_at AS "createdAt"
    FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC
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
