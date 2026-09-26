import { z } from 'zod';

const message = z.string().trim().min(1).max(1000);
export const assistantInputSchema = z.strictObject({
  message,
  history: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: message })).max(6).default([]),
  serviceId: z.uuid().optional(),
  barberId: z.uuid().optional(),
  date: z.iso.date().optional(),
});
export type AssistantInput = z.infer<typeof assistantInputSchema>;
export type AssistantReply = {
  mode: 'fallback' | 'ollama'; text: string;
  serviceSuggestions: { id: string; name: string; priceCents: number }[];
  slotSuggestions: { serviceId: string; barberId: string; startsAt: string; endsAt: string }[];
};
