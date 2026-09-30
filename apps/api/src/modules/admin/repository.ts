import type { QueryResultRow } from 'pg';

import type { RegisterInput } from '@navalha/contracts';
import { withTransaction } from '../../db/transaction.js';

interface CreatedBarberRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
}

export class BarberEmailAlreadyExistsError extends Error {}

export async function createBarberAccount(
  input: RegisterInput,
  passwordHash: string,
): Promise<CreatedBarberRow> {
  try {
    return await withTransaction(async (client) => {
      const result = await client.query<CreatedBarberRow>(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'BARBER')
         RETURNING id, name, email`,
        [input.name, input.email, passwordHash],
      );
      const user = result.rows[0]!;
      await client.query(
        'INSERT INTO barbers (user_id, display_name) VALUES ($1, $2)',
        [user.id, input.name],
      );
      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BarberEmailAlreadyExistsError('An account already uses this email.');
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}