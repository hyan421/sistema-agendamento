import type { AssistantInput, AssistantReply } from '@navalha/contracts';
import { env } from '../../config/env.js';
import { listServices } from '../services/service.js';
import { getAvailability } from '../schedule/service.js';
import { getShop } from '../shop/service.js';
import { fallback } from './fallback.js';
import { ollama } from './ollama.js';

export async function answer(input: AssistantInput): Promise<AssistantReply> {
  const [services, shop] = await Promise.all([listServices({}), getShop()]);
  const context = JSON.stringify({ shop, services: services.map(({ id, name, priceCents, durationMinutes }) =>
    ({ id, name, price: `${(priceCents / 100).toFixed(2)} BRL`, durationMinutes })) });
  const slotSuggestions: AssistantReply['slotSuggestions'] = [];
  if (input.serviceId && input.barberId && input.date) {
    const slots = await getAvailability({ serviceId: input.serviceId, barberId: input.barberId, date: input.date });
    for (const slot of slots.slice(0, 3)) {
      slotSuggestions.push({ serviceId: input.serviceId, barberId: input.barberId, startsAt: slot.startsAt, endsAt: slot.endsAt });
    }
  }
  let mode: AssistantReply['mode'] = 'fallback';
  let text: string;
  if (env.aiProvider === 'ollama') {
    try { text = await ollama.reply(input, context); mode = 'ollama'; }
    catch { text = `Modelo indisponível. ${await fallback.reply(input, context)}`; }
  } else { text = await fallback.reply(input, context); }
  return {
    mode, text: `${text}\nA disponibilidade final será confirmada ao reservar.`, slotSuggestions,
    serviceSuggestions: services.slice(0, 4).map(({ id, name, priceCents }) => ({ id, name, priceCents })),
  };
}
