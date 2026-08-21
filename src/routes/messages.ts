import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message, User, Admin } from '../models';
import { authRequired, requirePermission } from '../middleware/auth';
import { botManager } from '../bot/BotManager';
import { isIndividualWhatsAppJid, phoneToJid } from '../utils/phone';
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
      const user = await User.findOne({ jid: conv._id }).select('customerId phoneNumber country name blocked botPaused botPausedBy').populate('botPausedBy', 'name email');
      return {
        jid: conv._id,
        phoneNumber: user?.phoneNumber || conv._id.split('@')[0],
        customerName: user?.name || '',
        country: user?.country || '',
        blocked: user?.blocked || false,
        botPaused: user?.botPaused || false,
        botPausedBy: user?.botPausedBy || null,
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
  const user = await User.findOne({ jid }).select('customerId phoneNumber country name blocked tags botPaused botPausedBy botPausedAt').populate('botPausedBy', 'name email');
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

    let { jid, text } = req.body;
    jid = String(jid).trim();
    if (jid.endsWith('@c.us')) jid = phoneToJid(jid.split('@')[0]);
    if (!jid.includes('@')) jid = phoneToJid(jid);

    // Validate one-to-one WhatsApp JID format, including @lid privacy JIDs.
    if (!isIndividualWhatsAppJid(jid)) {
      res.status(400).json({ error: 'Invalid WhatsApp JID' });
      return;
    }

    await botManager.sendText(jid, text);
    await messageService.logMessage({ jid, direction: 'OUTGOING', body: text });

    res.json({ success: true });
  },
);

router.post('/:jid/assign-me', authRequired, requirePermission('messages:write'), audit('CHAT_ASSIGNED_TO_ME', 'message'), async (req: Request, res: Response) => {
  const jid = decodeURIComponent(req.params.jid);
  const admin = await Admin.findById(req.admin!.id);
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }
  const user = await User.findOneAndUpdate(
    { jid },
    { botPaused: true, botPausedBy: admin._id, botPausedAt: new Date(), supportStatus: 'IN_PROGRESS' },
    { new: true },
  ).populate('botPausedBy', 'name email');
  if (!user) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  res.json({ user });
});

router.post('/:jid/release-bot', authRequired, requirePermission('messages:write'), audit('CHAT_RELEASED_TO_BOT', 'message'), async (req: Request, res: Response) => {
  const jid = decodeURIComponent(req.params.jid);
  const user = await User.findOneAndUpdate(
    { jid },
    { botPaused: false, $unset: { botPausedBy: 1, botPausedAt: 1 } },
    { new: true },
  );
  if (!user) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  res.json({ user });
});

export default router;
