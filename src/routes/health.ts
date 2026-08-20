import { Router } from 'express';
import { isDBConnected } from '../services/database';
import { botManager } from '../bot/BotManager';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: isDBConnected() && botManager.isConnected() ? 'ok' : 'degraded',
    bot: botManager.isConnected() ? 'connected' : 'disconnected',
    database: isDBConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

export default router;
