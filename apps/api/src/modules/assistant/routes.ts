import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { assistantInputSchema } from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import { AvailabilityDateOutOfRangeError } from '../schedule/availability.js';
import { BarberNotFoundError, ServiceUnavailableError } from '../schedule/repository.js';
import { answer } from './service.js';

export const assistantRoutes = Router();
const limit = rateLimit({
  windowMs: 60_000, limit: 10, keyGenerator: (req) => req.session.userId!,
  message: { error: { code: 'RATE_LIMIT', message: 'Aguarde um minuto antes de tentar novamente.' } },
});
assistantRoutes.post('/assistant/messages', requireUser, requireRole('CLIENT'), limit, async (req, res) => {
  if (!req.is('application/json')) {
    res.status(415).json({ error: { code: 'JSON_REQUIRED', message: 'Envie JSON.' } });
    return;
  }
  const parsed = assistantInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_MESSAGE', message: 'Mensagem, histórico ou seleção inválidos.' } });
    return;
  }
  try { res.json({ data: await answer(parsed.data) }); }
  catch (error) {
    if (error instanceof AvailabilityDateOutOfRangeError || error instanceof BarberNotFoundError || error instanceof ServiceUnavailableError) {
      res.status(400).json({ error: { code: 'INVALID_SELECTION', message: 'Atualize o serviço, barbeiro ou data selecionados.' } });
      return;
    }
    throw error;
  }
});
