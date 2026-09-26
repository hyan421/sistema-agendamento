import { z } from 'zod';

export const serviceCategorySchema = z.enum(['CUT', 'BEARD', 'COMBO']);

export const barberDTOSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
});

const serviceFields = {
  name: z.string().trim().min(3).max(80),
  description: z.string().max(500),
  category: serviceCategorySchema,
  durationMinutes: z.number().int().min(15).max(180).multipleOf(15),
  priceCents: z.number().int().min(1).max(100_000),
};

export const serviceDTOSchema = z.strictObject({
  id: z.uuid(),
  ...serviceFields,
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const publicServicesQuerySchema = z
  .strictObject({
    category: serviceCategorySchema.optional(),
    minPriceCents: z.coerce.number().int().min(1).max(100_000).optional(),
    maxPriceCents: z.coerce.number().int().min(1).max(100_000).optional(),
    location: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((filters, context) => {
    if (
      filters.minPriceCents !== undefined &&
      filters.maxPriceCents !== undefined &&
      filters.minPriceCents > filters.maxPriceCents
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxPriceCents'],
        message: 'maxPriceCents must be greater than or equal to minPriceCents.',
      });
    }
  });

export const createServiceSchema = z.strictObject(serviceFields);

export const updateServiceSchema = z
  .strictObject({
    name: serviceFields.name.optional(),
    description: serviceFields.description.optional(),
    category: serviceCategorySchema.optional(),
    durationMinutes: serviceFields.durationMinutes.optional(),
    priceCents: serviceFields.priceCents.optional(),
    active: z.boolean().optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, {
    message: 'At least one service field must be provided.',
  });

export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type BarberDTO = z.infer<typeof barberDTOSchema>;
export type ServiceDTO = z.infer<typeof serviceDTOSchema>;
export type PublicServicesQuery = z.infer<typeof publicServicesQuerySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;