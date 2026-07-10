const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Logbook = require('../models/Logbook');
const { auth, requireRole } = require('../middleware/auth');

// Get all users (scoped)
router.get('/', auth, async (req, res) => {
  try {
    let filter = { isActive: true };
    if (req.user.role === 'admin') {
      filter.state = req.user.state;
    } else if (req.user.role === 'district_admin') {
      filter.district = req.user.district;
    } else if (req.user.role === 'block_admin') {
      filter.block = req.user.block;
    } else if (req.user.role === 'school') {
      filter.school = req.user.school;
      filter.role = 'teacher';
    }
    const users = await User.find(filter).select('-password');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Create user (role-scoped)
router.post('/', auth, async (req, res) => {
  try {
    const { email, password, name, role, school, assignedClasses, assignedSchools, state, district, block } = req.body;
    
    // Permission checks
    if (role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can create admins' });
    }
    if (role === 'district_admin' && !['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (role === 'block_admin' && !['superadmin', 'admin', 'district_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (role === 'volunteer' && !['superadmin', 'admin', 'district_admin', 'block_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (role === 'teacher' && req.user.role !== 'school') {
      return res.status(403).json({ error: 'Only school can create teachers' });
    }

    const user = await User.create({ email, password, name, role, school, assignedClasses, assignedSchools, state, district, block });

    await Logbook.create({
      action: 'create_account',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      description: `Created ${role} account: ${email}`,
    });

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Revive teacher (District Admin or Block Admin)
router.put('/:id/revive', auth, requireRole('district_admin', 'block_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'teacher') {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    user.isBanned = false;
    user.delayedAttempts = 0;
    user.bannedUntil = null;
    await user.save();

    await Logbook.create({
      action: 'revive_teacher',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      description: `Revived teacher ${user.email}`,
    });

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revive teacher' });
  }
});

// Restore school access (Admin or Superadmin)
router.put('/:id/restore-school', auth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    school.dashboardLocked = false;
    school.lockedAt = null;
    await school.save();

    await Logbook.create({
      action: 'restore_school',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      school: school._id,
      description: `Restored school ${school.name} dashboard access`,
    });

    res.json({ school });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore school' });
  }
});

module.exports = router;
