import { logger } from '../utils/logger';

const AI_ENDPOINTS = [
  'https://apis.davidcyriltech.my.id/ai/gpt-4o',
  'https://apis.davidcyriltech.my.id/ai/claude-haiku-45',
  'https://apis.davidcyriltech.my.id/ai/gemini-3-pro',
  'https://apis.davidcyriltech.my.id/ai/claude-opus-48',
];

export interface SupportAiResult {
  reply: string;
  needsHuman: boolean;
  category: 'Payment' | 'Access Key' | 'Connection' | 'Bot Offline' | 'Other';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

function extractAiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  for (const candidate of [obj.result, obj.response, obj.answer, obj.message, obj.text, obj.content]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return obj.data ? extractAiText(obj.data) : null;
}

function cleanJson(text: string): SupportAiResult | null {
  const candidate = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;
  try {
    const value = JSON.parse(candidate) as Partial<SupportAiResult>;
    if (typeof value.reply !== 'string' || !value.reply.trim()) return null;
    const category = ['Payment', 'Access Key', 'Connection', 'Bot Offline', 'Other'].includes(value.category || '')
      ? value.category as SupportAiResult['category'] : 'Other';
    const priority = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(value.priority || '')
      ? value.priority as SupportAiResult['priority'] : 'NORMAL';
    return { reply: value.reply.trim().slice(0, 1800), needsHuman: value.needsHuman === true, category, priority };
  } catch { return null; }
}

function localSupportAnswer(question: string): SupportAiResult {
  const q = question.toLowerCase();
  const category = /pay|transaction|refund|receipt/.test(q) ? 'Payment'
    : /key|activat|licen[cs]e/.test(q) ? 'Access Key'
      : /connect|qr|pair|link|offline|network/.test(q) ? 'Connection'
        : /bug|crash|command|feature/.test(q) ? 'Bot Offline' : 'Other';
  const needsHuman = /human|agent|support team|refund|charged|scam|urgent|security|hacked/.test(q);
  const reply = category === 'Payment'
    ? 'Please share your payment request ID, payment method, and a screenshot or transaction reference. I can check the next step. Do not share card numbers, PINs, or passwords.'
    : category === 'Connection'
      ? 'Please check your internet connection, remove the existing linked device, scan a new QR code, and restart the bot. Tell me which step fails and include any error message.'
      : category === 'Access Key'
        ? 'Please send the exact access-key error and confirm whether the key has already been activated on another WhatsApp number. Never share the full key in a public group.'
        : category === 'Bot Offline'
          ? 'Please tell me the affected command, what you expected to happen, and the exact error or a screenshot. I will guide you through the next check.'
          : 'I can help with access keys, payments, connection problems, and bot issues. Please describe what happened, what you expected, and any error message or screenshot.';
  return { reply, needsHuman, category, priority: needsHuman ? 'HIGH' : 'NORMAL' };
}

export async function askSupportAi(question: string, context = ''): Promise<SupportAiResult> {
  const prompt = `You are AA MD Bot Official Support, a professional real-time customer-support AI. Respond only in clear, complete English even if the customer writes Roman Urdu, Urdu, or mixed language. Give a direct, practical answer based on the customer's actual message; do not merely repeat an FAQ or show a menu. Ask at most one focused follow-up question when essential. Never claim a payment is approved, a key is activated, or that a human will respond unless it is confirmed. Escalate only when the issue needs account review, payment verification, a security concern, repeated failure after troubleshooting, or the customer explicitly asks for a human. Return valid JSON only: {"reply":"...","needsHuman":true|false,"category":"Payment|Access Key|Connection|Bot Offline|Other","priority":"LOW|NORMAL|HIGH|URGENT"}. Context: ${context || 'None'}. Customer message: ${question}`;

  for (const endpoint of AI_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('text', prompt);
      url.searchParams.set('prompt', prompt);
      url.searchParams.set('q', prompt);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const answer = extractAiText(await response.json().catch(() => null));
      const result = answer ? cleanJson(answer) : null;
      if (result) return result;
    } catch (err) { logger.warn({ err, endpoint }, 'Support AI endpoint failed'); }
  }
  return localSupportAnswer(question);
}
