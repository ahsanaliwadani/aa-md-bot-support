import { WASocket, WAMessage, downloadMediaMessage } from '@whiskeysockets/baileys';
import { jidToPhone, countryFromPhone, isIndividualWhatsAppJid } from '../utils/phone';
import { parseIntent, Intent } from './intentParser';
import { conversationService, userService, accessKeyService, ticketService, paymentService, faqService, messageService, loadSettings } from '../services';
import { askSupportAi } from '../services/ai';
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

async function send(sock: WASocket, jid: string, text: string): Promise<void> {
  await sock.sendMessage(jid, { text });
  await messageService.logMessage({ jid, direction: 'OUTGOING', body: text });
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
  if (last && last.text === text && now - last.at < COOLDOWN_MS) return;
  lastMessage.set(jid, { at: now, text });

  const phone = jidToPhone(jid);

  const media = await extractIncomingImage(sock, msg).catch((err) => {
    logger.warn({ err, jid: phone.slice(-4) }, 'Could not store WhatsApp image');
    return { messageType: text.startsWith('[Image') ? 'image' : 'text', mediaUrl: undefined as string | undefined };
  });

  if (msg.key.fromMe) {
    await userService.findOrCreateUser(jid);
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
      await send(sock, jid, `${await askSupportAi(parsed.raw)}\n\nKya aap human support ticket banana chahte hain? Reply YES for ticket, or NO/menu if your issue is solved.`);
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
      if (faq) {
        await send(sock, jid, `❓ ${faq.question}\n\n${faq.answer}\n\nType "menu" for more options.`);
      } else {
        await send(sock, jid, await askSupportAi(parsed.raw));
      }
      break;
    }
    default: {
      // Try FAQ match, then route existing support tickets, then use AI without opening unnecessary tickets.
      const faq = await faqService.findFAQMatch(parsed.raw);
      if (faq) {
        await send(sock, jid, `❓ ${faq.question}

${faq.answer}

Type "menu" for more options.`);
        return;
      }

      const user = await userService.findOrCreateUser(jid);
      const openTicket = await Ticket.findOne({
        customerId: user._id,
        status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] },
      }).sort({ updatedAt: -1 });
      if (openTicket) {
        await ticketService.addReply(openTicket.ticketId, 'USER', parsed.raw.slice(0, 2000));
        await send(sock, jid, `✅ Aap ka message ticket ${openTicket.ticketId} mein add ho gaya hai. Team jald response karegi.

Agar bot options chahiye hon to “menu” likhein.`);
        return;
      }

      const aiAnswer = await askSupportAi(parsed.raw);
      await send(sock, jid, `${aiAnswer}

Agar human team ki zaroorat ho to “contact” likhein. Type “menu” for support options.`);
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
      await handleWaitingForConfirmation(sock, jid, parsed, data);
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
    default:
      await conversationService.resetState(jid);
      await send(sock, jid, await getMenuText());
  }
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
    await send(sock, jid, 'Theek hai 😊 Agar dobara help chahiye ho to apna issue likhein ya “menu” send karein.');
    return;
  }

  if (parsed.intent !== 'CONFIRM_YES') {
    await send(sock, jid, `${await askSupportAi(raw)}\n\nAgar ab bhi human support chahiye ho to YES reply karein. Agar issue solve ho gaya ho to NO reply karein.`);
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
    await send(sock, jid, `✅ Aap ka support ticket already open hai: ${existing.ticketId}\n\nTeam aap ko jald response karegi.`);
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
  await send(sock, jid, `✅ Aap ka help ticket create ho gaya hai.\n\n🎫 Ticket: ${ticket.ticketId}\n\nHamari team aap ko jald response karegi.`);
}

async function handleWaitingForNumber(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>, raw: string): Promise<void> {
  if (parsed.intent === 'CONFIRM_NO' || parsed.intent === 'MENU') {
    await conversationService.resetState(jid);
    await send(sock, jid, 'Request cancelled.\n\n' + await getMenuText());
    return;
  }
  if (parsed.intent !== 'NUMBER') {
    await send(sock, jid, '⚠️ Please send a valid WhatsApp number (e.g. +92XXXXXXXXXX).');
    return;
  }

  const number = parsed.cleaned;
  const country = countryFromPhone(number);
  await conversationService.setState(jid, 'WAITING_FOR_CONFIRMATION', { number, country });
  await send(sock, jid, `✅ Number received.\n\n📱 Number to Connect: +${number}\n\nPlease confirm this is correct.\nReply YES or NO.`);
}

async function handleWaitingForConfirmation(sock: WASocket, jid: string, parsed: ReturnType<typeof parseIntent>, data: Record<string, unknown>): Promise<void> {
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

Admin payment approval ke baad access key issue hogi.`);

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
    await send(sock, jid, 'Please reply YES or NO.');
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
    await send(sock, jid, '❌ Invalid Access Key.\n\nPlease check the key and try again.\nFormat: AA-XXXX-XXXX-XXXX\n\nOr type "menu" to cancel.');
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
    await send(sock, jid, 'Please reply with a number 1-6.');
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
  const user = await userService.findOrCreateUser(jid);

  const ticket = await ticketService.createTicket({
    customerId: user._id,
    jid,
    phoneNumber: user.phoneNumber,
    category,
    subject,
    description: raw.slice(0, 2000),
    priority: 'NORMAL',
  });

  await conversationService.resetState(jid);
  await send(sock, jid, TICKET_CREATED_TEXT(ticket.ticketId, ticket.priority));

  await notifyAdmins(sock, jid, `🚨 NEW TICKET\n\nTicket: ${ticket.ticketId}\nCategory: ${category}\nSubject: ${subject}\nNumber: +${user.phoneNumber}\n\nOpen Dashboard: ${(await loadSettings()).botName} Dashboard`);
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
  const user = await userService.findOrCreateUser(jid);
  const description = [
    `Issue: ${(data.description as string) || 'Not provided'}`,
    `Affected command/feature: ${(data.affectedFeature as string) || 'Not provided'}`,
    `Error/screenshot note: ${raw.slice(0, 1000)}`,
  ].join('\n');

  const ticket = await ticketService.createTicket({
    customerId: user._id,
    jid,
    phoneNumber: user.phoneNumber,
    category,
    subject: 'Bot Not Working Report',
    description,
    priority: 'HIGH',
  });

  await conversationService.resetState(jid);
  await send(sock, jid, TICKET_CREATED_TEXT(ticket.ticketId, ticket.priority));

  await notifyAdmins(sock, jid, `🚨 BOT NOT WORKING REPORT

Ticket: ${ticket.ticketId}
Number: +${user.phoneNumber}
Description: ${description.slice(0, 300)}`);
}

async function handleConnectionIssue(sock: WASocket, jid: string, raw: string, data: Record<string, unknown>): Promise<void> {
  const category = (data.category as string) || 'Connection';
  const user = await userService.findOrCreateUser(jid);

  const ticket = await ticketService.createTicket({
    customerId: user._id,
    jid,
    phoneNumber: user.phoneNumber,
    category,
    subject: 'Connection Issue',
    description: raw.slice(0, 2000),
    priority: 'HIGH',
  });

  await conversationService.resetState(jid);
  await send(sock, jid, `✅ A connection issue ticket has been created.\n\n🎫 Ticket: ${ticket.ticketId}\n\nOur team will assist you shortly.`);
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
