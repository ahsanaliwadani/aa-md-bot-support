import { logger } from '../utils/logger';
import { loadSettings } from './settings';

type Role = 'user' | 'assistant';
type Category = 'Payment' | 'Access Key' | 'Connection' | 'Bot Offline' | 'Other';

interface Turn { role: Role; content: string; }
const histories = new Map<string, Turn[]>();
const MAX_CONVERSATIONS = 500;
const MAX_TURNS = 10;

export interface SupportAiResult {
  reply: string;
  needsHuman: boolean;
  category: Category;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

function historyFor(jid: string): Turn[] { return histories.get(jid) || []; }

function remember(jid: string, role: Role, content: string): void {
  const turns = [...historyFor(jid), { role, content: content.slice(0, 1400) }].slice(-MAX_TURNS);
  histories.delete(jid);
  histories.set(jid, turns);
  if (histories.size > MAX_CONVERSATIONS) histories.delete(histories.keys().next().value as string);
}

function isGreeting(text: string): boolean {
  return /^(hi|hello|hey|salam|assalam(?:ualaikum| o alaikum)?|aoa)\b/i.test(text.trim());
}

export interface SupportAiResult {
  reply: string;
  needsHuman: boolean;
  category: 'Payment' | 'Access Key' | 'Connection' | 'Bot Offline' | 'Other';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

function extractAiText(payload: unknown): string | null {
  if (typeof payload === 'string') return payload.trim() || null;
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  for (const candidate of [value.data, value.result, value.response, value.answer, value.message, value.text, value.content]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === 'object') {
      const nested = extractAiText(candidate);
      if (nested) return nested;
    }
  }
  return null;
}

function validReply(text: string | null): text is string {
  if (!text || text.trim().length < 2) return false;
  const lower = text.toLowerCase();
  return !/(failed to fetch|network error|cloudflare error|service unavailable|^(error|exception|traceback|typeerror)\b)/i.test(lower);
}

function cleanMarkdown(text: string): string {
  return text.replace(/^#{1,6}\s+/gm, '*').replace(/\*\*(.*?)\*\*/g, '*$1*').replace(/__(.*?)__/g, '_$1_').replace(/`([^`]+)`/g, '$1').trim().slice(0, 1800);
}

function classify(message: string): Pick<SupportAiResult, 'needsHuman' | 'category' | 'priority'> {
  const value = message.toLowerCase();
  const category: Category = /pay|transaction|refund|receipt|charged/.test(value) ? 'Payment'
    : /key|activat|licen[cs]e/.test(value) ? 'Access Key'
      : /connect|qr|pair|link|network/.test(value) ? 'Connection'
        : /offline|bug|crash|command|feature|error/.test(value) ? 'Bot Offline' : 'Other';
  const needsHuman = /human|agent|support team|refund|charged twice|fraud|scam|security|hacked|account review/.test(value);
  return { category, needsHuman, priority: /fraud|scam|security|hacked/.test(value) ? 'URGENT' : needsHuman ? 'HIGH' : 'NORMAL' };
}

function fallback(message: string): string {
  const { category } = classify(message);
  if (category === 'Payment') return 'Please share your payment request ID, payment method, and transaction reference or screenshot. Do not send card numbers, PINs, or passwords.';
  if (category === 'Access Key') return 'Please send the exact access-key error and confirm whether the key was previously activated on another WhatsApp number.';
  if (category === 'Connection') return 'Check your internet connection, remove the old linked device, scan a new QR code, and restart the bot. Which step fails, and what error do you see?';
  if (category === 'Bot Offline') return 'Please share the affected command, what you expected, and the exact error message or a screenshot.';
  return 'Please describe what happened, what you expected, and any error message or screenshot so I can help you properly.';
}

function fallbackUrdu(message: string): string {
  const { category } = classify(message);
  if (category === 'Access Key') return 'Please exact access-key error bhej dein aur confirm karein ke key pehle kisi doosre WhatsApp number par activate to nahi hui.';
  if (category === 'Connection') return 'Internet check karein, purana linked device remove karein, naya QR scan karein aur bot restart karein. Kaunsa step fail ho raha hai aur kya error aa raha hai?';
  if (category === 'Bot Offline') return 'Affected command, aap ko kya result expected tha, aur exact error ya screenshot bhej dein.';
  return 'Meherbani karke masla detail mein batayein: kya hua, aap kya expect kar rahe thay, aur koi error ya screenshot ho to bhej dein.';
}

function prefersUrdu(message: string): boolean {
  return /[\u0600-\u06ff]/.test(message)
    || /\b(kya|kia|mujhe|mujhy|mera|meri|apna|apni|paisa|paise|bhej|karna|kardo|kaise|nahi|hain|hai|kr|acha|theek)\b/i.test(message);
}

function configuredPaymentReply(settings: Awaited<ReturnType<typeof loadSettings>> | null, urdu: boolean): string {
  const jazzCash = settings?.jazzCash;
  if (jazzCash?.enabled && jazzCash.accountNumber) {
    return urdu
      ? `📲 *JazzCash Payment Details*\n\nAccount Title: ${jazzCash.accountTitle || 'Not specified'}\nAccount Number: ${jazzCash.accountNumber}\n\n${jazzCash.instructions}\n\nPayment ke baad isi chat mein screenshot ya transaction ID bhej dein. Apna PIN, OTP, ya password kabhi share na karein.`
      : `📲 *JazzCash Payment Details*\n\nAccount Title: ${jazzCash.accountTitle || 'Not specified'}\nAccount Number: ${jazzCash.accountNumber}\n\n${jazzCash.instructions}\n\nAfter payment, send the screenshot or transaction ID in this chat. Never share your PIN, OTP, or password.`;
  }
  const instructions = settings?.paymentInstructions || 'Payment details are not configured yet. Please contact support.';
  return urdu
    ? `💳 *Payment Information*\n\n${instructions}\n\nPayment proof isi chat mein bhej dein.`
    : `💳 *Payment Information*\n\n${instructions}\n\nPlease send your payment proof in this chat.`;
}

function configuredPricingReply(settings: Awaited<ReturnType<typeof loadSettings>> | null, urdu: boolean): string {
  if (!settings) return urdu ? 'Prices is waqt load nahi ho rahe. Meherbani karke thori dair baad dobara try karein.' : 'Prices are temporarily unavailable. Please try again shortly.';
  const pakistan = settings.pricing.pakistan;
  const international = settings.pricing.international;
  return urdu
    ? `💰 *Access Key Price*\n\n🇵🇰 Pakistan: ${pakistan.label}\n🌎 International: ${international.label}\n\nYe one-time payment hai; monthly subscription nahi. 1 Access Key = 1 WhatsApp number.`
    : `💰 *Access Key Pricing*\n\n🇵🇰 Pakistan: ${pakistan.label}\n🌎 International: ${international.label}\n\nThis is a one-time payment with no monthly subscription. 1 Access Key = 1 WhatsApp number.`;
}

async function requestProvider(endpoint: string, parameter: string, prompt: string): Promise<string | null> {
  const url = new URL(endpoint);
  url.searchParams.set(parameter, prompt.slice(0, 5000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.text();
    const parsed = (() => { try { return JSON.parse(body) as unknown; } catch { return body; } })();
    const answer = extractAiText(parsed);
    return validReply(answer) ? answer : null;
  } catch { return null; } finally { clearTimeout(timeout); }
}

async function firstSuccessful(requests: Array<Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve) => {
    let pending = requests.length;
    const timer = setTimeout(() => resolve(null), 12_500);
    for (const request of requests) request.then((answer) => {
      if (answer) { clearTimeout(timer); resolve(answer); }
      else if (--pending === 0) { clearTimeout(timer); resolve(null); }
    }).catch(() => { if (--pending === 0) { clearTimeout(timer); resolve(null); } });
  });
}

export async function askSupportAi(jid: string, message: string, context = ''): Promise<SupportAiResult> {
  if (isGreeting(message)) histories.delete(jid);
  const prior = historyFor(jid).slice(-6).map((turn) => `${turn.role === 'user' ? 'Customer' : 'Assistant'}: ${turn.content}`).join('\n');
  const settings = await loadSettings().catch(() => null);
  const urdu = prefersUrdu(message);
  const classification = classify(message);
  const isPaymentRequest = classification.category === 'Payment' && /payment|pay|jazz\s*cash|account|transfer|proof|receipt|transaction|paisa|paise|ادا|پیسے/i.test(message);
  const isPricingRequest = /\b(price|pricing|cost|how much|rate|rates|kitne|kitna|qeemat|قیمت)\b/i.test(message);
  remember(jid, 'user', message);
  // Payment credentials must never be sent to a third-party AI provider or
  // depend on a provider's response. Always use dashboard configuration.
  if (isPaymentRequest) {
    const reply = configuredPaymentReply(settings, urdu);
    remember(jid, 'assistant', reply);
    return { reply, ...classification };
  }
  // Prices are operational data, so always take them directly from Settings.
  // This prevents a provider from returning stale or invented amounts.
  if (isPricingRequest) {
    const reply = configuredPricingReply(settings, urdu);
    remember(jid, 'assistant', reply);
    return { reply, ...classification };
  }
  const paymentContext = settings?.jazzCash.enabled && settings.jazzCash.accountNumber
    ? `For Pakistan payments, JazzCash is enabled: account title ${settings.jazzCash.accountTitle || 'not specified'}, account number ${settings.jazzCash.accountNumber}; instruction: ${settings.jazzCash.instructions}. Only share this when the customer is asking about payment or buying from Pakistan; ask them to send proof in this chat afterward.`
    : settings?.paymentInstructions || 'none';
  const languageInstruction = urdu
    ? 'Reply in the same Roman Urdu or Urdu style used by the customer. Do not switch to English unless the customer used English.'
    : 'Reply in the same language as the customer.';
  const prompt = `You are AA MD Bot's real-time WhatsApp support assistant. ${languageInstruction} Answer the customer's actual latest message directly; never return a generic canned acknowledgement, a command menu, JSON, or API errors. Use short WhatsApp-friendly paragraphs and bullets when useful. Give troubleshooting before suggesting support. Do not claim that a payment, account, or key changed unless confirmed. For payment account details, use ONLY the exact Payment guidance below; never invent, substitute, or mention another account, wallet, or number. Payment guidance: ${paymentContext}. Relevant support knowledge: ${context || 'none'}. Recent conversation: ${prior || 'none'}. Latest customer message: ${message}`;
  const answer = await firstSuccessful([
    requestProvider('https://apis.davidcyriltech.my.id/ai/gpt-4o', 'prompt', prompt),
    requestProvider('https://apis.davidcyriltech.my.id/ai/claude-haiku-45', 'prompt', prompt),
    requestProvider('https://apis.davidcyriltech.my.id/ai/gemini-3-pro', 'prompt', prompt),
    requestProvider('https://apis.davidcyriltech.my.id/ai/claude-opus-48', 'prompt', prompt),
    requestProvider('https://davidcyriltech.my.id/ai/gemini-3-pro', 'prompt', prompt),
    requestProvider('https://davidcyriltech.my.id/ai/gpt-5', 'prompt', prompt),
    requestProvider('https://davidcyriltech.my.id/ai/grok-4.1-fast', 'prompt', prompt),
    requestProvider('https://davidcyriltech.my.id/ai/claude', 'prompt', prompt),
    requestProvider('https://api-abztech.zone.id/ai/gemini', 'message', prompt),
    requestProvider('https://ab-llama-ai.abrahamdw882.workers.dev/', 'q', prompt),
  ]);
  const reply = cleanMarkdown(answer || (urdu ? fallbackUrdu(message) : fallback(message)));
  if (!answer) logger.warn({ jid: jid.slice(-6) }, 'All support AI providers failed; using safe local fallback');
  remember(jid, 'assistant', reply);
  return { reply, ...classification };
}
