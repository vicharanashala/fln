import mongoose, { Schema, Document } from 'mongoose';

export interface ILogEntry extends Document {
  timestamp: string;
  schoolId: mongoose.Types.ObjectId;
  schoolName: string;
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userRole: 'superadmin' | 'teacher';
  activityType: 'download' | 'print' | 'conduct' | 'scan' | 'verify' | 'ticket';
  status: 'Success' | 'Failed' | 'Delayed';
  details: string;
}

const LogEntrySchema = new Schema<ILogEntry>(
  {
    timestamp: { type: String, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    schoolName: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true },
    userRole: { type: String, enum: ['superadmin', 'teacher'], required: true },
    activityType: {
      type: String,
      enum: ['download', 'print', 'conduct', 'scan', 'verify', 'ticket'],
      required: true,
    },
    status: { type: String, enum: ['Success', 'Failed', 'Delayed'], required: true },
    details: { type: String, required: true },
  },
  { timestamps: true }
);

LogEntrySchema.index({ schoolId: 1, activityType: 1 });
LogEntrySchema.index({ userId: 1 });
LogEntrySchema.index({ timestamp: -1 });

export const LogEntry = mongoose.model<ILogEntry>('LogEntry', LogEntrySchema);
