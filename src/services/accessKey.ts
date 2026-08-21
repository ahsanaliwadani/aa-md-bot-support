import { AccessKey, IAccessKey, User } from '../models';
import { generateAccessKey, hashKey, maskKey, isValidKeyFormat } from '../utils/crypto';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { emitRealtime } from './realtime';

export const ACCESS_KEY_SERVERS = [
  { id: 1, name: 'Server 1', url: 'https://193.122.82.38.nip.io' },
  { id: 2, name: 'Server 2', url: 'https://141-147-132-189.nip.io' },
  { id: 3, name: 'Server 3', url: 'https://130-110-123-57.nip.io' },
  { id: 4, name: 'Server 4', url: 'https://144-24-220-107.nip.io' },
] as const;

export type AccessKeyServerId = (typeof ACCESS_KEY_SERVERS)[number]['id'];

export interface GenerateKeyInput {
  createdBy?: mongoose.Types.ObjectId;
  phone?: string;
  connectionId?: string;
  serverId?: AccessKeyServerId;
  activate?: boolean;
}

export interface GenerateKeyResult {
  id: string;
  keyId: string;
  plainKey: string;
  displayId: string;
  server: (typeof ACCESS_KEY_SERVERS)[number];
  phone?: string;
  expiresAt?: Date;
  connectionId: string;
  status: IAccessKey['status'];
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/[^0-9]/g, '');
}

export function getAccessKeyServer(serverId?: number) {
  return ACCESS_KEY_SERVERS.find((server) => server.id === serverId) || ACCESS_KEY_SERVERS[0];
}

