import { Router, Request, Response } from 'express';
import { User, AccessKey, Payment, Ticket, Admin, SystemEvent } from '../models';
import { authRequired, requirePermission } from '../middleware/auth';
import { isDBConnected } from '../services/database';
import { getHealthStatus } from '../services/health';
import { botManager } from '../bot/BotManager';
import { onRealtimeEvent } from '../services/realtime';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';

const router = Router();

router.get('/stats', authRequired, requirePermission('dashboard:view'), async (_req: Request, res: Response) => {
  try {
    const [totalCustomers, activeKeys, pendingPayments, openTickets, resolvedTickets, revokedKeys] =
      await Promise.all([
        User.countDocuments(),
        AccessKey.countDocuments({ status: 'ACTIVE' }),
        Payment.countDocuments({ status: 'PENDING' }),
        Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] } }),
        Ticket.countDocuments({ status: { $in: ['RESOLVED', 'CLOSED'] } }),
        AccessKey.countDocuments({ status: 'REVOKED' }),
      ]);

    res.json({
      totalCustomers,
      activeKeys,
      pendingPayments,
      openTickets,
      resolvedTickets,
      revokedKeys,
      botConnected: botManager.isConnected(),
      dbConnected: isDBConnected(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/health', authRequired, requirePermission('system:read'), async (_req: Request, res: Response) => {
  const health = await getHealthStatus(botManager.isConnected());
  res.json(health);
});


router.get('/whatsapp/status', authRequired, requirePermission('system:read'), async (_req: Request, res: Response) => {
  res.json(botManager.getConnectionStatus());
});

const pairingSchema = z.object({
  phone: z.string().min(7).max(20).transform((value) => value.replace(/[^0-9]/g, '')),
});

router.post(
  '/whatsapp/pairing-code',
  authRequired,
  requirePermission('system:read'),
  validateBody(pairingSchema),
  async (req: Request, res: Response) => {
    if (botManager.isConnected()) {
      res.status(400).json({ error: 'WhatsApp is already connected' });
      return;
    }

    const code = await botManager.requestPairingCode(req.body.phone);
    if (!code) {
      res.status(400).json({ error: 'Pairing code is not available yet. Wait for the bot socket to start, then try again.' });
      return;
    }

    res.json({ code, phone: req.body.phone });
  },
);


router.get('/realtime', authRequired, requirePermission('dashboard:view'), async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, payload: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send('ready', { at: new Date().toISOString() });
  const unsubscribe = onRealtimeEvent(({ event, payload }) => send(event, payload));
  const heartbeat = setInterval(() => send('heartbeat', { at: new Date().toISOString() }), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

router.get('/events', authRequired, requirePermission('system:read'), async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const events = await SystemEvent.find().sort({ at: -1 }).limit(limit);
  res.json({ items: events });
});

router.get('/admins', authRequired, requirePermission('admins:read'), async (_req: Request, res: Response) => {
  const admins = await Admin.find().select('-passwordHash -twoFactorSecret').sort({ createdAt: 1 });
  res.json({ items: admins });
});

export default router;
