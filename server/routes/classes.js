const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    let filter = { isActive: true };
    if (req.user.role === 'teacher') {
      filter._id = { $in: req.user.assignedClasses || [] };
    } else if (req.user.role === 'school') {
      filter.school = req.user.school;
    } else if (req.user.school) {
      filter.school = req.user.school;
    }
    if (req.query.schoolId) filter.school = req.query.schoolId;
    if (req.query.teacherId) filter.teacher = req.query.teacherId;

    const classes = await Class.find(filter)
      .populate('teacher', 'name email')
      .populate('school', 'name schoolId')
      .sort({ grade: 1, name: 1 });
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get classes' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('school', 'name schoolId');
    if (!classData) return res.status(404).json({ error: 'Class not found' });
    res.json({ class: classData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get class' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const classData = await Class.create({ ...req.body, school: req.user.school || req.body.school });
    res.status(201).json({ class: classData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

module.exports = router;
