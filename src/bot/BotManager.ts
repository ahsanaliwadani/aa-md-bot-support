import makeWASocket, {
  WASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import P from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { handleMessage } from '../handlers/messageHandler';
import { SystemEvent } from '../models';

const SESSION_DIR = path.resolve(process.cwd(), 'sessions');
const SESSION_BACKUP_DIR = path.resolve(process.cwd(), 'session-backups');

export class BotManager {
  private sock: WASocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnect = 10;
  private qrCallback: ((qr: string) => void) | null = null;
  private pairingCodeCallback: ((code: string) => void) | null = null;
  private statusCallback: (() => void) | null = null;
  private latestQr: string | null = null;
  private latestPairingCode: string | null = null;
  private lastConnectionUpdateAt: Date | null = null;
  private starting: Promise<void> | null = null;
  private messageQueue: Promise<void> = Promise.resolve();
  private backupTimer: NodeJS.Timeout | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus(): { connected: boolean; qr: string | null; pairingCode: string | null; updatedAt: Date | null } {
    return {
      connected: this.connected,
      qr: this.latestQr,
      pairingCode: this.latestPairingCode,
      updatedAt: this.lastConnectionUpdateAt,
    };
  }

  onQR(callback: (qr: string) => void): void {
    this.qrCallback = callback;
  }

  onPairingCode(callback: (code: string) => void): void {
    this.pairingCodeCallback = callback;
  }

  onStatusChange(callback: () => void): void {
    this.statusCallback = callback;
  }

  private emitStatusChange(): void {
    if (this.statusCallback) this.statusCallback();
  }

  private scheduleSessionBackup(): void {
    if (this.backupTimer) clearTimeout(this.backupTimer);
    this.backupTimer = setTimeout(() => {
      this.backupSession().catch((err) => logger.warn({ err }, 'Session backup failed'));
    }, 1000);
  }

  private async backupSession(): Promise<void> {
    await fs.mkdir(SESSION_BACKUP_DIR, { recursive: true });
    const backupPath = path.join(SESSION_BACKUP_DIR, `session-${Date.now()}`);
    await fs.cp(SESSION_DIR, backupPath, { recursive: true, force: true });

    const backups = await fs.readdir(SESSION_BACKUP_DIR);
    const sessionBackups = backups.filter((name) => name.startsWith('session-')).sort().reverse();
    await Promise.all(
      sessionBackups.slice(5).map((name) => fs.rm(path.join(SESSION_BACKUP_DIR, name), { recursive: true, force: true })),
    );
  }

  private enqueueMessage(task: () => Promise<void>): void {
    this.messageQueue = this.messageQueue
      .then(task)
      .catch((err) => logger.error({ err }, 'Queued WhatsApp message handling failed'));
  }

  async start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = this.createSocket().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async createSocket(): Promise<void> {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ version, isLatest }, 'Baileys version');

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('AA MD Support'),
      logger: P({ level: 'warn' }),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });

    this.sock = sock;

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      this.scheduleSessionBackup();
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.latestQr = qr;
        this.lastConnectionUpdateAt = new Date();
        logger.info('QR code received — scan to connect');
        qrcode.generate(qr, { small: true }, (code) => {
          console.log(code);
        });
        if (this.qrCallback) this.qrCallback(qr);
        this.emitStatusChange();
      }

      if (connection === 'open') {
        this.connected = true;
        this.latestQr = null;
        this.latestPairingCode = null;
        this.lastConnectionUpdateAt = new Date();
        this.reconnectAttempts = 0;
        logger.info('WhatsApp connected');
        this.emitStatusChange();

        await SystemEvent.create({
          type: 'BOT_CONNECTED',
          severity: 'INFO',
          message: 'WhatsApp Support Bot connected',
        });
      }

      if (connection === 'close') {
        this.connected = false;
        this.lastConnectionUpdateAt = new Date();
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })
          ?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn({ statusCode, shouldReconnect }, 'WhatsApp disconnected');

        this.emitStatusChange();

        await SystemEvent.create({
          type: 'BOT_DISCONNECTED',
          severity: 'WARN',
          message: `WhatsApp disconnected (code: ${statusCode})`,
        });

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnect) {
          this.reconnectAttempts++;
          const delay = Math.min(2000 * 2 ** this.reconnectAttempts, 30000);
          logger.info({ attempt: this.reconnectAttempts, delay }, 'Reconnecting...');
          setTimeout(() => this.start(), delay);
        } else if (!shouldReconnect) {
          logger.error('Logged out — need to re-scan QR');
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message) continue;
        this.enqueueMessage(async () => {
          try {
            await handleMessage(sock, msg);
          } catch (err) {
            logger.error({ err, key: msg.key }, 'Message handling error');
          }
        });
      }
    });

    (sock.ev as unknown as { on: (event: string, cb: (err: unknown) => void) => void }).on('error', (err) => {
      logger.error({ err }, 'Baileys socket error');
    });
  }

  async sendText(jid: string, text: string): Promise<void> {
    if (!this.sock || !this.connected) {
      logger.warn({ jid }, 'Cannot send — bot not connected');
      return;
    }
    try {
      await this.sock.sendMessage(jid, { text });
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send message');
    }
  }

  async requestPairingCode(phone: string): Promise<string | null> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!this.sock) await this.start();
    if (!this.sock) return null;
    try {
      const code = await this.sock.requestPairingCode(cleanPhone);
      if (code) {
        this.latestPairingCode = code;
        this.lastConnectionUpdateAt = new Date();
      }
      if (code && this.pairingCodeCallback) this.pairingCodeCallback(code);
      if (code) this.emitStatusChange();
      return code;
    } catch (err) {
      logger.error({ err }, 'Failed to request pairing code');
      return null;
    }
  }

  async stop(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(new Error('Graceful shutdown'));
      } catch {
        // ignore
      }
      if (this.backupTimer) clearTimeout(this.backupTimer);
      await this.backupSession().catch((err) => logger.warn({ err }, 'Final session backup failed'));
      this.sock = null;
      this.connected = false;
      this.latestQr = null;
      this.latestPairingCode = null;
      this.lastConnectionUpdateAt = new Date();
      this.emitStatusChange();
    }
  }
}

export const botManager = new BotManager();
