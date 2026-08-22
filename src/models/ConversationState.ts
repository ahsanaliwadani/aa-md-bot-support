import mongoose, { Schema, Document } from 'mongoose';

export interface IConversationState extends Document {
  jid: string;
  state: string;
  data: Record<string, unknown>;
  updatedAt: Date;
}

const ConversationStateSchema = new Schema<IConversationState>(
  {
    jid: { type: String, required: true, unique: true, index: true },
    state: { type: String, default: 'IDLE' },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Auto-expire stale states
ConversationStateSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 },
);

export const ConversationState =
  mongoose.model<IConversationState>('ConversationState', ConversationStateSchema);

export type ConversationStateName =
  | 'IDLE'
  | 'WAITING_FOR_NUMBER'
  | 'WAITING_FOR_CONFIRMATION'
  | 'WAITING_FOR_ACCESS_KEY'
  | 'WAITING_FOR_ISSUE_CATEGORY'
  | 'WAITING_FOR_ISSUE_DESC'
  | 'WAITING_FOR_TICKET_DETAILS'
  | 'WAITING_FOR_TICKET_REPLY'
  | 'WAITING_FOR_BUG_DESC'
  | 'WAITING_FOR_BOT_FEATURE'
  | 'WAITING_FOR_BUG_ERROR'
  | 'WAITING_FOR_CONNECTION_ISSUE'
  | 'WAITING_FOR_CONTACT_CONFIRM'
  | 'WAITING_FOR_AI_ESCALATION';
