import { z } from 'zod';

const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const localDateSchema = z.iso.date();
const uuidSchema = z.uuid();
const localOrOffsetDateTimeSchema = z.union([
  z.iso.datetime({ offset: true }),
  z.iso.datetime({ local: true }),
]);

export const weeklyHourIntervalSchema = z
  .strictObject({
    weekday: z.number().int().min(1).max(7),
    startTime: localTimeSchema,
    endTime: localTimeSchema,
  })
  .refine((interval) => interval.startTime < interval.endTime, {
    path: ['endTime'],
    message: 'endTime must be later than startTime.',
  });

export const weeklyHoursSchema = z
  .strictObject({ intervals: z.array(weeklyHourIntervalSchema).max(28) })
  .superRefine(({ intervals }, context) => {
    for (let index = 0; index < intervals.length; index += 1) {
      const interval = intervals[index]!;
      for (let otherIndex = index + 1; otherIndex < intervals.length; otherIndex += 1) {
        const other = intervals[otherIndex]!;
        if (
          interval.weekday === other.weekday &&
          interval.startTime < other.endTime &&
          other.startTime < interval.endTime
        ) {
          context.addIssue({
            code: 'custom',
            path: ['intervals', otherIndex],
            message: 'Working intervals for the same weekday cannot overlap.',
          });
        }
      }
    }
  });

export const barberBlocksQuerySchema = z
  .strictObject({ from: localDateSchema, to: localDateSchema })
  .superRefine(({ from, to }, context) => {
    const fromTime = Date.parse(`${from}T00:00:00Z`);
    const toTime = Date.parse(`${to}T00:00:00Z`);
    const dayDifference = (toTime - fromTime) / 86_400_000;
    if (dayDifference < 0) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'to must not precede from.' });
    } else if (dayDifference > 30) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'The date range cannot exceed 31 days.' });
    }
  });

export const createTimeBlockSchema = z.strictObject({
  startsAt: localOrOffsetDateTimeSchema,
  endsAt: localOrOffsetDateTimeSchema,
  reason: z.string().trim().min(1).max(200),
});

export const timeBlockDTOSchema = z.strictObject({
  id: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});

export const availabilityQuerySchema = z.strictObject({
  serviceId: uuidSchema,
  barberId: uuidSchema,
  date: localDateSchema,
});

export const createAppointmentSchema = z.strictObject({
  serviceId: uuidSchema,
  barberId: uuidSchema,
  startsAt: z.iso.datetime({ offset: true }),
});

export const availabilitySlotSchema = z.strictObject({
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(180),
});

export const appointmentStatusSchema = z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED']);

export const appointmentDTOSchema = z.strictObject({
  id: uuidSchema,
  serviceId: uuidSchema,
  barberId: uuidSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: appointmentStatusSchema,
  serviceName: z.string(),
  priceCents: z.number().int().min(1).max(100_000),
  durationMinutes: z.number().int().min(15).max(180),
  createdAt: z.iso.datetime(),
});

export type WeeklyHourInterval = z.infer<typeof weeklyHourIntervalSchema>;
export type WeeklyHoursInput = z.infer<typeof weeklyHoursSchema>;
export type BarberBlocksQuery = z.infer<typeof barberBlocksQuerySchema>;
export type CreateTimeBlockInput = z.infer<typeof createTimeBlockSchema>;
export type TimeBlockDTO = z.infer<typeof timeBlockDTOSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export type AppointmentDTO = z.infer<typeof appointmentDTOSchema>;