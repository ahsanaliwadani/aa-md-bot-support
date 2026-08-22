import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string, fallback = ''): string {
  const v = process.env[key];
  if (!v) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}
function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? parseInt(v, 10) : fallback;
  return Number.isNaN(n) ? fallback : n;
}

export const config = {
  nodeEnv: required('NODE_ENV', 'production'),
  port: num('PORT', 3000),
  appUrl: required('APP_URL', 'http://localhost:3000'),
  dashboardUrl: required('DASHBOARD_URL', 'http://localhost:3000'),
  logLevel: required('LOG_LEVEL', 'info'),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/aamd_support'),
  mongoDbName: required('MONGODB_DB_NAME', 'aamd_support'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-session-change-me'),
  accessKeySecret: required('ACCESS_KEY_SECRET', 'Ahsan&ali12:@'),

  // Same secret used by ALL 4 bot VMs (confirmed) — this is the header
  // value scripts/generate-access-key.sh sends as X-Access-Key-Secret.
  accessKeyEndpointSecret: required('ACCESS_KEY_ENDPOINT_SECRET', ''),

  // The 4 real WhatsApp bot VMs. Each one is the actual source of truth
  // for key generation/verification — the dashboard must call these,
  // not write directly to its own MongoDB.
  accessKeyServers: [
    { id: 1 as const, name: 'Server 1', url: required('ACCESS_KEY_SERVER_1_URL', 'https://193.122.82.38.nip.io') },
    { id: 2 as const, name: 'Server 2', url: required('ACCESS_KEY_SERVER_2_URL', 'https://141-147-132-189.nip.io') },
    { id: 3 as const, name: 'Server 3', url: required('ACCESS_KEY_SERVER_3_URL', 'https://130-110-123-57.nip.io') },
    { id: 4 as const, name: 'Server 4', url: required('ACCESS_KEY_SERVER_4_URL', 'https://144-24-220-107.nip.io') },
  ],

  // Kept for any other code still reading the old flat list.
  accessKeyServerUrls: [
    required('ACCESS_KEY_SERVER_1_URL', 'https://193.122.82.38.nip.io'),
    required('ACCESS_KEY_SERVER_2_URL', 'https://141-147-132-189.nip.io'),
    required('ACCESS_KEY_SERVER_3_URL', 'https://130-110-123-57.nip.io'),
    required('ACCESS_KEY_SERVER_4_URL', 'https://144-24-220-107.nip.io'),
  ],

  cookieSecure: bool('COOKIE_SECURE', false),
  adminEmail: required('ADMIN_EMAIL', 'owner@aamdbot.com'),
  adminPassword: required('ADMIN_PASSWORD', 'ChangeMe!2026'),
  supportNumber: required('SUPPORT_NUMBER', '+923316041183'),
  botName: required('BOT_NAME', 'AA MD BOT'),
  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 60000),
  rateLimitMax: num('RATE_LIMIT_MAX', 300),
  sessionTimeoutMin: num('SESSION_TIMEOUT_MINUTES', 10),
  backupKeep: num('BACKUP_KEEP', 7),
  isProd: process.env.NODE_ENV === 'production',
};

export type AppConfig = typeof config;
