const mongoose = require('mongoose');

const certificationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  level: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  competenciesMet: [{ type: String }],
  totalCompetencies: [{ type: String }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

certificationSchema.index({ student: 1, level: 1 }, { unique: true });

module.exports = mongoose.model('Certification', certificationSchema);
