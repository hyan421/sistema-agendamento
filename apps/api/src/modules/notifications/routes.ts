import { Router } from 'express';
import { paginationSchema, resourceIdSchema } from '@navalha/contracts';
import { requireUser } from '../../middleware/authentication.js';
import { findNotifications, markRead } from './repository.js';

export const notificationRoutes = Router();
notificationRoutes.get('/notifications', requireUser, async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Paginação inválida.' } });
    return;
  }
  res.json(await findNotifications(req.session.userId!, parsed.data));
});
notificationRoutes.patch('/notifications/:id/read', requireUser, async (req, res) => {
  const parsed = resourceIdSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Identificador inválido.' } });
    return;
  }
  if (!await markRead(req.session.userId!, parsed.data)) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notificação não encontrada.' } });
    return;
  }
  res.status(204).end();
});
