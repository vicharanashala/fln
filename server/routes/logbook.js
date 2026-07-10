const express = require('express');
const router = express.Router();
const Logbook = require('../models/Logbook');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { date, school, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (date) {
      const d = new Date(date);
      filter.timestamp = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }
    if (startDate && endDate) {
      filter.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (school) filter.school = school;
    if (action) filter.action = action;

    if (req.user.role === 'block_admin') {
      const School = require('../models/School');
      const schools = await School.find({ block: req.user.block }).select('_id');
      filter.school = { $in: schools.map(s => s._id) };
    }

    const logs = await Logbook.find(filter)
      .populate('performedBy', 'name email role')
      .populate('school', 'name schoolId')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Logbook.countDocuments(filter);

    res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logbook' });
  }
});

router.get('/export', auth, async (req, res) => {
  try {
    const logs = await Logbook.find({})
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 })
      .limit(1000);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export logbook' });
  }
});

module.exports = router;
