import { loadSettings } from '../services/settings';

export async function getMenuText(): Promise<string> {
  const s = await loadSettings();
  return `🤖 ${s.botName} — OFFICIAL SUPPORT

Choose what you need help with:

1️⃣ Buy an Access Key
2️⃣ Activate my key
3️⃣ Key problem
4️⃣ Payment problem
5️⃣ Bot not working
6️⃣ Report a bug
7️⃣ Connection / QR issue
8️⃣ My key information
9️⃣ Prices
🔟 Talk to support

Reply with a number, or type a keyword such as "buy", "activate", "pricing", "payment status", or "ticket status".

You can type "menu" at any time to safely restart.`;
}

export async function getPricingText(): Promise<string> {
  const s = await loadSettings();
  return `💰 ${s.botName} — PRICING

🇵🇰 Pakistan:
${s.pricing.pakistan.label}

🌎 International:
${s.pricing.international.label}

💳 One-Time Payment

No monthly subscription.

🔑 1 Access Key = 1 WhatsApp Number

Select 1️⃣ to buy your Access Key.`;
}

export async function getBuyFlowText(): Promise<string> {
  const s = await loadSettings();
  return `🔑 ${s.botName} Access Key

🇵🇰 Pakistan:
${s.pricing.pakistan.label}

🌎 International:
${s.pricing.international.label}

💳 One-Time Payment

No monthly subscription.

1 Access Key = 1 WhatsApp Number.

Please send the WhatsApp number you want to connect, including its country code.
Example: +92XXXXXXXXXX

Type "menu" to cancel.`;
}

export async function getWelcomeText(): Promise<string> {
  const s = await loadSettings();
  return `👋 Welcome to ${s.botName} Official Support 🤖`;
}

export async function getContactText(): Promise<string> {
  const s = await loadSettings();
  return `📞 CONTACT SUPPORT

Official Support Number:
${s.supportNumber}

Our team is available to assist you.

Select 0 or type "menu" to return to the main menu.`;
}

export const ACTIVATE_PROMPT =
  '🔐 Access Key Activation\n\nPaste your Access Key exactly in this format:\nAA-XXXX-XXXX-XXXX\n\nType "menu" to cancel.';

export const KEY_ISSUE_MENU = `🔐 Access Key Support

What issue are you experiencing?

1️⃣ Key not working
2️⃣ Key rejected
3️⃣ Key already used
4️⃣ Wrong number
5️⃣ Key lost
6️⃣ Other

Reply with a number.`;

export const CONNECTION_ISSUE_TEXT = `🔗 Connection Issue Troubleshooting

Common solutions:

1. Make sure your phone has internet
2. Remove linked devices and re-link
3. Scan the QR code again
4. Clear WhatsApp Web cache
5. Restart your phone

If the issue persists, please describe your connection problem and a ticket will be created.`;

export const BOT_NOT_WORKING_PROMPT =
  '🤖 Bot Not Working\n\nPlease describe what is not working.';

export const REPORT_BUG_PROMPT =
  '🐛 Report a Bug\n\nPlease describe the bug you encountered.';

export const PAYMENT_ISSUE_PROMPT =
  '💳 Payment Issue\n\nPlease describe your payment issue.';

export const TICKET_CREATED_TEXT = (ticketId: string, priority: string) =>
  `✅ Your support ticket has been created!\n\n🎫 Ticket: ${ticketId}\nPriority: ${priority}\n\nOur support team is reviewing your issue. We will contact you soon.\n\n🤖 ${'AA MD BOT'} Official Support`;

export const REQUEST_RECEIVED_TEXT = (number: string) =>
  `🎉 Your request has been successfully received!

📱 Number to Connect:
+${number}

Our AA MD Bot Team will contact you very soon with payment details and activation instructions.

⏳ Please stay available.

🤖 AA MD Bot Official Support`;
