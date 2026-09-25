import type { QueryResultRow } from 'pg';

import type { RegisterInput, UserRole } from '@navalha/contracts';
import { query } from '../../db/pool.js';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
}

interface UserRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
}

const userColumns = `
  id,
  name,
  email,
  password_hash AS "passwordHash",
  role,
  active
`;

export class EmailAlreadyExistsError extends Error {}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await query<UserRow>(
    `SELECT ${userColumns} FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await query<UserRow>(
    `SELECT ${userColumns} FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createClientUser(
  input: RegisterInput,
  passwordHash: string,
): Promise<UserRecord> {
  try {
    const result = await query<UserRow>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'CLIENT')
       RETURNING ${userColumns}`,
      [input.name, input.email, passwordHash],
    );
    return result.rows[0]!;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EmailAlreadyExistsError('An account already uses this email.');
    }
    throw error;
  }
}

export async function updateLastLoginAt(id: string): Promise<void> {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}