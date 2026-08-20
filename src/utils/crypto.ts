import crypto from 'crypto';

const SEG = '[A-Z0-9]{4}';
const PATTERN = new RegExp(`^AA-${SEG}-${SEG}-${SEG}$`);

export function generateAccessKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from(crypto.randomBytes(4), (b) => chars[b % chars.length]).join('');

  return `AA-${seg()}-${seg()}-${seg()}`;
}

export function isValidKeyFormat(key: string): boolean {
  return PATTERN.test(key.trim().toUpperCase());
}

export function hashKey(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export function maskKey(plain: string): string {
  if (!plain || plain.length < 8) return '****';
  return `${plain.slice(0, 3)}-${plain.slice(3, 7)}-****-${plain.slice(-4)}`;
}

export function generateTicketId(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(1000, 9999);
  return `AA-${year}-${rand}`;
}

export function generateRequestId(): string {
  const rand = crypto.randomInt(1000, 9999);
  return `AA-REQ-${rand}`;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
