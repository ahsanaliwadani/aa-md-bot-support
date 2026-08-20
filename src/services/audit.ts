import { AuditLog } from '../models';
import mongoose from 'mongoose';

export async function logAction(input: {
  adminId: mongoose.Types.ObjectId;
  adminEmail: string;
  action: string;
  target: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  result?: 'SUCCESS' | 'FAILURE';
}): Promise<void> {
  await AuditLog.create({
    adminId: input.adminId,
    adminEmail: input.adminEmail,
    action: input.action,
    target: input.target,
    targetId: input.targetId,
    detail: input.detail,
    ip: input.ip,
    result: input.result || 'SUCCESS',
  });
}

export async function searchAuditLogs(opts: {
  search?: string;
  action?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (opts.action) query.action = opts.action;
  if (opts.search) {
    query.$or = [
      { action: { $regex: opts.search, $options: 'i' } },
      { adminEmail: { $regex: opts.search, $options: 'i' } },
      { target: { $regex: opts.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ at: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit),
    AuditLog.countDocuments(query),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}
