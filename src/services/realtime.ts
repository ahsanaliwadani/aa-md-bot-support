import { EventEmitter } from 'events';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';

let io: SocketServer | null = null;
const bus = new EventEmitter();
bus.setMaxListeners(200);

export interface RealtimeEvent {
  event: string;
  payload: unknown;
}

export function attachRealtime(server: SocketServer): void {
  io = server;
}

export function emitRealtime(event: string, payload: unknown): void {
  if (io) io.emit(event, payload);
  bus.emit('event', { event, payload } satisfies RealtimeEvent);
  logger.debug({ event }, 'Realtime event emitted');
}

export function onRealtimeEvent(listener: (event: RealtimeEvent) => void): () => void {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}
