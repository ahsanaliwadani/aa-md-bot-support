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
  cookieSecure: bool('COOKIE_SECURE', false),

  adminEmail: required('ADMIN_EMAIL', 'owner@aamdbot.com'),
  adminPassword: required('ADMIN_PASSWORD', 'ChangeMe!2026'),

  supportNumber: required('SUPPORT_NUMBER', '+923316041183'),
  botName: required('BOT_NAME', 'AA MD BOT'),

  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 60000),
  rateLimitMax: num('RATE_LIMIT_MAX', 20),

  sessionTimeoutMin: num('SESSION_TIMEOUT_MINUTES', 10),
  backupKeep: num('BACKUP_KEEP', 7),

  isProd: process.env.NODE_ENV === 'production',
};

export type AppConfig = typeof config;
