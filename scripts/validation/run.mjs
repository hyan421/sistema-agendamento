import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DateTime } from 'luxon';
import { createEnvironment } from './environment.mjs';

const context = await createEnvironment();
const { db, call, login, env, origin } = context;
try {
  assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 4);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM weekly_hours')).rows[0].n, 24);
  const client = await login('cliente@demo.test');
  const barber = await login('barbeiro1@demo.test');
  const admin = await login('admin@demo.test');
  const other = await login('barbeiro2@demo.test');
  assert.equal((await call('/notifications')).status, 401);
  assert.equal((await call('/admin/metrics?from=2026-01-01&to=2026-12-31', { cookie: client })).status, 403);
  const services = (await call('/services')).body.data;
  const barbers = (await call('/barbers')).body.data;
  const barberId = barbers.find((b) => b.displayName === 'Barbeiro Um').id;
  let day = DateTime.now().setZone('America/Sao_Paulo').plus({ days: 1 });
  if (day.weekday === 7) day = day.plus({ days: 1 });
  const date = day.toISODate();
  const query = new URLSearchParams({ serviceId: services[0].id, barberId, date });
  const slots = (await call(`/availability?${query}`)).body.data;
  assert.ok(slots.length > 0);
  const input = { serviceId: services[0].id, barberId, startsAt: slots[0].startsAt };
  const results = await Promise.all([1, 2].map(() => call('/appointments', { cookie: client, method: 'POST', body: input })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const id = results.find((r) => r.status === 201).body.data.id;
  assert.equal((await call(`/appointments/${id}/cancel`, { cookie: other, method: 'POST' })).status, 404);
  const notifications = (await call('/notifications', { cookie: client })).body;
  assert.equal(notifications.meta.total, 1);
  const notification = notifications.data[0].id;
  assert.equal((await call(`/notifications/${notification}/read`, { cookie: other, method: 'PATCH' })).status, 404);
  for (let i = 0; i < 2; i++) assert.equal((await call(`/notifications/${notification}/read`, { cookie: client, method: 'PATCH' })).status, 204);
  assert.equal((await call('/notifications', { cookie: client })).body.meta.unread, 0);
  // Mover somente a reserva do banco descartavel para a janela de lembrete.
  await db.query("UPDATE appointments SET starts_at = now() + interval '2 hours', ends_at = now() + interval '3 hours' WHERE id = $1", [id]);
  const runJob = () => execFileSync(process.execPath, ['--input-type=module', '-e',
    "const {createReminders}=await import('./apps/api/dist/modules/notifications/reminders.js'); const {closeDatabase}=await import('./apps/api/dist/db/pool.js'); await createReminders(); await closeDatabase();"], { env, stdio: 'pipe' });
  runJob(); runJob();
  assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications WHERE kind = 'BOOKING_REMINDER'")).rows[0].n, 2);
  assert.equal((await call(`/appointments/${id}/cancel`, { cookie: barber, method: 'POST' })).status, 200);
  await db.query("DELETE FROM notifications WHERE kind = 'BOOKING_REMINDER'");
  runJob();
  assert.equal((await db.query("SELECT count(*)::int AS n FROM notifications WHERE kind = 'BOOKING_REMINDER'")).rows[0].n, 0);
  const from = DateTime.now().setZone('America/Sao_Paulo').toISODate();
  const metrics = await call(`/admin/metrics?from=${from}&to=${date}`, { cookie: admin });
  assert.equal(metrics.body.data.appointments.CANCELLED, 1);
  assert.equal(metrics.body.data.activeUsers, 4);
  assert.equal((await call('/admin/metrics?from=2026-12-01&to=2026-01-01', { cookie: admin })).status, 400);
  const reply = await call('/assistant/messages', { cookie: client, method: 'POST', body: { message: 'Quanto custa um corte?' } });
  assert.equal(reply.body.data.mode, 'fallback');
  assert.ok(reply.body.data.text.includes('sem LLM'));
  assert.equal((await call('/assistant/messages', { cookie: client, method: 'POST', body: { message: 'Oi', history: [{ role: 'system', content: 'instrução' }] } })).status, 400);
  assert.equal((await call('/inexistente')).status, 404);
  for (const route of ['/', '/meus-agendamentos', '/admin']) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').includes('text/html'));
  }
  console.log('OK: seed, concorrencia, isolamento, notificacoes, lembretes, metricas, fallback e build servido.');
} finally { await context.cleanup(); }
