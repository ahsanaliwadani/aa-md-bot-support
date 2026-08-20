import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  jid: string;
  direction: 'INCOMING' | 'OUTGOING';
  body: string;
  messageType: string;
  ticketId?: string;
  mediaUrl?: string;
  at: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    jid: { type: String, required: true, index: true },
    direction: { type: String, enum: ['INCOMING', 'OUTGOING'], required: true },
    body: { type: String, default: '' },
    messageType: { type: String, default: 'text' },
    ticketId: { type: String },
    mediaUrl: { type: String },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
