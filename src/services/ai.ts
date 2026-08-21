import { logger } from '../utils/logger';

const AI_ENDPOINTS = [
  'https://apis.davidcyriltech.my.id/ai/gpt-4o',
  'https://apis.davidcyriltech.my.id/ai/claude-haiku-45',
  'https://apis.davidcyriltech.my.id/ai/gemini-3-pro',
  'https://apis.davidcyriltech.my.id/ai/claude-opus-48',
];

function extractAiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const candidates = [obj.result, obj.response, obj.answer, obj.message, obj.text, obj.content];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  if (obj.data) return extractAiText(obj.data);
  return null;
}

function localSupportAnswer(question: string): string {
  const q = question.toLowerCase();
  const romanUrdu = /\b(salam|suna|kya|kaise|nhi|nahin|acha|bata|kr|karo|hai|ha|ho)\b/i.test(question);
  const greet = /\b(hi|hello|hey|salam|assalam|suna)\b/i.test(question);

  if (greet && romanUrdu) {
    return 'Wa Alaikum Assalam 😊 Main AA MD Bot Official Support assistant hoon. Aap bataen kis cheez mein help chahiye — access key buy/activate, payment, connection issue, ya bot not working? Agar quick options chahiye hon to "menu" likh dein.';
  }
  if (greet) {
    return 'Hello 😊 I am the AA MD Bot Official Support assistant. Tell me what you need help with — buying/activating an access key, payment, connection, or bot not working. Type "menu" for quick options.';
  }
  if (/price|pricing|cost|rate|kitn|fees|payment/.test(q)) {
    return romanUrdu
      ? 'AA MD Bot access key one-time payment hai: Pakistan Rs. 1,000 aur international $5 USD. Buy karne ke liye “1” ya “buy” send karein.'
      : 'AA MD Bot access key is a one-time payment: Pakistan Rs. 1,000 and international $5 USD. Send “1” or “buy” to start.';
  }
  if (/activate|activation|key|invalid|rejected/.test(q)) {
    return romanUrdu
      ? 'Activation ke liye apni access key AA-XXXX-XXXX-XXXX format mein send karein. Agar key reject ho rahi hai to “3” send karke Access Key Issue create karein.'
      : 'For activation, send your access key in AA-XXXX-XXXX-XXXX format. If it is rejected, send “3” to create an Access Key Issue.';
  }
  if (/connect|qr|pair|link|offline|not working|band/.test(q)) {
    return romanUrdu
      ? 'Connection issue ke liye internet check karein, linked devices remove karke QR dobara scan karein, phir bot restart karein. Agar issue rahe to “7” send karke ticket banwa lein.'
      : 'For connection issues, check internet, remove linked devices, scan the QR again, then restart the bot. If it continues, send “7” to create a ticket.';
  }

  return romanUrdu
    ? 'Samajh gaya. Main aapki help kar sakta hoon — please thori detail dein: issue access key, payment, connection, ya bot not working mein se kis se related hai? Quick options ke liye “menu” likhein.'
    : 'I understand. Please share a little more detail: is this about access key, payment, connection, or bot not working? Type “menu” for quick options.';
}

export async function askSupportAi(question: string): Promise<string> {
  const prompt = `You are AA MD Bot Official Support, a powerful WhatsApp support assistant. Reply in the user's language (English, Urdu, or Roman Urdu), warmly and briefly. Never send the generic phrase "Thanks for your message. Our support team will review it" as the main answer. Do not dump the full menu unless the user asks for menu/help. For greetings, greet back and ask how you can help. Diagnose issues, ask one useful follow-up question when needed, and mention exact menu numbers only when they clearly fit: 1 buy key, 2 activate key, 3 key issue, 4 payment issue, 5 bot not working, 6 bug report, 7 connection issue, 8 key info, 9 pricing, 10 contact. User message: ${question}`;

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
      const payload = await response.json().catch(() => null);
      const answer = extractAiText(payload);
      if (answer) return answer.slice(0, 1800);
    } catch (err) {
      logger.warn({ err, endpoint }, 'Support AI endpoint failed');
    }
  }

  return localSupportAnswer(question);
}
