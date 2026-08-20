import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

let connected = false;

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    connected = true;
    logger.info({ db: config.mongoDbName }, 'MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    connected = false;
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    connected = false;
    logger.error({ err }, 'MongoDB connection error');
  });

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      await mongoose.connect(config.mongoUri, {
        dbName: config.mongoDbName,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 15000,
      });
      return;
    } catch (err) {
      logger.error({ err, attempt }, 'MongoDB connect attempt failed');
      if (attempt >= maxRetries) throw err;
      const delay = Math.min(2000 * 2 ** attempt, 30000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export function isDBConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}

export async function closeDB(): Promise<void> {
  await mongoose.connection.close();
}
