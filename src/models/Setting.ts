import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Setting = mongoose.model<ISetting>('Setting', SettingSchema);

export interface AppSettings {
  botName: string;
  supportNumber: string;
  welcomeMessage: string;
  awayMessage: string;
  maintenanceMode: boolean;
  supportHours: { enabled: boolean; start: string; end: string; timezone: string };
  pricing: {
    pakistan: { amount: number; currency: string; label: string };
    international: { amount: number; currency: string; label: string };
  };
  paymentInstructions: string;
  jazzCash: { enabled: boolean; accountTitle: string; accountNumber: string; instructions: string };
  sessionTimeoutMin: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  botName: 'AA MD BOT',
  supportNumber: '+923316041183',
  welcomeMessage:
    'Welcome to AA MD Bot Official Support. How can we help you today?',
  awayMessage:
    'Our support team is currently away. Please leave a message and we will get back to you soon.',
  maintenanceMode: false,
  supportHours: { enabled: false, start: '09:00', end: '18:00', timezone: 'Asia/Karachi' },
  pricing: {
    pakistan: { amount: 1000, currency: 'PKR', label: 'Rs. 1,000' },
    international: { amount: 5, currency: 'USD', label: '$5 USD' },
  },
  paymentInstructions:
    'After confirming your number, our team will contact you with payment details and activation instructions.',
  jazzCash: {
    enabled: false,
    accountTitle: '',
    accountNumber: '',
    instructions: 'Send payment proof (screenshot or transaction ID) in this chat after payment.',
  },
  sessionTimeoutMin: 10,
};
