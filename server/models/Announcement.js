const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isUrgent: { type: Boolean, default: false },
  emailEscalation: { type: Boolean, default: false },
  targetRoles: [{
    type: String,
    enum: ['superadmin', 'admin', 'district_admin', 'block_admin', 'school', 'teacher', 'volunteer']
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
