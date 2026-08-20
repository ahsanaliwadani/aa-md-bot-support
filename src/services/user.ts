import { User, IUser } from '../models';
import { jidToPhone, countryFromPhone, normalizePhone } from '../utils/phone';
import mongoose from 'mongoose';

export async function findOrCreateUser(jid: string): Promise<IUser> {
  const existing = await User.findOne({ jid });
  if (existing) return existing;

  const phone = jidToPhone(jid);
  const country = countryFromPhone(phone);
  const customerId = `CUST-${Date.now().toString(36).toUpperCase()}`;

  return User.create({
    customerId,
    jid,
    phoneNumber: phone,
    country,
    firstContact: new Date(),
    lastContact: new Date(),
  });
}

export async function updateUserContact(jid: string): Promise<void> {
  await User.updateOne({ jid }, { lastContact: new Date() });
}

export async function searchUsers(opts: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (opts.status) {
    if (opts.status === 'blocked') query.blocked = true;
    else query.accessKeyStatus = opts.status;
  }
  if (opts.search) {
    query.$or = [
      { phoneNumber: { $regex: opts.search, $options: 'i' } },
      { customerId: { $regex: opts.search, $options: 'i' } },
      { name: { $regex: opts.search, $options: 'i' } },
      { country: { $regex: opts.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(query)
      .sort({ lastContact: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit),
    User.countDocuments(query),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}

export async function blockUser(
  jid: string,
  reason: string,
): Promise<IUser | null> {
  const user = await User.findOneAndUpdate(
    { jid },
    { blocked: true, blockedReason: reason },
    { new: true },
  );
  return user;
}

export async function unblockUser(jid: string): Promise<IUser | null> {
  const user = await User.findOneAndUpdate(
    { jid },
    { blocked: false, blockedReason: undefined },
    { new: true },
  );
  return user;
}

export async function getUserById(id: string): Promise<IUser | null> {
  return User.findById(id);
}

export async function updateNotes(
  id: string,
  notes: string,
): Promise<IUser | null> {
  return User.findByIdAndUpdate(id, { notes }, { new: true });
}

export async function addTag(id: string, tag: string): Promise<IUser | null> {
  return User.findByIdAndUpdate(
    id,
    { $addToSet: { tags: tag } },
    { new: true },
  );
}

export async function removeTag(id: string, tag: string): Promise<IUser | null> {
  return User.findByIdAndUpdate(
    id,
    { $pull: { tags: tag } },
    { new: true },
  );
}
