// GET /api/v1/salud — healthcheck (lo usa el balanceador de carga en la nube).
import { Router } from 'express';

export function saludRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ estado: 'ok', hora: new Date().toISOString() });
  });
  return router;
}
