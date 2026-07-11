const mongoose = require('mongoose');

const evaluationReportSchema = new mongoose.Schema({
  worksheet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worksheet',
    default: null
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  assessmentCycle: {
    type: String,
    enum: ['baseline', 'mid_year', 'end_year', 'practice'],
    required: true
  },
  // Scores
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  score: { type: Number, required: true }, // percentage
  // Per-question results
  questionResults: [{
    questionId: String,
    correct: Boolean,
    studentAnswer: String,
    expectedAnswer: String,
    difficulty: String,
    topic: String
  }],
  // AI narrative
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  mistakePatterns: [{ type: String }],
  narrativeSummary: { type: String, default: '' },
  // Level recommendation
  previousLevel: { type: String },
  recommendedLevel: { type: String, required: true },
  assignedLevel: { type: String },
  // Level flags
  levelFlags: [{
    questionId: String,
    reason: String
  }],
  evaluatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('EvaluationReport', evaluationReportSchema);
