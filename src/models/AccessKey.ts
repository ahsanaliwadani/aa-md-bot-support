import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessKey extends Document {
  keyId: string;
  keyHash: string;
  displayId: string;
  assignedNumber?: string;
  customerId?: mongoose.Types.ObjectId;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  createdBy: mongoose.Types.ObjectId;
  activatedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  notes: string;
  history: Array<{
    action: string;
    at: Date;
    adminId?: mongoose.Types.ObjectId;
    detail?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AccessKeySchema = new Schema<IAccessKey>(
  {
    keyId: { type: String, required: true, unique: true, index: true },
    keyHash: { type: String, required: true, unique: true },
    displayId: { type: String, required: true, index: true },
    assignedNumber: { type: String, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    notes: { type: String, default: '' },
    history: [
      {
        action: { type: String, required: true },
        at: { type: Date, default: Date.now },
        adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
        detail: { type: String },
      },
    ],
  },
  { timestamps: true },
);

export const AccessKey = mongoose.model<IAccessKey>('AccessKey', AccessKeySchema);
