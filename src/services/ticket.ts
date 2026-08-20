import { Ticket, ITicket, User } from '../models';
import { generateTicketId } from '../utils/crypto';
import mongoose from 'mongoose';

export async function createTicket(input: {
  customerId: mongoose.Types.ObjectId;
  jid: string;
  phoneNumber: string;
  category: string;
  subject: string;
  description: string;
  priority?: ITicket['priority'];
  mediaUrls?: string[];
}): Promise<ITicket> {
  const ticket = await Ticket.create({
    ticketId: generateTicketId(),
    customerId: input.customerId,
    jid: input.jid,
    phoneNumber: input.phoneNumber,
    category: input.category,
    subject: input.subject,
    description: input.description,
    priority: input.priority || 'NORMAL',
    status: 'OPEN',
    mediaUrls: input.mediaUrls || [],
    replies: [
      {
        from: 'USER',
        message: input.description,
        at: new Date(),
      },
    ],
  });

  await User.findByIdAndUpdate(input.customerId, { supportStatus: 'OPEN' });
  return ticket;
}

export async function addReply(
  ticketId: string,
  from: 'USER' | 'ADMIN',
  message: string,
  authorId?: mongoose.Types.ObjectId,
): Promise<ITicket | null> {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) return null;

  ticket.replies.push({ from, message, authorId, at: new Date() });
  if (from === 'ADMIN') {
    ticket.status = 'WAITING_FOR_USER';
  } else {
    if (ticket.status === 'WAITING_FOR_USER') {
      ticket.status = 'IN_PROGRESS';
    }
  }
  await ticket.save();
  return ticket;
}

export async function updateStatus(
  ticketId: string,
  status: ITicket['status'],
  adminId?: mongoose.Types.ObjectId,
): Promise<ITicket | null> {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) return null;
  ticket.status = status;
  if (status === 'RESOLVED') ticket.resolvedAt = new Date();
  if (status === 'CLOSED') ticket.closedAt = new Date();
  await ticket.save();

  if (status === 'RESOLVED' || status === 'CLOSED') {
    await User.findByIdAndUpdate(ticket.customerId, { supportStatus: 'RESOLVED' });
  }
  return ticket;
}

export async function searchTickets(opts: {
  search?: string;
  status?: string;
  priority?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (opts.status) query.status = opts.status;
  if (opts.priority) query.priority = opts.priority;
  if (opts.search) {
    query.$or = [
      { ticketId: { $regex: opts.search, $options: 'i' } },
      { subject: { $regex: opts.search, $options: 'i' } },
      { phoneNumber: { $regex: opts.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .populate('customerId', 'customerId phoneNumber country')
      .populate('assignedTo', 'name email'),
    Ticket.countDocuments(query),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}
