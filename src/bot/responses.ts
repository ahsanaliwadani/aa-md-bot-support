import { loadSettings } from '../services/settings';

export async function getMenuText(): Promise<string> {
  const s = await loadSettings();
  return `🤖 ${s.botName} — OFFICIAL SUPPORT

Please select an option:

1️⃣ Buy Access Key
2️⃣ Access Key Activation
3️⃣ Access Key Issue
4️⃣ Payment Issue
5️⃣ Bot Not Working
6️⃣ Report a Bug
7️⃣ Connection Issue
8️⃣ Access Key Information
9️⃣ Pricing
🔟 Contact Support

Reply with a number or keyword (e.g. "buy", "activate", "pricing")`;
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

🇵🇰 Pakistan: ${s.pricing.pakistan.label}
🌎 International: ${s.pricing.international.label}

💳 One-Time Payment
🔑 1 Access Key = 1 WhatsApp Number

Please send the WhatsApp number you want to connect.`;
}

export async function getWelcomeText(): Promise<string> {
  const s = await loadSettings();
  return `👋 Welcome to ${s.botName} Official Support 🤖

${s.welcomeMessage}`;
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
  '🔐 Access Key Activation\n\nPlease send your Access Key in the format:\nAA-XXXX-XXXX-XXXX';

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

📱 Number to Connect: ${number}

Our AA MD Bot Team will contact you very soon with payment details and activation instructions.

⏳ Please stay available.

🤖 AA MD Bot Official Support`;
