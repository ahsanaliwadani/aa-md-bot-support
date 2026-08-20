import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemEvent extends Document {
  type: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  detail?: string;
  at: Date;
}

const SystemEventSchema = new Schema<ISystemEvent>(
  {
    type: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ['INFO', 'WARN', 'ERROR'],
      default: 'INFO',
    },
    message: { type: String, required: true },
    detail: { type: String },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const SystemEvent = mongoose.model<ISystemEvent>('SystemEvent', SystemEventSchema);
