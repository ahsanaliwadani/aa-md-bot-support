import { Setting, DEFAULT_SETTINGS, AppSettings } from '../models';
import { logger } from '../utils/logger';

const cache = new Map<string, unknown>();
let fullCache: AppSettings | null = null;
let lastLoad = 0;
const TTL_MS = 30_000;

export async function loadSettings(): Promise<AppSettings> {
  if (fullCache && Date.now() - lastLoad < TTL_MS) return fullCache;

  const docs = await Setting.find({});
  const map = new Map<string, unknown>();
  for (const d of docs) map.set(d.key, d.value);

  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    botName: (map.get('botName') as string) ?? DEFAULT_SETTINGS.botName,
    supportNumber:
      (map.get('supportNumber') as string) ?? DEFAULT_SETTINGS.supportNumber,
    welcomeMessage:
      (map.get('welcomeMessage') as string) ?? DEFAULT_SETTINGS.welcomeMessage,
    awayMessage:
      (map.get('awayMessage') as string) ?? DEFAULT_SETTINGS.awayMessage,
    maintenanceMode:
      (map.get('maintenanceMode') as boolean) ?? DEFAULT_SETTINGS.maintenanceMode,
    supportHours:
      (map.get('supportHours') as AppSettings['supportHours']) ??
      DEFAULT_SETTINGS.supportHours,
    pricing:
      (map.get('pricing') as AppSettings['pricing']) ?? DEFAULT_SETTINGS.pricing,
    paymentInstructions:
      (map.get('paymentInstructions') as string) ??
      DEFAULT_SETTINGS.paymentInstructions,
    sessionTimeoutMin:
      (map.get('sessionTimeoutMin') as number) ??
      DEFAULT_SETTINGS.sessionTimeoutMin,
  };

  fullCache = merged;
  lastLoad = Date.now();
  return merged;
}

export async function saveSetting(key: keyof AppSettings, value: unknown): Promise<void> {
  await Setting.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true },
  );
  cache.delete(key);
  fullCache = null;
  logger.info({ key }, 'Setting updated');
}

export async function saveSettings(updates: Partial<AppSettings>): Promise<void> {
  const ops = Object.entries(updates).map(([key, value]) =>
    Setting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true },
    ).exec(),
  );
  await Promise.all(ops);
  fullCache = null;
  logger.info({ keys: Object.keys(updates) }, 'Settings updated');
}

export async function seedDefaultSettings(): Promise<void> {
  const existing = await Setting.countDocuments();
  if (existing > 0) return;

  const entries = Object.entries(DEFAULT_SETTINGS);
  await Setting.insertMany(
    entries.map(([key, value]) => ({ key, value })),
  );
  logger.info('Default settings seeded');
}
