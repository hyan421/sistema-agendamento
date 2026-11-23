import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { loadEnvFile } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

export async function createEnvironment({
  port = 0,
  demoPassword = randomBytes(18).toString('hex'),
} = {}) {
  if (existsSync('.env')) loadEnvFile('.env');
  const selectedPort = port || await getAvailablePort();
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  const database = `navalha_check_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  const origin = `http://127.0.0.1:${selectedPort}`;
  const env = { ...process.env, DATABASE_URL: url.href, PORT: String(selectedPort), APP_ORIGIN: origin,
    NODE_ENV: 'test', SESSION_SECRET: randomBytes(32).toString('hex'), SHOP_TIMEZONE: 'America/Sao_Paulo',
    AI_PROVIDER: 'fallback', ALLOW_DEMO_SEED: 'true', DEMO_PASSWORD: demoPassword };
  let server;
  const db = new pg.Client({ connectionString: url.href });
  async function cleanup() {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
    await db.end();
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
  try {
    execFileSync(process.execPath, ['apps/api/dist/db/migrate.js'], { env, stdio: 'pipe' });
    execFileSync(process.execPath, ['apps/api/dist/db/seed.js'], { env, stdio: 'pipe' });
    await db.connect();
    const before = await db.query('SELECT id, password_hash FROM users ORDER BY id');
    execFileSync(process.execPath, ['apps/api/dist/db/seed.js'], { env, stdio: 'pipe' });
    const after = await db.query('SELECT id, password_hash FROM users ORDER BY id');
    if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) throw new Error('Seed alterou contas existentes.');
    server = spawn(process.execPath, ['apps/api/dist/server.js'], { env, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (server.exitCode !== null) throw new Error('API de validacao encerrou.');
      try { ready = (await fetch(`${origin}/api/v1/health`)).ok; } catch { /* aguardar startup */ }
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error('API de validacao nao iniciou.');
    async function call(path, { cookie, method = 'GET', body } = {}) {
      const response = await fetch(`${origin}/api/v1${path}`, { method,
        headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0],
        body: await response.json().catch(() => null) };
    }
    async function login(email) {
      const result = await call('/auth/login', { method: 'POST', body: { email, password: env.DEMO_PASSWORD } });
      if (result.status !== 200) throw new Error(`Login falhou para ${email}.`);
      return result.cookie;
    }
    return { db, call, login, cleanup, env, origin };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    throw new Error('Nao foi possivel selecionar uma porta para a API de teste.');
  }
  const { port } = address;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
