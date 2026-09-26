import { Router } from 'express';
import { verifyDatabaseConnection } from '../../db/pool.js';
import { getShop } from './service.js';

export const shopRoutes = Router();
shopRoutes.get('/shop', async (_req, res) => { res.json({ data: await getShop() }); });
shopRoutes.get('/health', async (_req, res) => {
  try {
    await verifyDatabaseConnection();
    res.json({ data: { status: 'ok' } });
  } catch {
    res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Banco indisponível.' } });
  }
});
