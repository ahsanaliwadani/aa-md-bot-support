import { ConversationState, ConversationStateName } from '../models';
import { loadSettings } from './settings';

interface StateDoc {
  state: ConversationStateName;
  data: Record<string, unknown>;
}

export async function getState(jid: string): Promise<StateDoc> {
  const doc = await ConversationState.findOne({ jid });
  if (!doc) return { state: 'IDLE', data: {} };
  return { state: doc.state as ConversationStateName, data: doc.data || {} };
}

export async function setState(
  jid: string,
  state: ConversationStateName,
  data?: Record<string, unknown>,
): Promise<void> {
  await ConversationState.findOneAndUpdate(
    { jid },
    {
      state,
      data: data || {},
      updatedAt: new Date(),
    },
    { upsert: true },
  );
}

export async function updateData(
  jid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const doc = await ConversationState.findOne({ jid });
  if (!doc) return;
  doc.data = { ...doc.data, ...patch };
  doc.updatedAt = new Date();
  await doc.save();
}

export async function resetState(jid: string): Promise<void> {
  await ConversationState.findOneAndUpdate(
    { jid },
    { state: 'IDLE', data: {}, updatedAt: new Date() },
    { upsert: true },
  );
}

export async function isStateStale(jid: string): Promise<boolean> {
  const settings = await loadSettings();
  const doc = await ConversationState.findOne({ jid });
  if (!doc) return false;
  const timeoutMs = settings.sessionTimeoutMin * 60 * 1000;
  return Date.now() - doc.updatedAt.getTime() > timeoutMs;
}
