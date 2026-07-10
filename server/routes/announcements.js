const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Logbook = require('../models/Logbook');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get announcements' });
  }
});

router.post('/', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { title, content, isUrgent, emailEscalation, targetRoles } = req.body;
    const announcement = await Announcement.create({
      title, content, postedBy: req.user._id, isUrgent, emailEscalation, targetRoles
    });
    await Logbook.create({
      action: 'post_announcement',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      description: `Posted announcement: ${title}`,
    });
    res.status(201).json({ announcement });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

module.exports = router;
