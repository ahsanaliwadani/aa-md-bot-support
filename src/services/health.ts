import os from 'os';
import { isDBConnected } from './database';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  bot: 'connected' | 'disconnected';
  database: 'connected' | 'disconnected';
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  cpu: { loadAverage: number[] };
  disk?: { available: number; total: number };
  timestamp: string;
}

export async function getHealthStatus(botConnected: boolean): Promise<HealthStatus> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    status: botConnected && isDBConnected() ? 'ok' : 'degraded',
    bot: botConnected ? 'connected' : 'disconnected',
    database: isDBConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: Math.round((usedMem / totalMem) * 100),
    },
    cpu: { loadAverage: os.loadavg() },
    timestamp: new Date().toISOString(),
  };
}
