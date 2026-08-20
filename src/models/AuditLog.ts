import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  adminEmail: string;
  action: string;
  target: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  result: 'SUCCESS' | 'FAILURE';
  at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true, index: true },
    target: { type: String, required: true },
    targetId: { type: String },
    detail: { type: String },
    ip: { type: String },
    result: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
