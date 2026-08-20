import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const level = config.logLevel || 'info';

export const logger = pino({
  level,
  transport: config.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
});

export function redact(value: string | undefined, keep = 4): string {
  if (!value) return '';
  if (value.length <= keep) return '****';
  return value.slice(0, keep) + '*'.repeat(Math.min(value.length - keep, 12));
}
