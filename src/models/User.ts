import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  customerId: string;
  jid: string;
  phoneNumber: string;
  country: string;
  name?: string;
  username?: string;
  accessKeyId?: mongoose.Types.ObjectId;
  accessKeyStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  paymentStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  supportStatus: 'NONE' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  notes: string;
  tags: string[];
  blocked: boolean;
  blockedReason?: string;
  firstContact: Date;
  lastContact: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    jid: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String, required: true, index: true },
    country: { type: String, default: 'Unknown' },
    name: { type: String },
    username: { type: String },
    accessKeyId: { type: Schema.Types.ObjectId, ref: 'AccessKey' },
    accessKeyStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'],
      default: 'NONE',
    },
    paymentStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NONE',
    },
    supportStatus: {
      type: String,
      enum: ['NONE', 'OPEN', 'IN_PROGRESS', 'RESOLVED'],
      default: 'NONE',
    },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    blocked: { type: Boolean, default: false },
    blockedReason: { type: String },
    firstContact: { type: Date, default: Date.now },
    lastContact: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

UserSchema.index({ phoneNumber: 1, country: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
