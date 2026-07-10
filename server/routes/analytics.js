const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const School = require('../models/School');
const EvaluationReport = require('../models/EvaluationReport');
const Worksheet = require('../models/Worksheet');
const { auth, requireRole } = require('../middleware/auth');

router.get('/national', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const totalSchools = await School.countDocuments({ isActive: true });
    const totalStudents = await Student.countDocuments({ isActive: true });
    const totalAssessments = await Worksheet.countDocuments({ isActive: true });
    const avgScore = await EvaluationReport.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$score' } } }
    ]);
    res.json({
      totalSchools,
      totalStudents,
      totalAssessments,
      nationalFLNScore: Math.round(avgScore[0]?.avgScore || 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get national analytics' });
  }
});

router.get('/school/:id', auth, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ school: req.params.id, isActive: true });
    const totalAssessments = await Worksheet.countDocuments({ school: req.params.id, isActive: true });
    const avgScore = await EvaluationReport.aggregate([
      { $lookup: { from: 'worksheets', localField: 'worksheet', foreignField: '_id', as: 'worksheet' } },
      { $unwind: '$worksheet' },
      { $match: { 'worksheet.school': require('mongoose').Types.ObjectId(req.params.id) } },
      { $group: { _id: null, avgScore: { $avg: '$score' } } }
    ]);
    res.json({
      totalStudents,
      totalAssessments,
      averageScore: Math.round(avgScore[0]?.avgScore || 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get school analytics' });
  }
});

module.exports = router;
