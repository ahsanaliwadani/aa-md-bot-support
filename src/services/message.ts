import { Message } from '../models';

export async function logMessage(input: {
  jid: string;
  direction: 'INCOMING' | 'OUTGOING';
  body: string;
  messageType?: string;
  ticketId?: string;
  mediaUrl?: string;
}): Promise<void> {
  await Message.create({
    jid: input.jid,
    direction: input.direction,
    body: input.body.slice(0, 5000),
    messageType: input.messageType || 'text',
    ticketId: input.ticketId,
    mediaUrl: input.mediaUrl,
  });
}

export async function getConversation(jid: string, limit = 100) {
  return Message.find({ jid }).sort({ at: -1 }).limit(limit);
}
