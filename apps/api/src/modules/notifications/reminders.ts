import { DateTime } from 'luxon';
import { env } from '../../config/env.js';
import { withTransaction } from '../../db/transaction.js';

export async function createReminders(): Promise<void> {
  await withTransaction(async (client) => {
    const appointments = await client.query<{ id: string }>(`SELECT id FROM appointments
      WHERE status = 'CONFIRMED' AND starts_at > now() AND starts_at <= now() + interval '24 hours'
      ORDER BY id FOR UPDATE SKIP LOCKED`);
    for (const { id } of appointments.rows) {
      const result = await client.query<{
        client_id: string; user_id: string; starts_at: Date; service_name_snapshot: string;
      }>(`SELECT a.client_id, b.user_id, a.starts_at, a.service_name_snapshot
        FROM appointments a JOIN barbers b ON b.id = a.barber_id
        WHERE a.id = $1 AND a.status = 'CONFIRMED' AND a.starts_at > now()`, [id]);
      const appointment = result.rows[0];
      if (!appointment) continue;
      const localDate = DateTime.fromJSDate(appointment.starts_at, { zone: env.shopTimezone })
        .toFormat('dd/MM/yyyy HH:mm');
      const message = `Lembrete: ${appointment.service_name_snapshot}, ${localDate}. Agendamento confirmado.`;
      for (const userId of [appointment.client_id, appointment.user_id]) {
        await client.query(`INSERT INTO notifications (user_id, appointment_id, kind, message)
          VALUES ($1, $2, 'BOOKING_REMINDER', $3) ON CONFLICT DO NOTHING`, [userId, id, message]);
      }
    }
  });
}

export function startReminders(): () => Promise<void> {
  let running: Promise<void> | undefined;
  const tick = (): void => {
    if (running) return;
    running = createReminders()
      .catch(() => { console.error('Falha no job de lembretes; nova tentativa em 60 segundos.'); })
      .finally(() => { running = undefined; });
  };
  tick();
  const timer = setInterval(tick, 60_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
