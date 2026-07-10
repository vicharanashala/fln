const express = require('express');
const router = express.Router();
const School = require('../models/School');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    let filter = { isActive: true };
    if (req.user.role === 'block_admin') filter.block = req.user.block;
    else if (req.user.role === 'district_admin') filter.district = req.user.district;
    else if (req.user.role === 'admin') filter.state = req.user.state;
    else if (req.user.role === 'school') filter._id = req.user.school;
    else if (req.user.role === 'volunteer') filter._id = { $in: req.user.assignedSchools || [] };
    else if (req.user.role === 'teacher') filter._id = req.user.school;

    const schools = await School.find(filter).sort({ name: 1 });
    res.json({ schools });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schools' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const school = await School.findById(req.params.id).populate('classes');
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json({ school });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get school' });
  }
});

router.post('/', auth, requireRole('superadmin', 'admin', 'district_admin', 'block_admin'), async (req, res) => {
  try {
    const school = await School.create(req.body);
    res.status(201).json({ school });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'School ID already exists' });
    res.status(500).json({ error: 'Failed to create school' });
  }
});

module.exports = router;
