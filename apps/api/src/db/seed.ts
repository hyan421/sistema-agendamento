import { registerSchema } from '@navalha/contracts';
import { env } from '../config/env.js';
import { hashPassword } from '../modules/auth/service.js';
import { closeDatabase } from './pool.js';
import { withTransaction } from './transaction.js';

const id = (number: number): string => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

async function seed(): Promise<void> {
  if (env.nodeEnv === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Seed permitido apenas em desenvolvimento com ALLOW_DEMO_SEED=true.');
  }
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.includes('SUBSTITUIR')) throw new Error('Configure DEMO_PASSWORD.');
  registerSchema.parse({ name: 'Demo', email: 'demo@example.test', password });
  const passwordHash = await hashPassword(password);
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [874232]);
    await client.query(`INSERT INTO shop (id, name, city, district, address, timezone)
      VALUES (1, 'Navalha & Hora — Demo', 'Cidade Demo', 'Bairro Demo', 'Rua Demo, 100', $1)
      ON CONFLICT (id) DO NOTHING`, [env.shopTimezone]);
    const accounts = [
      ['Cliente Demo', 'cliente@demo.test', 'CLIENT'],
      ['Administrador Demo', 'admin@demo.test', 'ADMIN'],
      ['Barbeiro Um', 'barbeiro1@demo.test', 'BARBER'],
      ['Barbeiro Dois', 'barbeiro2@demo.test', 'BARBER'],
    ];
    for (const [index, [name, email, role]] of accounts.entries()) {
      const inserted = await client.query(`INSERT INTO users (id, name, email, role, password_hash)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
      [id(index + 1), name, email, role, passwordHash]);
      // Reaplicar nao redefine senhas, papeis ou jornadas editadas pelo usuario.
      if (role !== 'BARBER' || !inserted.rowCount) continue;
      const barberId = id(index + 10);
      await client.query('INSERT INTO barbers (id, user_id, display_name) VALUES ($1, $2, $3)',
        [barberId, id(index + 1), name]);
      for (let weekday = 1; weekday <= 6; weekday++) {
        await client.query(`INSERT INTO weekly_hours (barber_id, weekday, start_time, end_time)
          VALUES ($1, $2, '09:00', '12:00'), ($1, $2, '13:00', '18:00')`, [barberId, weekday]);
      }
    }
    const services = [
      ['Corte clássico', 'CUT', 30, 4000], ['Degradê', 'CUT', 45, 5000],
      ['Barba', 'BEARD', 30, 3000], ['Corte + barba', 'COMBO', 60, 7000],
    ];
    for (const [index, [name, category, duration, price]] of services.entries()) {
      await client.query(`INSERT INTO services (id, name, category, duration_minutes, price_cents)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [id(index + 20), name, category, duration, price]);
    }
  });
  console.log('Dados de demonstracao preparados; contas existentes foram preservadas.');
}

await seed().catch(() => {
  console.error('Seed falhou. Confira ambiente, senha de demo e migrations.');
  process.exitCode = 1;
}).finally(closeDatabase);
