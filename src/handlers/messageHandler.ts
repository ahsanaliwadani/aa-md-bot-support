import { WASocket, WAMessage, downloadMediaMessage } from '@whiskeysockets/baileys';
import { jidToPhone, countryFromPhone, isIndividualWhatsAppJid } from '../utils/phone';
import { parseIntent, Intent } from './intentParser';
import { conversationService, userService, accessKeyService, ticketService, paymentService, faqService, messageService, loadSettings } from '../services';
import { askSupportAi, SupportAiResult } from '../services/ai';
import { ConversationStateName } from '../models';
import { AccessKey, Payment, Ticket } from '../models';
import { logger } from '../utils/logger';
import {
  getMenuText,
  getPricingText,
  getBuyFlowText,
  getWelcomeText,
  getContactText,
  ACTIVATE_PROMPT,
  KEY_ISSUE_MENU,
  CONNECTION_ISSUE_TEXT,
  BOT_NOT_WORKING_PROMPT,
  REPORT_BUG_PROMPT,
  PAYMENT_ISSUE_PROMPT,
  TICKET_CREATED_TEXT,
  REQUEST_RECEIVED_TEXT,
} from '../bot/responses';
import { SystemEvent } from '../models';
import { saveMessageImage, isAllowedImageMime } from '../utils/media';

function getText(msg: WAMessage): string {
  if (!msg.message) return '';
  const content = msg.message.ephemeralMessage?.message
    || msg.message.viewOnceMessage?.message
    || msg.message.viewOnceMessageV2?.message
    || msg.message.viewOnceMessageV2Extension?.message
    || msg.message;
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.imageMessage) return '[Image/screenshot received]';
  if (content.videoMessage) return '[Video received]';
  if (content.documentMessage) return '[Document received]';
  if (content.stickerMessage) return '[Sticker received]';
  if (content.audioMessage) return '[Voice message received]';
  return '';
}

async function extractIncomingImage(sock: WASocket, msg: WAMessage): Promise<{ mediaUrl?: string; messageType: string }> {
  const imageMessage = msg.message?.imageMessage
    || msg.message?.ephemeralMessage?.message?.imageMessage
    || msg.message?.viewOnceMessage?.message?.imageMessage
    || msg.message?.viewOnceMessageV2?.message?.imageMessage
    || msg.message?.viewOnceMessageV2Extension?.message?.imageMessage;

  if (!imageMessage) return { messageType: 'text' };

  const mimetype = imageMessage.mimetype || 'image/jpeg';
  if (!isAllowedImageMime(mimetype)) return { messageType: 'image' };

  const buffer = await downloadMediaMessage(
    msg,
    'buffer',
    {},
    {
      reuploadRequest: sock.updateMediaMessage,
    } as never,
  ) as Buffer;
  const media = await saveMessageImage(buffer, mimetype);
  return { mediaUrl: media.url, messageType: 'image' };
}

const COOLDOWN_MS = 3000;
const SPAM_WINDOW_MS = 60_000;
const SPAM_MAX_MESSAGES = 20;
const lastMessage = new Map<string, { at: number; text: string }>();
const messageWindows = new Map<string, { startedAt: number; count: number }>();
const botMessageIds = new Map<string, number>();

/** Mark messages emitted by this service so their WhatsApp echo is not mistaken for an app reply. */
export function trackBotMessage(messageId?: string | null): void {
  if (!messageId) return;
  const now = Date.now();
  botMessageIds.set(messageId, now);
  for (const [id, sentAt] of botMessageIds) {
    if (now - sentAt > 5 * 60_000) botMessageIds.delete(id);
  }
}

function isTrackedBotMessage(messageId?: string | null): boolean {
  return !!messageId && botMessageIds.delete(messageId);
}

async function send(sock: WASocket, jid: string, text: string): Promise<void> {
  const sent = await sock.sendMessage(jid, { text });
  trackBotMessage(sent?.key?.id);
  await messageService.logMessage({ jid, direction: 'OUTGOING', body: text });
}

/** Use the support AI to recover a customer from an invalid step without losing their flow. */
async function sendInvalidFlowGuidance(sock: WASocket, jid: string, input: string, requirement: string): Promise<void> {
  const ai = await askSupportAi(
    jid,
    input,
    `${requirement} The input does not meet that requirement. Give a brief, friendly correction and the exact next action. Do not reset the flow or create a ticket.`,
  );
  await send(sock, jid, `${ai.reply}\n\nType "menu" at any time to start over.`);
}

