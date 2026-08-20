export function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

export function phoneToJid(phone: string): string {
  const p = normalizePhone(phone);
  return `${p}@s.whatsapp.net`;
}

export function jidToPhone(jid: string): string {
  return jid.split('@')[0];
}

export function isWhatsAppJid(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us');
}

const COUNTRY_CODES: Record<string, string> = {
  '92': 'Pakistan',
  '91': 'India',
  '1': 'United States',
  '44': 'United Kingdom',
  '971': 'United Arab Emirates',
  '966': 'Saudi Arabia',
  '61': 'Australia',
  '49': 'Germany',
  '33': 'France',
  '39': 'Italy',
  '34': 'Spain',
  '880': 'Bangladesh',
  '94': 'Sri Lanka',
  '977': 'Nepal',
  '60': 'Malaysia',
  '65': 'Singapore',
  '62': 'Indonesia',
  '63': 'Philippines',
  '90': 'Turkey',
  '20': 'Egypt',
  '234': 'Nigeria',
  '254': 'Kenya',
  '27': 'South Africa',
};

export function countryFromPhone(phone: string): string {
  const p = normalizePhone(phone);
  for (let i = 3; i >= 1; i--) {
    const code = p.slice(0, i);
    if (COUNTRY_CODES[code]) return COUNTRY_CODES[code];
  }
  return 'Unknown';
}

export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  return /^\d{7,15}$/.test(p);
}
