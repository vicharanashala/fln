const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'district_admin', 'block_admin', 'school', 'teacher', 'volunteer'],
    required: true
  },
  // Hierarchy references
  state: { type: String, default: '' },
  district: { type: String, default: '' },
  block: { type: String, default: '' },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  // Teacher-specific
  assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  // Volunteer-specific
  assignedSchools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }],
  // Defaulter tracking
  delayedAttempts: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  bannedUntil: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  // For school lockout
  dashboardLocked: { type: Boolean, default: false },
  lastLogin: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
