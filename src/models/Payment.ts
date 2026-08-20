import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  paymentRequestId: string;
  customerId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  country: string;
  method: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  notes: string;
  accessKeyId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentRequestId: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'PKR' },
    country: { type: String, default: 'Pakistan' },
    method: { type: String, default: 'Manual' },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    notes: { type: String, default: '' },
    accessKeyId: { type: Schema.Types.ObjectId, ref: 'AccessKey' },
  },
  { timestamps: true },
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
