import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;
  userRole: 'superadmin' | 'teacher';
  type: 'general' | 'curriculum';
  subject: string;
  description: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  createdAt: string;
}

const TicketSchema = new Schema<ITicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: ['superadmin', 'teacher'], required: true },
    type: { type: String, enum: ['general', 'curriculum'], required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Open', 'Reviewed', 'Resolved'], default: 'Open' },
    createdAt: { type: String, required: true },
  },
  { timestamps: true }
);

TicketSchema.index({ status: 1 });
TicketSchema.index({ userId: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
