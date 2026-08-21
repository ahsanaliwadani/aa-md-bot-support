import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { connectDB, isDBConnected } from './services/database';
import { ensureOwnerAdmin } from './services/auth';
import { seedDefaultSettings } from './services/settings';
import { seedDefaultFAQs } from './services/faq';
import { botManager } from './bot/BotManager';
import { logger } from './utils/logger';
import { apiLimiter } from './middleware/rateLimit';
import { sanitizeBody } from './middleware/sanitize';
import { notFound, errorHandler } from './middleware/error';
import apiRoutes from './routes';
import healthRoutes from './routes/health';
import { Server as SocketServer } from 'socket.io';
import { SystemEvent } from './models';
import { attachRealtime, emitRealtime } from './services/realtime';

async function bootstrap(): Promise<void> {
  logger.info({ env: config.nodeEnv, port: config.port }, 'Starting AA MD Support Bot...');

  // Database
  await connectDB();

  // Seed
  await seedDefaultSettings();
  await seedDefaultFAQs();
  await ensureOwnerAdmin();

  // Express
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());

  const allowedOrigins = [config.dashboardUrl, config.appUrl, 'http://localhost:5173', 'http://localhost:3000'];
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(config.sessionSecret));
  app.use(sanitizeBody);

  // Health endpoint (public)
  app.use('/health', healthRoutes);

  // API
  app.use('/api', apiLimiter, apiRoutes);

  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // Dashboard static files (production)
  const dashboardDist = path.resolve(process.cwd(), 'dashboard', 'dist');
  app.use(express.static(dashboardDist));
  app.get(/^(?!\/api|\/health).*/, (_req, res) => {
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  // HTTP + WebSocket
  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  attachRealtime(io);

  io.on('connection', (socket) => {
    logger.info('Dashboard client connected via WebSocket');
    socket.on('disconnect', () => logger.info('Dashboard client disconnected'));
  });

  // Broadcast system events
  SystemEvent.watch().on('change', (change) => {
    if (change.operationType === 'insert') {
      emitRealtime('system:event', change.fullDocument);
    }
  });

  // Start WhatsApp bot
  botManager.onQR((qr) => {
    logger.info('QR code available for scanning');
    emitRealtime('whatsapp:status', botManager.getConnectionStatus());
  });

  botManager.onPairingCode(() => {
    emitRealtime('whatsapp:status', botManager.getConnectionStatus());
  });

  botManager.onStatusChange(() => {
    emitRealtime('whatsapp:status', botManager.getConnectionStatus());
  });

  await botManager.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await botManager.stop();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
  });

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server started');
    logger.info({ health: `http://localhost:${config.port}/health` }, 'Health check');
    if (botManager.isConnected()) {
      logger.info('WhatsApp: CONNECTED');
    } else {
      logger.info('WhatsApp: WAITING FOR PAIRING — scan QR code or use pairing code');
    }
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start application');
  process.exit(1);
});
