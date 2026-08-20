import { Payment, IPayment, User } from '../models';
import { generateRequestId } from '../utils/crypto';
import * as accessKeyService from './accessKey';
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

  payment.status = 'APPROVED';
  payment.reviewedAt = new Date();
  payment.reviewedBy = adminId;
  if (notes) payment.notes = notes;
  await payment.save();

  const keyResult = await accessKeyService.generateKey(adminId);
  const key = await accessKeyService.assignKey(
    keyResult.keyId,
    (await User.findById(payment.customerId))?.phoneNumber || '',
    payment.customerId,
    adminId,
  );
  if (key) {
    payment.accessKeyId = key._id;
    await payment.save();
  }

  await User.findByIdAndUpdate(payment.customerId, {
    paymentStatus: 'APPROVED',
  });

  return { payment, keyResult };
}

export async function rejectPayment(
  paymentRequestId: string,
  adminId: mongoose.Types.ObjectId,
  notes?: string,
): Promise<IPayment | null> {
  const payment = await Payment.findOne({ paymentRequestId });
  if (!payment) return null;
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
