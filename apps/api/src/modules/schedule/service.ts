import {
  timeBlockDTOSchema,
  weeklyHoursSchema,
  type BarberBlocksQuery,
  type AvailabilityQuery,
  type AvailabilitySlot,
  type CreateTimeBlockInput,
  type TimeBlockDTO,
  type WeeklyHourInterval,
} from '@navalha/contracts';
import { parseShopDateTime, InvalidShopDateTimeError } from '../../lib/time.js';
import { buildAvailabilitySlots, type AvailabilityContext } from './availability.js';
import {
  deleteTimeBlock,
  findTimeBlocks,
  findWeeklyHours,
  getAvailabilityContext,
  insertTimeBlock,
  replaceWeeklyHours,
} from './repository.js';

export class InvalidBlockRangeError extends Error {}

export async function getAvailability(input: AvailabilityQuery): Promise<AvailabilitySlot[]> {
  const context: AvailabilityContext = await getAvailabilityContext(input);
  return buildAvailabilitySlots(input.date, context);
}

export async function getWeeklyHours(userId: string): Promise<WeeklyHourInterval[]> {
  return findWeeklyHours(userId);
}

export async function setWeeklyHours(
  userId: string,
  input: unknown,
): Promise<WeeklyHourInterval[]> {
  const parsed = weeklyHoursSchema.parse(input);
  return replaceWeeklyHours(userId, parsed.intervals);
}

export async function getTimeBlocks(
  userId: string,
  range: BarberBlocksQuery,
): Promise<TimeBlockDTO[]> {
  return findTimeBlocks(userId, range);
}

export async function createTimeBlock(
  userId: string,
  input: CreateTimeBlockInput,
): Promise<TimeBlockDTO> {
  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = parseShopDateTime(input.startsAt);
    endsAt = parseShopDateTime(input.endsAt);
  } catch (error) {
    if (error instanceof InvalidShopDateTimeError) {
      throw new InvalidBlockRangeError(error.message);
    }
    throw error;
  }
  if (endsAt <= startsAt) {
    throw new InvalidBlockRangeError('endsAt must be later than startsAt.');
  }

  const block = await insertTimeBlock(userId, input, startsAt, endsAt);
  return timeBlockDTOSchema.parse(block);
}

export async function removeTimeBlock(userId: string, blockId: string): Promise<void> {
  await deleteTimeBlock(userId, blockId);
}