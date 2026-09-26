import { z } from 'zod';

export const metricsQuerySchema = z.object({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => {
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    return days >= 0 && days < 366;
  }, 'Período deve ter entre 1 e 366 dias.');
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type MetricsDTO = {
  from: string; to: string; timezone: string; activeUsers: number;
  appointments: { CONFIRMED: number; CANCELLED: number; COMPLETED: number };
  services: { id: string; name: string; total: number }[];
};
