import type { QueryResultRow } from 'pg';

import type {
  CreateServiceInput,
  PublicServicesQuery,
  ServiceCategory,
  UpdateServiceInput,
} from '@navalha/contracts';
import { query } from '../../db/pool.js';

export interface ServiceRecord {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  createdAt: Date;
}

interface ServiceRow extends QueryResultRow, ServiceRecord {}

const serviceColumns = `
  id,
  name,
  description,
  category,
  duration_minutes AS "durationMinutes",
  price_cents AS "priceCents",
  active,
  created_at AS "createdAt"
`;

export async function listPublicServices(
  filters: PublicServicesQuery,
): Promise<ServiceRecord[]> {
  const result = await query<ServiceRow>(
    `SELECT ${serviceColumns}
     FROM services
     WHERE active = TRUE
      AND ($1::text IS NULL OR category = $1)
       AND ($2::integer IS NULL OR price_cents >= $2)
       AND ($3::integer IS NULL OR price_cents <= $3)
       AND (
         $4::text IS NULL OR EXISTS (
           SELECT 1 FROM shop
           WHERE id = 1
             AND (
               strpos(lower(city), lower($4)) > 0 OR
               strpos(lower(district), lower($4)) > 0
             )
         )
       )
     ORDER BY category, name, id`,
    [filters.category ?? null, filters.minPriceCents ?? null, filters.maxPriceCents ?? null, filters.location ?? null],
  );
  return result.rows;
}

export async function listBarberServices(): Promise<ServiceRecord[]> {
  const result = await query<ServiceRow>(
    `SELECT ${serviceColumns} FROM services ORDER BY active DESC, category, name, id`,
  );
  return result.rows;
}

export async function insertService(input: CreateServiceInput): Promise<ServiceRecord> {
  const result = await query<ServiceRow>(
    `INSERT INTO services (name, description, category, duration_minutes, price_cents)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${serviceColumns}`,
    [input.name, input.description, input.category, input.durationMinutes, input.priceCents],
  );
  return result.rows[0]!;
}

export async function updateServiceById(
  id: string,
  input: UpdateServiceInput,
): Promise<ServiceRecord | null> {
  const result = await query<ServiceRow>(
    `UPDATE services
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         category = COALESCE($4, category),
         duration_minutes = COALESCE($5, duration_minutes),
         price_cents = COALESCE($6, price_cents),
         active = COALESCE($7, active)
     WHERE id = $1
     RETURNING ${serviceColumns}`,
    [
      id,
      input.name ?? null,
      input.description ?? null,
      input.category ?? null,
      input.durationMinutes ?? null,
      input.priceCents ?? null,
      input.active ?? null,
    ],
  );
  return result.rows[0] ?? null;
}