import { AccessKey, IAccessKey, User, Payment } from '../models';
import { generateAccessKey, hashKey, maskKey, isValidKeyFormat } from '../utils/crypto';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface GenerateKeyResult {
  keyId: string;
  plainKey: string;
  displayId: string;
}

export async function generateKey(
  createdBy: mongoose.Types.ObjectId,
): Promise<GenerateKeyResult> {
  let plain = generateAccessKey();
  let hash = hashKey(plain);

  const exists = await AccessKey.findOne({ keyHash: hash });
  if (exists) {
    plain = generateAccessKey();
    hash = hashKey(plain);
  }

  const keyId = `AK-${Date.now().toString(36).toUpperCase()}`;
  const displayId = maskKey(plain);

  const key = await AccessKey.create({
    keyId,
    keyHash: hash,
    displayId,
    status: 'PENDING',
    createdBy,
    history: [{ action: 'KEY_CREATED', at: new Date(), adminId: createdBy }],
  });

  logger.info({ keyId }, 'Access key generated');
  return { keyId: key.keyId, plainKey: plain, displayId };
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

  return key;
}

export async function activateKey(
  keyId: string,
  adminId: mongoose.Types.ObjectId,
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

  return key;
}

export async function suspendKey(
  keyId: string,
  reason: string,
  adminId: mongoose.Types.ObjectId,
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
  return key;
}

export async function reactivateKey(
  keyId: string,
  adminId: mongoose.Types.ObjectId,
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
  return key;
}

export async function revokeKey(
  keyId: string,
  reason: string,
  adminId: mongoose.Types.ObjectId,
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
}) {
  const query: Record<string, unknown> = {};
  if (opts.status) query.status = opts.status;
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