export async function handleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const jid = msg.key.remoteJid || '';
  // WhatsApp can identify private chats by a phone JID or an @lid address.
  // Dropping @lid messages makes a connected bot appear online but never reply.
  if (!isIndividualWhatsAppJid(jid)) return;

  const text = getText(msg);
  if (!text) return;

  // Only suppress exact duplicate message retries; do not drop fast menu replies like "Hi" then "1".
  const now = Date.now();
  const last = lastMessage.get(jid);
  if (!msg.key.fromMe && last && last.text === text && now - last.at < COOLDOWN_MS) return;
  lastMessage.set(jid, { at: now, text });

  const phone = jidToPhone(jid);

  const media = await extractIncomingImage(sock, msg).catch((err) => {
    logger.warn({ err, jid: phone.slice(-4) }, 'Could not store WhatsApp image');
    return { messageType: text.startsWith('[Image') ? 'image' : 'text', mediaUrl: undefined as string | undefined };
  });

  if (msg.key.fromMe) {
    // Ignore the echo of a message sent by this service. Only a message typed
    // in the linked WhatsApp app should claim the conversation for a human.
    if (isTrackedBotMessage(msg.key.id)) return;
    // A reply sent from the linked WhatsApp application is a human takeover.
    // Pause automation before the customer can send their next message so the
    // bot never talks over the support agent.
    const user = await userService.findOrCreateUser(jid);
    if (!user.botPaused) {
      user.botPaused = true;
      user.botPausedAt = new Date();
      user.supportStatus = 'IN_PROGRESS';
      await user.save();
      await conversationService.resetState(jid);
      logger.info({ jid: phone.slice(-4) }, 'Chat assigned to human after WhatsApp app reply');
    }
    const openTicket = await Ticket.findOne({
      customerId: user._id,
      status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] },
    }).sort({ updatedAt: -1 });
    if (openTicket) await ticketService.addReply(openTicket.ticketId, 'ADMIN', text.slice(0, 2000));
    await userService.updateUserContact(jid);
    await messageService.logMessage({ jid, direction: 'OUTGOING', body: text, messageType: media.messageType, mediaUrl: media.mediaUrl });
    logger.info({ jid: phone.slice(-4) }, 'Logged outbound WhatsApp message from connected account');
    return;
  }

  await messageService.logMessage({
    jid,
    direction: 'INCOMING',
    body: text,
    messageType: media.messageType,
    mediaUrl: media.mediaUrl,
  });

  const spamWindow = messageWindows.get(jid);
  if (!spamWindow || now - spamWindow.startedAt > SPAM_WINDOW_MS) {
    messageWindows.set(jid, { startedAt: now, count: 1 });
  } else {
    spamWindow.count += 1;
    if (spamWindow.count > SPAM_MAX_MESSAGES) {
      logger.warn({ jid: phone.slice(-4) }, 'Ignoring message because anti-spam limit was exceeded');
      return;
    }
  }

  const user = await userService.findOrCreateUser(jid);
  if (user.blocked) return;

  await userService.updateUserContact(jid);

  if (user.botPaused) {
    const openTicket = await Ticket.findOne({
      customerId: user._id,
      status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] },
    }).sort({ updatedAt: -1 });
    if (openTicket) await ticketService.addReply(openTicket.ticketId, 'USER', text.slice(0, 2000));
    logger.info({ jid: phone.slice(-4) }, 'Bot reply skipped because chat is assigned to a human');
    return;
  }

  // Check for stale state
  const stale = await conversationService.isStateStale(jid);
  if (stale) await conversationService.resetState(jid);

  const { state, data } = await conversationService.getState(jid);
  const parsed = parseIntent(text);

  logger.info({ jid: phone.slice(-4), state, intent: parsed.intent }, 'Processing message');

  if (parsed.intent === 'MENU') {
    await conversationService.resetState(jid);
    await send(sock, jid, `${await getWelcomeText()}\n\n${await getMenuText()}`);
    return;
  }

  if (state !== 'IDLE') {
    await handleStatefulMessage(sock, jid, state, data, parsed, text);
    return;
  }

  await handleIdleMessage(sock, jid, parsed);
}

