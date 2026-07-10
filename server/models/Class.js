const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  section: { type: String, default: '' },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  academicYear: { type: String, default: '2025-2026' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

classSchema.index({ school: 1, name: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
