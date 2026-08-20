import mongoose, { Schema, Document } from 'mongoose';

export interface ITicketReply {
  from: 'USER' | 'ADMIN';
  authorId?: mongoose.Types.ObjectId;
  message: string;
  mediaUrl?: string;
  at: Date;
}

export interface ITicket extends Document {
  ticketId: string;
  customerId: mongoose.Types.ObjectId;
  jid: string;
  phoneNumber: string;
  category: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'WAITING_FOR_USER' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedTo?: mongoose.Types.ObjectId;
  replies: ITicketReply[];
  mediaUrls: string[];
  internalNotes: string;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jid: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    category: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'WAITING_FOR_USER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Admin' },
    replies: [
      {
        from: { type: String, enum: ['USER', 'ADMIN'], required: true },
        authorId: { type: Schema.Types.ObjectId, ref: 'Admin' },
        message: { type: String, required: true },
        mediaUrl: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    mediaUrls: { type: [String], default: [] },
    internalNotes: { type: String, default: '' },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
