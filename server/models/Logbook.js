const mongoose = require('mongoose');

const logbookSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['login', 'logout', 'generate_worksheet', 'print_worksheet', 'conduct_exam',
           'scan_upload', 'verify_student', 'add_student', 'remove_student',
           'create_account', 'submit_feedback', 'resolve_ticket', 'post_announcement',
           'lock_generation', 'release_lock', 'delayed_attempt', 'ban_teacher',
           'revive_teacher', 'lock_school', 'restore_school', 'certify_student',
           'set_exam_date', 'evaluate_assessment', 'flag_question'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedByRole: { type: String },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  description: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

logbookSchema.index({ timestamp: -1 });
logbookSchema.index({ action: 1, timestamp: -1 });
logbookSchema.index({ school: 1, timestamp: -1 });

module.exports = mongoose.model('Logbook', logbookSchema);
