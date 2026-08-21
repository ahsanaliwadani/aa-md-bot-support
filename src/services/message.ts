import { Message } from '../models';
import { emitRealtime } from './realtime';

export async function logMessage(input: {
  jid: string;
  direction: 'INCOMING' | 'OUTGOING';
  body: string;
  messageType?: string;
  ticketId?: string;
  mediaUrl?: string;
}): Promise<void> {
  const body = input.body.slice(0, 5000);
  const recentDuplicate = await Message.findOne({
    jid: input.jid,
    direction: input.direction,
    body,
    at: { $gte: new Date(Date.now() - 5000) },
  }).sort({ at: -1 });

  if (recentDuplicate) return;

  const message = await Message.create({
    jid: input.jid,
    direction: input.direction,
    body,
    messageType: input.messageType || 'text',
    ticketId: input.ticketId,
    mediaUrl: input.mediaUrl,
  });
  emitRealtime('message:new', message);
}

export async function getConversation(jid: string, limit = 100) {
  return Message.find({ jid }).sort({ at: -1 }).limit(limit);
}
