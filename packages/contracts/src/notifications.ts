import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const resourceIdSchema = z.uuid();
export const notificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER']),
  message: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationDTO = z.infer<typeof notificationSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
