import { z } from 'zod';
import { isValidPhone, normalizePhone, countryFromPhone } from '../utils/phone';
import { isValidKeyFormat } from '../utils/crypto';
import { ticketCategorySchema } from '../utils/validation';
import { logger } from '../utils/logger';

export type Intent =
  | 'MENU'
  | 'BUY'
  | 'ACTIVATE'
  | 'KEY_ISSUE'
  | 'PAYMENT_ISSUE'
  | 'BOT_NOT_WORKING'
  | 'REPORT_BUG'
  | 'CONNECTION_ISSUE'
  | 'KEY_INFO'
  | 'PRICING'
  | 'CONTACT'
  | 'CONFIRM_YES'
  | 'CONFIRM_NO'
  | 'NUMBER'
  | 'ACCESS_KEY'
  | 'TICKET_STATUS'
  | 'FAQ_MATCH'
  | 'UNKNOWN';

export interface ParseResult {
  intent: Intent;
  raw: string;
  cleaned: string;
}

const MENU_TRIGGERS = ['hi', 'hello', 'menu', 'help', 'start', 'hey', '0', '00'];
const BUY_TRIGGERS = ['1', 'buy', 'purchase', 'access key', 'key'];
const ACTIVATE_TRIGGERS = ['2', 'activate', 'activation'];
const KEY_ISSUE_TRIGGERS = ['3', 'key issue', 'access key issue'];
const PAYMENT_TRIGGERS = ['4', 'payment', 'payment issue'];
const BOT_NOT_WORKING_TRIGGERS = ['5', 'bot not working', 'not working'];
const BUG_TRIGGERS = ['6', 'bug', 'report bug', 'report'];
const CONNECTION_TRIGGERS = ['7', 'connection', 'connection issue', 'connect'];
const KEY_INFO_TRIGGERS = ['8', 'key info', 'access key info', 'information'];
const PRICING_TRIGGERS = ['9', 'price', 'pricing', 'cost', 'how much'];
const CONTACT_TRIGGERS = ['10', 'contact', 'support'];

export function parseIntent(raw: string): ParseResult {
  const text = raw.trim();
  const lower = text.toLowerCase().replace(/[^a-z0-9\s+\-:]/gi, '').trim();

  if (!lower) return { intent: 'UNKNOWN', raw, cleaned: lower };

  if (MENU_TRIGGERS.includes(lower)) return { intent: 'MENU', raw, cleaned: lower };

  if (BUY_TRIGGERS.includes(lower)) return { intent: 'BUY', raw, cleaned: lower };
  if (ACTIVATE_TRIGGERS.includes(lower)) return { intent: 'ACTIVATE', raw, cleaned: lower };
  if (KEY_ISSUE_TRIGGERS.includes(lower)) return { intent: 'KEY_ISSUE', raw, cleaned: lower };
  if (PAYMENT_TRIGGERS.includes(lower)) return { intent: 'PAYMENT_ISSUE', raw, cleaned: lower };
  if (BOT_NOT_WORKING_TRIGGERS.includes(lower)) return { intent: 'BOT_NOT_WORKING', raw, cleaned: lower };
  if (BUG_TRIGGERS.includes(lower)) return { intent: 'REPORT_BUG', raw, cleaned: lower };
  if (CONNECTION_TRIGGERS.includes(lower)) return { intent: 'CONNECTION_ISSUE', raw, cleaned: lower };
  if (KEY_INFO_TRIGGERS.includes(lower)) return { intent: 'KEY_INFO', raw, cleaned: lower };
  if (PRICING_TRIGGERS.includes(lower)) return { intent: 'PRICING', raw, cleaned: lower };
  if (CONTACT_TRIGGERS.includes(lower)) return { intent: 'CONTACT', raw, cleaned: lower };

  if (lower === 'ticket' || lower === 'my ticket' || lower === 'ticket status' || lower === 'status') {
    return { intent: 'TICKET_STATUS', raw, cleaned: lower };
  }

  const confirmYes = ['yes', 'y', 'correct', 'confirm', 'ok', 'yeah', 'yea', 'haan'];
  const confirmNo = ['no', 'n', 'cancel', 'wrong', 'nahi', 'nope'];
  if (confirmYes.includes(lower)) return { intent: 'CONFIRM_YES', raw, cleaned: lower };
  if (confirmNo.includes(lower)) return { intent: 'CONFIRM_NO', raw, cleaned: lower };

  if (isValidPhone(text)) return { intent: 'NUMBER', raw, cleaned: normalizePhone(text) };

  if (isValidKeyFormat(text)) return { intent: 'ACCESS_KEY', raw, cleaned: text.toUpperCase().trim() };

  return { intent: 'UNKNOWN', raw, cleaned: lower };
}
