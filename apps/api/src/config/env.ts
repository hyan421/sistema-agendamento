import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url));

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const placeholders = ['SUBSTITUIR', '******'];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || placeholders.some((item) => value.includes(item))) {
    throw new Error(`Variavel de ambiente obrigatoria ausente ou invalida: ${name}`);
  }
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Variavel ${name} deve ser uma porta valida`);
  }
  return value;
}

function url(name: string, protocols: string[]): string {
  const value = required(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Variavel ${name} deve ser uma URL valida`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`Variavel ${name} deve usar ${protocols.join(' ou ')}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: positiveInteger('PORT'),
  appOrigin: url('APP_ORIGIN', ['http:', 'https:']),
  databaseUrl: url('DATABASE_URL', ['postgres:', 'postgresql:']),
  sessionSecret: required('SESSION_SECRET'),
  shopTimezone: required('SHOP_TIMEZONE'),
  aiProvider: process.env.AI_PROVIDER ?? 'fallback',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? '',
};

if (!['development', 'test', 'production'].includes(env.nodeEnv)) {
  throw new Error('NODE_ENV deve ser development, test ou production');
}

if (!['fallback', 'ollama'].includes(env.aiProvider)) {
  throw new Error('AI_PROVIDER deve ser fallback ou ollama');
}

try {
  new Intl.DateTimeFormat('en-US', { timeZone: env.shopTimezone });
} catch {
  throw new Error(`SHOP_TIMEZONE invalido: ${env.shopTimezone}`);
}

if (env.aiProvider === 'ollama') {
  url('OLLAMA_BASE_URL', ['http:', 'https:']);
  required('OLLAMA_MODEL');
}