async function handleIdleMessage(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>): Promise<void> {
  switch (parsed.intent) {
    case 'BUY':
      await send(sock, jid, await getBuyFlowText());
      await conversationService.setState(jid, 'WAITING_FOR_NUMBER');
      break;
    case 'ACTIVATE':
      await send(sock, jid, ACTIVATE_PROMPT);
      await conversationService.setState(jid, 'WAITING_FOR_ACCESS_KEY');
      break;
    case 'KEY_ISSUE':
      await send(sock, jid, KEY_ISSUE_MENU);
      await conversationService.setState(jid, 'WAITING_FOR_ISSUE_CATEGORY');
      break;
    case 'PAYMENT_ISSUE':
      await send(sock, jid, PAYMENT_ISSUE_PROMPT);
      await conversationService.setState(jid, 'WAITING_FOR_ISSUE_DESC', { category: 'Payment', subject: 'Payment Issue' });
      break;
    case 'PAYMENT_STATUS':
      await handlePaymentStatus(sock, jid);
      break;
    case 'BOT_NOT_WORKING':
      await send(sock, jid, BOT_NOT_WORKING_PROMPT);
      await conversationService.setState(jid, 'WAITING_FOR_BUG_DESC', { category: 'Bot Offline' });
      break;
    case 'REPORT_BUG':
      await send(sock, jid, REPORT_BUG_PROMPT);
      await conversationService.setState(jid, 'WAITING_FOR_ISSUE_DESC', { category: 'Other' });
      break;
    case 'CONNECTION_ISSUE':
      await send(sock, jid, CONNECTION_ISSUE_TEXT);
      await conversationService.setState(jid, 'WAITING_FOR_CONNECTION_ISSUE', { category: 'Connection' });
      break;
    case 'KEY_INFO': {
      const s = await loadSettings();
      const user = await userService.findOrCreateUser(jid);
      const key = await AccessKey.findOne({ customerId: user._id }).sort({ updatedAt: -1 });
      const keyLine = key
        ? `\n\nYour key: ${key.displayId}\nStatus: ${key.status}\nServer: ${key.serverName || 'Server 1'}\nConnection: ${key.connectionId || 'default'}`
        : '';
      await send(sock, jid, `ℹ️ ${s.botName} Access Key Information\n\n• 1 Access Key = 1 WhatsApp Number\n• One-time payment — no subscription\n• Pakistan: ${s.pricing.pakistan.label}\n• International: ${s.pricing.international.label}${keyLine}\n\nSelect 1️⃣ to buy or 2️⃣ to activate.`);
      break;
    }
    case 'PRICING':
      await send(sock, jid, await getPricingText());
      break;
    case 'CONTACT':
      const ai = await askSupportAi(jid, parsed.raw);
      await send(sock, jid, `${ai.reply}\n\nIf you still need a support specialist, reply YES. Otherwise reply NO or type menu.`);
      await conversationService.setState(jid, 'WAITING_FOR_CONTACT_CONFIRM', { originalMessage: parsed.raw });
      break;
    case 'TICKET_STATUS': {
      const user = await userService.findOrCreateUser(jid);
      const requestedTicketId = parsed.raw.match(/AA-\d{4}-\d{4}/i)?.[0]?.toUpperCase();
      const tickets = requestedTicketId
        ? await Ticket.find({ customerId: user._id, ticketId: requestedTicketId }).limit(1)
        : await Ticket.find({ customerId: user._id }).sort({ createdAt: -1 }).limit(3);
      if (tickets.length === 0) {
        await send(sock, jid, requestedTicketId
          ? `🎫 I could not find ticket ${requestedTicketId} on your WhatsApp number.`
          : '🎫 You have no support tickets.\n\nType "menu" to return to the main menu.');
      } else {
        let resp = requestedTicketId ? '🎫 Ticket details:\n\n' : '🎫 Your recent tickets:\n\n';
        for (const t of tickets) {
          resp += `Ticket: ${t.ticketId}\nSubject: ${t.subject}\nStatus: ${t.status}\nPriority: ${t.priority}\nUpdated: ${t.updatedAt.toLocaleString()}\n\n`;
        }
        resp += 'Type "menu" to return to the main menu.';
        await send(sock, jid, resp);
      }
      break;
    }
    case 'FAQ_MATCH': {
      const faq = await faqService.findFAQMatch(parsed.raw);
      const ai = await askSupportAi(jid, parsed.raw, faq ? `Relevant knowledge base: ${faq.question} — ${faq.answer}` : '');
      await send(sock, jid, ai.reply);
      break;
    }
    default: {
      // Knowledge-base matches inform the AI; they never replace a real-time answer.
      const faq = await faqService.findFAQMatch(parsed.raw);
      const user = await userService.findOrCreateUser(jid);
      const openTicket = await Ticket.findOne({
        customerId: user._id,
        status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] },
      }).sort({ updatedAt: -1 });
      if (openTicket) {
        await ticketService.addReply(openTicket.ticketId, 'USER', parsed.raw.slice(0, 2000));
        await send(sock, jid, `Your message has been added to ticket ${openTicket.ticketId}. A support specialist will review it and reply here.

Type "menu" if you need a different option.`);
        return;
      }

      const ai = await askSupportAi(jid, parsed.raw, faq ? `Relevant knowledge base: ${faq.question} — ${faq.answer}` : '');
      if (ai.needsHuman) {
        await offerOrCreateAiEscalation(sock, jid, parsed.raw, ai);
        return;
      }
      await send(sock, jid, `${ai.reply}

If this does not resolve the issue, reply "contact" to reach a support specialist. Type "menu" for options.`);
    }
  }
}

