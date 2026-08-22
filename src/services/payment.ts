import { Payment, IPayment, User, AccessKey } from '../models';
import { generateRequestId } from '../utils/crypto';
import { hashKey, maskKey } from '../utils/crypto';
import { getRemoteServer, remoteGenerateKey } from './remoteBotClient';
import mongoose from 'mongoose';

export async function createPaymentRequest(input: {
  customerId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  country: string;
  method?: string;
}): Promise<IPayment> {
  const payment = await Payment.create({
    paymentRequestId: generateRequestId(),
    customerId: input.customerId,
    amount: input.amount,
    currency: input.currency,
    country: input.country,
    method: input.method || 'Manual',
    status: 'PENDING',
  });

  await User.findByIdAndUpdate(input.customerId, { paymentStatus: 'PENDING' });
  return payment;
}

export async function approvePayment(
  paymentRequestId: string,
  adminId: mongoose.Types.ObjectId,
  notes?: string,
): Promise<{ payment: IPayment | null; keyResult?: { plainKey: string; keyId: string } }> {
  const payment = await Payment.findOne({ paymentRequestId });
  if (!payment) return { payment: null };
  if (payment.status !== 'PENDING' && payment.status !== 'UNDER_REVIEW') {
    throw new Error(`Payment request is already ${payment.status}`);
  }

  const customer = await User.findById(payment.customerId);
  if (!customer) throw new Error('Payment customer not found');

  // Use the same remote bot API as the Access Keys dashboard page. This makes
  // the key valid on the selected bot server, not merely a local database row.
  const server = getRemoteServer();
  const remote = await remoteGenerateKey(server, { phone: customer.phoneNumber, createdBy: `payment:${adminId}` });
  if (!remote.accessKey || !remote.record) throw new Error('Remote server did not return an access key');
  const keyId = `AK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const key = await AccessKey.create({
    keyId,
    keyHash: hashKey(remote.accessKey),
    displayId: maskKey(remote.accessKey),
    assignedNumber: customer.phoneNumber,
    customerId: customer._id,
    status: ((remote.record.status || 'ACTIVE').toUpperCase() === 'PENDING' ? 'PENDING' : 'ACTIVE'),
    createdBy: adminId,
    activatedAt: remote.record.activatedAt ? new Date(remote.record.activatedAt) : new Date(),
    expiresAt: remote.record.expiresAt ? new Date(remote.record.expiresAt) : undefined,
    serverId: server.id,
    serverName: server.name,
    serverUrl: server.url,
    connectionId: remote.record.connectionId || 'default',
    history: [{ action: 'KEY_CREATED', at: new Date(), adminId, detail: `Approved payment; generated on ${server.name} via remote bot API` }],
  });
  payment.status = 'APPROVED';
  payment.reviewedAt = new Date();
  payment.reviewedBy = adminId;
  if (notes) payment.notes = notes;
  payment.accessKeyId = key._id;
  await payment.save();

  await User.findByIdAndUpdate(payment.customerId, {
    paymentStatus: 'APPROVED',
    accessKeyId: key._id,
    accessKeyStatus: key.status,
  });

  return { payment, keyResult: { plainKey: remote.accessKey, keyId: key.keyId } };
}

export async function rejectPayment(
  paymentRequestId: string,
  adminId: mongoose.Types.ObjectId,
  notes?: string,
): Promise<IPayment | null> {
  const payment = await Payment.findOne({ paymentRequestId });
  if (!payment) return null;
  // Keep rejected requests in the audit trail and reject only an actionable request.
  // This prevents a second click from overwriting its original review details.
  if (payment.status !== 'PENDING' && payment.status !== 'UNDER_REVIEW') return payment;
  payment.status = 'REJECTED';
  payment.reviewedAt = new Date();
  payment.reviewedBy = adminId;
  if (notes) payment.notes = notes;
  await payment.save();

  await User.findByIdAndUpdate(payment.customerId, { paymentStatus: 'REJECTED' });
  return payment;
}

export async function searchPayments(opts: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (opts.status) query.status = opts.status;
  if (opts.search) {
    query.$or = [
      { paymentRequestId: { $regex: opts.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Payment.find(query)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .populate('customerId', 'customerId phoneNumber country name')
      .populate('reviewedBy', 'name email')
      .populate('accessKeyId', 'keyId displayId status'),
    Payment.countDocuments(query),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}
