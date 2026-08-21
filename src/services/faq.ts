import { FAQ, IFAQ } from '../models';

export async function listFAQs(): Promise<IFAQ[]> {
  return FAQ.find({}).sort({ order: 1, createdAt: 1 });
}

export async function createFAQ(input: {
  question: string;
  answer: string;
  keywords?: string[];
}): Promise<IFAQ> {
  return FAQ.create({
    question: input.question,
    answer: input.answer,
    keywords: input.keywords || [],
    enabled: true,
    order: 0,
  });
}

export async function updateFAQ(
  id: string,
  input: Partial<{ question: string; answer: string; keywords: string[]; enabled: boolean }>,
): Promise<IFAQ | null> {
  return FAQ.findByIdAndUpdate(id, input, { new: true });
}

export async function deleteFAQ(id: string): Promise<boolean> {
  const r = await FAQ.findByIdAndDelete(id);
  return !!r;
}

export async function findFAQMatch(text: string): Promise<IFAQ | null> {
  const faqs = await FAQ.find({ enabled: true });
  const lower = text.toLowerCase();
  for (const faq of faqs) {
    if (faq.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return faq;
    }
  }
  return null;
}

export async function seedDefaultFAQs(): Promise<void> {
  const defaults = [
    {
      question: 'How do I start the bot or ask for help?',
      answer:
        'Say salam/hello and describe your issue in your own words. The support assistant can guide you, or you can type menu to see quick support options.',
      keywords: ['salam', 'hello', 'hi', 'help', 'or suna', 'guide'],
    },
    {
      question: 'Which phone number format should I send?',
      answer:
        'Send your WhatsApp number with country code, for example +923001234567. Pakistan local format like 03001234567 is also accepted and converted automatically.',
      keywords: ['number format', 'phone number', 'whatsapp number', '0300', '+92'],
    },
    {
      question: 'How can I check ticket status?',
      answer:
        'Type status, ticket status, or send your ticket ID such as AA-1234-5678. The bot will show your latest ticket updates.',
      keywords: ['ticket status', 'my ticket', 'status', 'ticket id'],
    },
    {
      question: 'What is AA MD Bot?',
      answer:
        'AA MD Bot is a WhatsApp automation bot with features like AI, media download, view once, anti delete, and more. It requires an Access Key to activate.',
      keywords: ['what is', 'aamd', 'aa md', 'about'],
    },
    {
      question: 'What is an Access Key?',
      answer:
        'An Access Key is a one-time activation key that links AA MD Bot to your WhatsApp number. 1 Key = 1 WhatsApp Number.',
      keywords: ['access key', 'what is key', 'key means'],
    },
    {
      question: 'How much is the Access Key?',
      answer:
        'Pakistan: Rs. 1,000. International: $5 USD. One-time payment, no monthly subscription.',
      keywords: ['how much', 'price', 'pricing', 'cost', 'fee'],
    },
    {
      question: 'Is it one-time payment?',
      answer:
        'Yes, it is a one-time payment. No monthly subscription, no recurring fees.',
      keywords: ['one time', 'subscription', 'monthly', 'recurring'],
    },
    {
      question: 'Can I use one key on two numbers?',
      answer:
        'No. 1 Access Key = 1 WhatsApp Number. You need a separate key for each number.',
      keywords: ['two number', 'multiple', 'same key', 'share key'],
    },
    {
      question: 'How do I activate?',
      answer:
        'Send your Access Key in the format AA-XXXX-XXXX-XXXX. We will verify and activate it for your number.',
      keywords: ['activate', 'activation', 'how to activate'],
    },
    {
      question: 'Why is my key not working?',
      answer:
        'Please check that your key is correct and matches your registered WhatsApp number. If the issue persists, select "Access Key Issue" from the menu.',
      keywords: ['not working', 'key issue', 'key rejected', 'invalid key'],
    },
    {
      question: 'How do I report an issue?',
      answer:
        'Select "Report Bug" or "Bot Not Working" from the support menu and describe your problem. A ticket will be created automatically.',
      keywords: ['report', 'bug', 'issue', 'complaint', 'problem'],
    },
    {
      question: 'How long does activation take?',
      answer:
        'After payment approval, activation is usually done within a few minutes to a few hours. Our team will contact you.',
      keywords: ['how long', 'activation time', 'when', 'wait'],
    },
  ];

  await Promise.all(
    defaults.map((d, index) =>
      FAQ.findOneAndUpdate(
        { question: d.question },
        { $setOnInsert: { ...d, enabled: true, order: index } },
        { upsert: true, new: true },
      ),
    ),
  );
}
