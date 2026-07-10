const mongoose = require('mongoose');

const generationLockSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  assessmentCycle: {
    type: String,
    enum: ['baseline', 'mid_year', 'end_year', 'practice'],
    required: true
  },
  lockPair: {
    type: String,
    enum: ['teacher_school', 'volunteer_block_admin'],
    required: true
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lockedByRole: { type: String },
  lockedAt: { type: Date, default: Date.now },
  // Auto-release when exam cycle closes
  autoReleaseAt: { type: Date },
  releasedAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

generationLockSchema.index({ class: 1, assessmentCycle: 1, lockPair: 1 }, { unique: true });

module.exports = mongoose.model('GenerationLock', generationLockSchema);
