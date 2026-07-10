const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: {
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
  age: { type: Number, required: true },
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
  section: { type: String, default: '' },
  // Aadhar/Birth Certificate - masked for non-superadmin
  identityType: {
    type: String,
    enum: ['aadhar', 'birth_certificate'],
    required: true
  },
  identityNumber: {
    type: String,
    required: true,
    unique: true
  },
  identityNumberMasked: { type: String },
  // FLN tracking
  currentLevel: {
    type: String,
    default: 'Level1'
  },
  targetLevel: { type: String, default: '' },
  levelHistory: [{
    level: String,
    assessedAt: Date,
    assessmentCycle: String
  }],
  // Foreign student (newly enrolled this year)
  isNewEnrollment: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Pre-save hook to mask identity number
studentSchema.pre('save', function(next) {
  if (this.isModified('identityNumber')) {
    const num = this.identityNumber;
    if (num.length >= 8) {
      this.identityNumberMasked = num.slice(0, 4) + 'XXXXXXXX';
    } else {
      this.identityNumberMasked = 'XXXXXXXX' + num.slice(-4);
    }
  }
  next();
});

module.exports = mongoose.model('Student', studentSchema);
