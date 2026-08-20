import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message, User } from '../models';
import { authRequired, requirePermission } from '../middleware/auth';
import { botManager } from '../bot/BotManager';
import { messageService } from '../services';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { audit } from '../middleware/audit';

const router = Router();

// List all conversations (grouped by jid, with last message + user info)
router.get('/', authRequired, requirePermission('messages:read'), async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const search = (req.query.search as string) || '';

  // Get distinct jids with their latest message
  const pipeline: mongoose.PipelineStage[] = [
    { $sort: { at: -1 } },
    { $group: { _id: '$jid', lastMessage: { $first: '$$ROOT' }, count: { $sum: 1 } } },
    { $sort: { 'lastMessage.at': -1 } },
    { $limit: limit },
  ];

  const conversations = await Message.aggregate(pipeline);

  // Enrich with user info
  const enriched = await Promise.all(
    conversations.map(async (conv: { _id: string; lastMessage: { body: string; direction: string; at: Date }; count: number }) => {
      const user = await User.findOne({ jid: conv._id }).select('customerId phoneNumber country name blocked');
      return {
        jid: conv._id,
        phoneNumber: user?.phoneNumber || conv._id.split('@')[0],
        customerName: user?.name || '',
        country: user?.country || '',
        blocked: user?.blocked || false,
        lastMessageBody: conv.lastMessage.body.slice(0, 100),
        lastMessageDirection: conv.lastMessage.direction,
        lastMessageAt: conv.lastMessage.at,
        messageCount: conv.count,
      };
    }),
  );

  const filtered = search
    ? enriched.filter((c) => c.phoneNumber.includes(search) || c.customerName.toLowerCase().includes(search.toLowerCase()))
    : enriched;

  res.json({ items: filtered });
});

// Get full conversation for a jid
router.get('/:jid', authRequired, requirePermission('messages:read'), async (req: Request, res: Response) => {
  const jid = decodeURIComponent(req.params.jid);
  const messages = await Message.find({ jid }).sort({ at: 1 }).limit(500);
  const user = await User.findOne({ jid }).select('customerId phoneNumber country name blocked tags');
  res.json({ messages, user });
});

// Send a message from dashboard through the bot
const sendSchema = z.object({
  jid: z.string().min(5).max(100),
  text: z.string().min(1).max(5000),
});

router.post(
  '/send',
  authRequired,
  requirePermission('messages:write'),
  audit('MESSAGE_SENT', 'message'),
  validateBody(sendSchema),
  async (req: Request, res: Response) => {
    if (!botManager.isConnected()) {
      res.status(503).json({ error: 'WhatsApp bot is not connected' });
      return;
    }

    const { jid, text } = req.body;

    // Validate jid format
    if (!jid.endsWith('@s.whatsapp.net')) {
      res.status(400).json({ error: 'Invalid WhatsApp JID' });
      return;
    }

    await botManager.sendText(jid, text);
    await messageService.logMessage({ jid, direction: 'OUTGOING', body: text });

    res.json({ success: true });
  },
);

export default router;