async function handleStatefulMessage(
  sock: WASocket,
  jid: string,
  state: ConversationStateName,
  data: Record<string, unknown>,
  parsed: ReturnType<typeof parseIntent>,
  rawText: string,
): Promise<void> {
  switch (state) {
    case 'WAITING_FOR_NUMBER':
      await handleWaitingForNumber(sock, jid, parsed, rawText);
      break;
    case 'WAITING_FOR_CONFIRMATION':
      await handleWaitingForConfirmation(sock, jid, parsed, data, rawText);
      break;
    case 'WAITING_FOR_ACCESS_KEY':
      await handleWaitingForAccessKey(sock, jid, parsed, rawText);
      break;
    case 'WAITING_FOR_ISSUE_CATEGORY':
      await handleIssueCategory(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_ISSUE_DESC':
      await handleIssueDescription(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_BUG_DESC':
      await handleBugDescription(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_BOT_FEATURE':
      await handleBotFeature(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_BUG_ERROR':
      await handleBotError(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_CONNECTION_ISSUE':
      await handleConnectionIssue(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_TICKET_REPLY':
      await handleTicketReply(sock, jid, rawText, data);
      break;
    case 'WAITING_FOR_CONTACT_CONFIRM':
      await handleContactConfirm(sock, jid, parsed, rawText, data);
      break;
    case 'WAITING_FOR_AI_ESCALATION':
      await handleAiEscalationConfirmation(sock, jid, parsed, rawText, data);
      break;
    default:
      await conversationService.resetState(jid);
      await send(sock, jid, await getMenuText());
  }
}

async function offerOrCreateAiEscalation(sock: WASocket, jid: string, message: string, ai: SupportAiResult): Promise<void> {
  await send(sock, jid, `${ai.reply}

This needs account-level review. Reply YES to create a support ticket, or NO to continue troubleshooting with the AI.`);
  await conversationService.setState(jid, 'WAITING_FOR_AI_ESCALATION', { originalMessage: message.slice(0, 2000), category: ai.category, priority: ai.priority });
}

async function handleAiEscalationConfirmation(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>, raw: string, data: Record<string, unknown>): Promise<void> {
  if (parsed.intent === 'CONFIRM_NO' || parsed.intent === 'MENU') {
    await conversationService.resetState(jid);
    await send(sock, jid, parsed.intent === 'MENU' ? await getMenuText() : 'Understood. Please send any additional details and I will continue troubleshooting.');
    return;
  }
  if (parsed.intent !== 'CONFIRM_YES') {
    const ai = await askSupportAi(jid, raw, 'The customer was offered escalation but sent more information. Continue troubleshooting unless a human is essential.');
    await send(sock, jid, `${ai.reply}

Reply YES if you would like me to create a support ticket, or NO to continue with AI assistance.`);
    return;
  }
  const user = await userService.findOrCreateUser(jid);
  const existing = await Ticket.findOne({ customerId: user._id, status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] } }).sort({ updatedAt: -1 });
  if (existing) {
    await ticketService.addReply(existing.ticketId, 'USER', String(data.originalMessage || raw).slice(0, 2000));
    await conversationService.resetState(jid);
    await send(sock, jid, `Your message was added to existing ticket ${existing.ticketId}. A support specialist will reply here.`);
    return;
  }
  const ticket = await ticketService.createTicket({ customerId: user._id, jid, phoneNumber: user.phoneNumber, category: String(data.category || 'Other'), subject: 'AI escalation requires account review', description: String(data.originalMessage || raw).slice(0, 2000), priority: (data.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') || 'NORMAL' });
  await conversationService.resetState(jid);
  await send(sock, jid, `Your support ticket has been created.

🎫 Ticket: ${ticket.ticketId}

A support specialist will review the details and reply here. Please wait for the team response.`);
  await notifyAdmins(sock, jid, `AI ESCALATION
Ticket: ${ticket.ticketId}
Category: ${ticket.category}
Priority: ${ticket.priority}`);
}

async function handleContactConfirm(
  sock: WASocket,
  jid: string,
  parsed: ReturnType<typeof parseIntent>,
  raw: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (parsed.intent === 'CONFIRM_NO' || parsed.intent === 'MENU') {
    await conversationService.resetState(jid);
    await send(sock, jid, 'No problem. Send a message whenever you need help, or type "menu" to see the available options.');
    return;
  }

  if (parsed.intent !== 'CONFIRM_YES') {
    const ai = await askSupportAi(jid, raw);
    await send(sock, jid, `${ai.reply}\n\nIf you still need a support specialist, reply YES. If this resolves the issue, reply NO.`);
    return;
  }

  const user = await userService.findOrCreateUser(jid);
  const existing = await Ticket.findOne({
    customerId: user._id,
    status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] },
    category: 'Human Support',
  }).sort({ createdAt: -1 });

  if (existing) {
    await ticketService.addReply(existing.ticketId, 'USER', (data.originalMessage as string || raw).slice(0, 2000));
    await conversationService.resetState(jid);
    await send(sock, jid, `You already have an open support ticket: ${existing.ticketId}.\n\nA support specialist will review your messages and reply here.`);
    return;
  }

  const ticket = await ticketService.createTicket({
    customerId: user._id,
    jid,
    phoneNumber: user.phoneNumber,
    category: 'Human Support',
    subject: 'Customer requested human support',
    description: (data.originalMessage as string || raw).slice(0, 2000),
    priority: 'NORMAL',
  });

  await conversationService.resetState(jid);
  await send(sock, jid, `Your support ticket has been created.\n\n🎫 Ticket: ${ticket.ticketId}\n\nA support specialist will review it and reply here. Please keep this ticket ID for reference.`);
}

async function handleWaitingForNumber(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>, raw: string): Promise<void> {
  if (parsed.intent === 'CONFIRM_NO' || parsed.intent === 'MENU') {
    await conversationService.resetState(jid);
    await send(sock, jid, 'Request cancelled.\n\n' + await getMenuText());
    return;
  }
  if (parsed.intent !== 'NUMBER') {
    await sendInvalidFlowGuidance(sock, jid, raw, 'You are collecting the WhatsApp number for an access-key request. Ask for one complete international phone number, for example +92XXXXXXXXXX.');
    return;
  }

  const number = parsed.cleaned;
  const country = countryFromPhone(number);
  await conversationService.setState(jid, 'WAITING_FOR_CONFIRMATION', { number, country });
  await send(sock, jid, `✅ Number received.\n\n📱 Number to Connect: +${number}\n\nPlease confirm this is correct.\nReply YES or NO.`);
}

async function handleWaitingForConfirmation(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>, data: Record<string, unknown>, raw: string): Promise<void> {
  const number = data.number as string;
  const country = data.country as string;

  if (parsed.intent === 'CONFIRM_YES') {
    const user = await userService.findOrCreateUser(jid);
    const settings = await loadSettings();
    const isPakistan = country === 'Pakistan';
    const pricing = isPakistan ? settings.pricing.pakistan : settings.pricing.international;

    user.phoneNumber = number;
    user.country = country;
    user.paymentStatus = 'PENDING';
    user.accessKeyStatus = user.accessKeyStatus === 'ACTIVE' ? user.accessKeyStatus : 'PENDING';
    user.tags = Array.from(new Set([...(user.tags || []), 'access-key-request']));
    await user.save();

    const payment = await paymentService.createPaymentRequest({
      customerId: user._id,
      amount: pricing.amount,
      currency: pricing.currency,
      country,
      method: 'Manual',
    });

    await conversationService.resetState(jid);
    await send(sock, jid, `${REQUEST_RECEIVED_TEXT(number)}

💳 Payment Details:
Amount: ${pricing.label}
Country: ${country}
Payment Request: ${payment.paymentRequestId}

Your payment will be reviewed by an administrator. After approval, your access key can be issued.`);

    // Admin notification
    await notifyAdmins(sock, jid, `🚨 NEW ACCESS KEY REQUEST\n\nNumber: +${number}\nCountry: ${country}\nRequest ID: ${payment.paymentRequestId}\nStatus: PAYMENT PENDING\n\nOpen Dashboard: ${settings.botName} Dashboard`);

    await SystemEvent.create({
      type: 'NEW_KEY_REQUEST',
      severity: 'INFO',
      message: `New key request for +${number} (${country}) — ${payment.paymentRequestId}`,
    });
  } else if (parsed.intent === 'CONFIRM_NO') {
    await conversationService.setState(jid, 'WAITING_FOR_NUMBER');
    await send(sock, jid, 'Please send the correct WhatsApp number you want to connect.');
  } else {
    await sendInvalidFlowGuidance(sock, jid, raw, `The customer must confirm the number +${number}. Tell them to reply YES to continue or NO to enter a different number.`);
  }
}

async function handleWaitingForAccessKey(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>, raw: string): Promise<void> {
  if (parsed.intent === 'MENU') {
    await conversationService.resetState(jid);
    await send(sock, jid, await getMenuText());
    return;
  }

  const keyText = raw.trim().toUpperCase();
  const result = await accessKeyService.verifyKeyForUser(keyText, jid);

  if (result.status === 'VALID' && result.key) {
    await accessKeyService.activateKey(result.key.keyId, result.key.createdBy);
    await conversationService.resetState(jid);
    await send(sock, jid, `✅ Access Key Verified\n\n📱 Number: +${result.key.assignedNumber || jidToPhone(jid)}\n🔐 Status: ACTIVE\n\nYour key has been activated successfully!\n\n🤖 AA MD Bot Official Support`);
  } else if (result.status === 'ALREADY_ASSIGNED') {
    await conversationService.resetState(jid);
    await send(sock, jid, '❌ This Access Key is already assigned to another number.\n\nContact official support.\n\nType "menu" to return.');
  } else {
    await sendInvalidFlowGuidance(sock, jid, raw, 'The customer is activating an access key. Explain that the expected format is AA-XXXX-XXXX-XXXX, ask them to paste the exact key, and remind them that they can type menu to cancel.');
  }
}

async function handleIssueCategory(sock: WASocket, jid: string, raw: string, _data: Record<string, unknown>): Promise<void> {
  const num = raw.trim();
  const categories: Record<string, string> = {
    '1': 'Access Key',
    '2': 'Access Key',
    '3': 'Access Key',
    '4': 'Access Key',
    '5': 'Access Key',
    '6': 'Other',
  };
  const category = categories[num];
  if (!category) {
    await sendInvalidFlowGuidance(sock, jid, raw, 'The customer must select one access-key issue category. Give a concise numbered choice list: 1 key not working, 2 key rejected, 3 key already used, 4 wrong number, 5 key lost, 6 other.');
    return;
  }
  const labels: Record<string, string> = {
    '1': 'Key not working',
    '2': 'Key rejected',
    '3': 'Key already used',
    '4': 'Wrong number',
    '5': 'Key lost',
    '6': 'Other issue',
  };
  const subject = labels[num] || 'Access Key Issue';
  await conversationService.setState(jid, 'WAITING_FOR_ISSUE_DESC', { category, subject });
  await send(sock, jid, `Please describe your issue in detail.\n\nIssue: ${subject}`);
}


async function handlePaymentStatus(sock: WASocket, jid: string): Promise<void> {
  const user = await userService.findOrCreateUser(jid);
  const payment = await Payment.findOne({ customerId: user._id }).sort({ createdAt: -1 });

  if (!payment) {
    await send(sock, jid, '💳 No payment request found.\n\nSelect 1️⃣ / type "buy" to request an Access Key.');
    return;
  }

  await send(
    sock,
    jid,
    `💳 Payment Request: ${payment.paymentRequestId}
Status: ${payment.status}
Amount: ${payment.amount} ${payment.currency}

Only admin approval can issue or activate an Access Key.`,
  );
}

async function handleIssueDescription(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  const category = (data.category as string) || 'Other';
  const subject = (data.subject as string) || 'Support Issue';
  const ai = await askSupportAi(jid, raw, `Issue category: ${category}. Subject: ${subject}. Try to resolve it before escalation.`);
  if (ai.needsHuman) {
    await offerOrCreateAiEscalation(sock, jid, raw, { ...ai, category: category === 'Payment' ? 'Payment' : category === 'Access Key' ? 'Access Key' : ai.category });
    return;
  }
  await conversationService.resetState(jid);
  await send(sock, jid, `${ai.reply}\n\nIf this does not solve the issue, reply "contact" to create a support ticket.`);
}

async function handleBugDescription(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  await conversationService.setState(jid, 'WAITING_FOR_BOT_FEATURE', {
    ...data,
    description: raw.slice(0, 2000),
  });
  await send(sock, jid, 'Which command or feature is affected?');
}

async function handleBotFeature(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  await conversationService.setState(jid, 'WAITING_FOR_BUG_ERROR', {
    ...data,
    affectedFeature: raw.slice(0, 500),
  });
  await send(sock, jid, 'Please send the exact error message or screenshot if available. If none, reply "none".');
}

async function handleBotError(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  const category = (data.category as string) || 'Bot Offline';
  const description = [
    `Issue: ${(data.description as string) || 'Not provided'}`,
    `Affected command/feature: ${(data.affectedFeature as string) || 'Not provided'}`,
    `Error/screenshot note: ${raw.slice(0, 1000)}`,
  ].join('\n');
  const ai = await askSupportAi(jid, description, 'This is a detailed bot-error report. Diagnose and provide a safe next step. Escalate only if a specialist must investigate.');
  if (ai.needsHuman) {
    await offerOrCreateAiEscalation(sock, jid, description, { ...ai, category: 'Bot Offline', priority: ai.priority === 'NORMAL' ? 'HIGH' : ai.priority });
    return;
  }
  await conversationService.resetState(jid);
  await send(sock, jid, `${ai.reply}\n\nIf the problem continues, reply "contact" to create a support ticket.`);
}

async function handleConnectionIssue(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  const category = (data.category as string) || 'Connection';
  const ai = await askSupportAi(jid, raw, `Issue category: ${category}. The customer already received basic connection troubleshooting. Give a targeted next step or escalate if it cannot be resolved safely.`);
  if (ai.needsHuman) {
    await offerOrCreateAiEscalation(sock, jid, raw, { ...ai, category: 'Connection', priority: ai.priority === 'NORMAL' ? 'HIGH' : ai.priority });
    return;
  }
  await conversationService.resetState(jid);
  await send(sock, jid, `${ai.reply}\n\nIf the issue continues after trying these steps, reply "contact" to create a support ticket.`);
}

async function handleTicketReply(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  const ticketId = data.ticketId as string;
  if (!ticketId) {
    await conversationService.resetState(jid);
    await send(sock, jid, await getMenuText());
    return;
  }
  await ticketService.addReply(ticketId, 'USER', raw.slice(0, 2000));
  await send(sock, jid, `✅ Your reply has been added to ticket ${ticketId}.\n\nOur team will review and respond soon.`);
  // Don't reset — user can keep replying
}

async function notifyAdmins(sock: WASocket, fromJid: string, message: string): Promise<void> {
  // Admin notifications go to system events; also could forward to support number
  // We avoid sending to arbitrary numbers — only log as system event
  await SystemEvent.create({
    type: 'ADMIN_NOTIFICATION',
    severity: 'INFO',
    message: message.slice(0, 1000),
  });
  logger.info({ type: 'ADMIN_NOTIFICATION' }, 'Admin notification sent');
}
