import { logger } from '../utils/logger';

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
  const prompt = `You are AA MD Bot's real-time WhatsApp support assistant. Reply only in complete, natural English. Answer the customer's actual latest message directly; never return a generic canned acknowledgement, a command menu, JSON, or API errors. Use short WhatsApp-friendly paragraphs and bullets when useful. Give troubleshooting before suggesting support. Do not claim that a payment, account, or key changed unless confirmed. Relevant support knowledge: ${context || 'none'}. Recent conversation: ${prior || 'none'}. Latest customer message: ${message}`;
  remember(jid, 'user', message);

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
  const reply = cleanMarkdown(answer || fallback(message));
  if (!answer) logger.warn({ jid: jid.slice(-6) }, 'All support AI providers failed; using safe local fallback');
  remember(jid, 'assistant', reply);
  return { reply, ...classify(message) };
}
