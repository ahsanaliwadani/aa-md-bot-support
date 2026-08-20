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
import { logger } from '../utils/logger';
import { handleMessage } from '../handlers/messageHandler';
import { SystemEvent } from '../models';

const SESSION_DIR = path.resolve(process.cwd(), 'sessions');

export class BotManager {
  private sock: WASocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnect = 10;
  private qrCallback: ((qr: string) => void) | null = null;
  private pairingCodeCallback: ((code: string) => void) | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  onQR(callback: (qr: string) => void): void {
    this.qrCallback = callback;
  }

  onPairingCode(callback: (code: string) => void): void {
    this.pairingCodeCallback = callback;
  }

  async start(): Promise<void> {
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

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('QR code received — scan to connect');
        qrcode.generate(qr, { small: true }, (code) => {
          console.log(code);
        });
        if (this.qrCallback) this.qrCallback(qr);
      }

      if (connection === 'open') {
        this.connected = true;
        this.reconnectAttempts = 0;
        logger.info('WhatsApp connected');
        await SystemEvent.create({
          type: 'BOT_CONNECTED',
          severity: 'INFO',
          message: 'WhatsApp Support Bot connected',
        });
      }

      if (connection === 'close') {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })
          ?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn({ statusCode, shouldReconnect }, 'WhatsApp disconnected');

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
        if (!msg.message || msg.key.fromMe) continue;
        try {
          await handleMessage(sock, msg);
        } catch (err) {
          logger.error({ err, key: msg.key }, 'Message handling error');
        }
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
    if (!this.sock) return null;
    try {
      const code = await this.sock.requestPairingCode(phone);
      if (code && this.pairingCodeCallback) this.pairingCodeCallback(code);
      return code;
    } catch (err) {
      logger.error({ err }, 'Failed to request pairing code');
      return null;
    }
  }

  async stop(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {
        // ignore
      }
      this.sock = null;
      this.connected = false;
    }
  }
}

export const botManager = new BotManager();
