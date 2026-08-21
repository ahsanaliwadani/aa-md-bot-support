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

export async function askSupportAi(question: string): Promise<string | null> {
  const prompt = `You are AA MD Bot Official Support. Reply briefly and helpfully in the user's language. If the user wants to buy an access key, pricing, activation, payment help, bot not working, bug report, connection help, or human support, guide them to reply with menu option 1-9. User message: ${question}`;

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

  return null;
}
