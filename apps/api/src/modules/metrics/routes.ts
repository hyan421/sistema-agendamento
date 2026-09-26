import { Router } from 'express';
import { metricsQuerySchema } from '@navalha/contracts';
import { requireRole, requireUser } from '../../middleware/authentication.js';
import { getMetrics } from './service.js';

export const metricsRoutes = Router();
metricsRoutes.get('/admin/metrics', requireUser, requireRole('ADMIN'), async (req, res) => {
  const parsed = metricsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_PERIOD', message: 'Informe datas válidas, em ordem, com até 366 dias.' } });
    return;
  }
  res.json({ data: await getMetrics(parsed.data) });
});
