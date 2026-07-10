const mongoose = require('mongoose');

const answerSubmissionSchema = new mongoose.Schema({
  worksheet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worksheet',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  // ICR structured JSON answers
  answers: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedAt: { type: Date, default: Date.now },
  submissionWindowClosed: { type: Boolean, default: false },
  isDelayed: { type: Boolean, default: false },
  ingestionStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  scanReference: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('AnswerSubmission', answerSubmissionSchema);
