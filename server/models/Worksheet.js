const mongoose = require('mongoose');

const worksheetSchema = new mongoose.Schema({
  worksheetId: { type: String, required: true, unique: true },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  level: { type: String, required: true },
  assessmentCycle: {
    type: String,
    enum: ['baseline', 'mid_year', 'end_year', 'practice'],
    required: true
  },
  // The AI-generated worksheet JSON
  worksheetJson: { type: mongoose.Schema.Types.Mixed, required: true },
  // PDF reference
  pdfPath: { type: String, default: '' },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedByRole: { type: String },
  // Generation lock info
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date },
  status: {
    type: String,
    enum: ['generated', 'printed', 'conducted', 'submitted', 'evaluated'],
    default: 'generated'
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

worksheetSchema.index({ student: 1, assessmentCycle: 1 });

module.exports = mongoose.model('Worksheet', worksheetSchema);