export async function generateKey(input: mongoose.Types.ObjectId | GenerateKeyInput): Promise<GenerateKeyResult> {
  const opts: GenerateKeyInput = input instanceof mongoose.Types.ObjectId ? { createdBy: input } : input;
  const server = getAccessKeyServer(opts.serverId);
  let plain = generateAccessKey();
  let hash = hashKey(plain);

  const exists = await AccessKey.findOne({ keyHash: hash });
  if (exists) {
    plain = generateAccessKey();
    hash = hashKey(plain);
  }

  // Date.now alone collides when two dashboard/API requests arrive in the same millisecond.
  const keyId = `AK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const displayId = maskKey(plain);
  const phone = normalizePhone(opts.phone);
  // Access keys are lifetime keys. Expiry is retained on the model only for legacy records.
  const expiresAt = undefined;
  const status: IAccessKey['status'] = opts.activate || phone ? 'ACTIVE' : 'PENDING';

  const key = await AccessKey.create({
    keyId,
    keyHash: hash,
    displayId,
    assignedNumber: phone,
    status,
    createdBy: opts.createdBy,
    activatedAt: status === 'ACTIVE' ? new Date() : undefined,
    expiresAt,
    serverId: server.id,
    serverName: server.name,
    serverUrl: server.url,
    connectionId: opts.connectionId || 'default',
    history: [
      {
        action: 'KEY_CREATED',
        at: new Date(),
        adminId: opts.createdBy,
        detail: `Generated for ${server.name}${phone ? ` and phone ${phone}` : ''}`,
      },
    ],
  });

  logger.info({ keyId, serverId: server.id, phone }, 'Access key generated');
  emitRealtime('access-key:new', key.toObject());
  return {
    id: key._id.toString(),
    keyId: key.keyId,
    plainKey: plain,
    displayId,
    server,
    phone,
    expiresAt,
    connectionId: key.connectionId,
    status: key.status,
  };
}

export async function assignKey(
  keyId: string,
  number: string,
  customerId: mongoose.Types.ObjectId,
  adminId: mongoose.Types.ObjectId,
): Promise<IAccessKey | null> {
  const key = await AccessKey.findOne({ keyId });
  if (!key) return null;
  if (key.status !== 'PENDING') return null;

  key.assignedNumber = number;
  key.customerId = customerId;
  key.history.push({
    action: 'KEY_ASSIGNED',
    at: new Date(),
    adminId,
    detail: `Assigned to ${number}`,
  });
  await key.save();

  await User.findByIdAndUpdate(customerId, {
    accessKeyId: key._id,
    accessKeyStatus: 'PENDING',
  });

  emitRealtime('access-key:updated', key.toObject());

  return key;
}

export async function activateKey(
  keyId: string,
  adminId?: mongoose.Types.ObjectId,
): Promise<IAccessKey | null> {
  const key = await AccessKey.findOne({ keyId });
  if (!key) return null;
  if (key.status === 'REVOKED' || key.status === 'EXPIRED') return null;

  key.status = 'ACTIVE';
  key.activatedAt = new Date();
  key.history.push({
    action: 'KEY_ACTIVATED',
    at: new Date(),
    adminId,
  });
  await key.save();

  if (key.customerId) {
    await User.findByIdAndUpdate(key.customerId, { accessKeyStatus: 'ACTIVE' });
  }

  emitRealtime('access-key:updated', key.toObject());

  return key;
}

export async function suspendKey(
  keyId: string,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
): Promise<IAccessKey | null> {
  const key = await AccessKey.findOne({ keyId });
  if (!key) return null;
  key.status = 'SUSPENDED';
  key.history.push({
    action: 'KEY_SUSPENDED',
    at: new Date(),
    adminId,
    detail: reason,
  });
  await key.save();
  if (key.customerId) {
    await User.findByIdAndUpdate(key.customerId, { accessKeyStatus: 'SUSPENDED' });
  }
  emitRealtime('access-key:updated', key.toObject());
  return key;
}

export async function reactivateKey(
  keyId: string,
  adminId?: mongoose.Types.ObjectId,
): Promise<IAccessKey | null> {
  const key = await AccessKey.findOne({ keyId });
  if (!key) return null;
  if (key.status !== 'SUSPENDED') return null;
  key.status = 'ACTIVE';
  key.history.push({ action: 'KEY_REACTIVATED', at: new Date(), adminId });
  await key.save();
  if (key.customerId) {
    await User.findByIdAndUpdate(key.customerId, { accessKeyStatus: 'ACTIVE' });
  }
  emitRealtime('access-key:updated', key.toObject());
  return key;
}

export async function revokeKey(
  keyId: string,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
): Promise<IAccessKey | null> {
  const key = await AccessKey.findOne({ keyId });
  if (!key) return null;
  key.status = 'REVOKED';
  key.revokedAt = new Date();
  key.revokedReason = reason;
  key.history.push({
    action: 'KEY_REVOKED',
    at: new Date(),
    adminId,
    detail: reason,
  });
  await key.save();
  if (key.customerId) {
    await User.findByIdAndUpdate(key.customerId, { accessKeyStatus: 'REVOKED' });
  }
  emitRealtime('access-key:revoked', { keyId: key.keyId });
  return key;
}

/** Permanently delete a key requested through the secured integration API. */
export async function deleteKey(id: string): Promise<IAccessKey | null> {
  const key = await AccessKey.findOne({
    $or: [
      { keyId: id },
      ...(mongoose.isObjectIdOrHexString(id) ? [{ _id: id }] : []),
    ],
  });
  if (!key) return null;

  await AccessKey.deleteOne({ _id: key._id });
  if (key.customerId) {
    await User.findByIdAndUpdate(key.customerId, {
      $unset: { accessKeyId: 1 },
      accessKeyStatus: 'NONE',
    });
  }
  emitRealtime('access-key:deleted', { keyId: key.keyId, id: key._id.toString() });
  logger.info({ keyId: key.keyId }, 'Access key deleted');
  return key;
}

export interface VerifyResult {
  valid: boolean;
  status: 'VALID' | 'INVALID' | 'ALREADY_ASSIGNED' | 'NOT_FOUND';
  key?: IAccessKey;
}

export async function verifyKeyForUser(
  plainKey: string,
  userJid: string,
): Promise<VerifyResult> {
  const trimmed = plainKey.trim().toUpperCase();
  if (!isValidKeyFormat(trimmed)) return { valid: false, status: 'INVALID' };

  const hash = hashKey(trimmed);
  const key = await AccessKey.findOne({ keyHash: hash });

  if (!key) return { valid: false, status: 'NOT_FOUND' };
  if (key.status === 'REVOKED') return { valid: false, status: 'INVALID' };
  if (key.status === 'EXPIRED') return { valid: false, status: 'INVALID' };

  const user = await User.findOne({ jid: userJid });
  if (!user) return { valid: false, status: 'INVALID' };

  if (key.assignedNumber && key.customerId) {
    if (key.customerId.toString() !== user._id.toString()) {
      return { valid: false, status: 'ALREADY_ASSIGNED' };
    }
  }

  return { valid: true, status: 'VALID', key };
}

export async function searchKeys(opts: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
  includeRevoked?: boolean;
}) {
  const query: Record<string, unknown> = {};
  if (opts.status) query.status = opts.status;
  else if (!opts.includeRevoked) query.status = { $ne: 'REVOKED' };
  if (opts.search) {
    query.$or = [
      { keyId: { $regex: opts.search, $options: 'i' } },
      { displayId: { $regex: opts.search, $options: 'i' } },
      { assignedNumber: { $regex: opts.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    AccessKey.find(query)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .populate('customerId', 'customerId phoneNumber country')
      .populate('createdBy', 'name email'),
    AccessKey.countDocuments(query),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}
