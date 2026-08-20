import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'SUPPORT';
  active: boolean;
  lastLogin?: Date;
  lastLoginIp?: string;
  failedAttempts: number;
  lockedUntil?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'SUPPORT'], default: 'SUPPORT' },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
    lastLoginIp: { type: String },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
  },
  { timestamps: true },
);

export const Admin = mongoose.model<IAdmin>('Admin', AdminSchema);
