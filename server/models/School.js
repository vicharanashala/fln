const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  state: { type: String, required: true },
  district: { type: String, required: true },
  block: { type: String, required: true },
  address: { type: String, default: '' },
  studentStrength: {
    type: String,
    enum: ['high', 'low'],
    default: 'high'
  },
  hasInternet: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  // Locked when all teachers default
  dashboardLocked: { type: Boolean, default: false },
  lockedAt: { type: Date },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('School', schoolSchema);
