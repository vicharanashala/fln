const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: {
    type: String,
    enum: ['general', 'curriculum', 'content', 'process', 'exam'],
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedByRole: { type: String },
  status: {
    type: String,
    enum: ['open', 'under_review', 'approved', 'rejected', 'implemented'],
    default: 'open'
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String, default: '' },
  relatedQuestionId: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

ticketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
