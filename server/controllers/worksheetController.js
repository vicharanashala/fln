const Worksheet = require('../models/Worksheet');
const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const GenerationLock = require('../models/GenerationLock');
const EvaluationReport = require('../models/EvaluationReport');
const Logbook = require('../models/Logbook');
const aiService = require('../services/aiService');
const worksheetService = require('../services/worksheetService');

exports.generateForClass = async (req, res) => {
  try {
    const { classId, assessmentCycle } = req.body;
    const teacherId = req.user._id;
    const teacherRole = req.user.role;

    if (!['teacher', 'school', 'volunteer', 'block_admin'].includes(teacherRole)) {
      return res.status(403).json({ error: 'You do not have permission to generate worksheets' });
    }

    // Determine lock pair
    let lockPair;
    if (['teacher', 'school'].includes(teacherRole)) {
      lockPair = 'teacher_school';
    } else if (['volunteer', 'block_admin'].includes(teacherRole)) {
      lockPair = 'volunteer_block_admin';
    }

    // Check existing lock
    const existingLock = await GenerationLock.findOne({
      class: classId,
      assessmentCycle,
      lockPair,
      isActive: true
    });

    if (existingLock) {
      const lockedUser = await User.findById(existingLock.lockedBy);
      if (existingLock.lockedBy.toString() !== req.user._id.toString()) {
        return res.status(409).json({
          error: `Worksheet already generated for this class by ${lockedUser?.name} (${existingLock.lockedByRole})`,
          lockedBy: lockedUser?.name,
          lockedAt: existingLock.lockedAt
        });
      }
    }

    const classData = await Class.findById(classId).populate('school');
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const students = await Student.find({ class: classId, isActive: true });
    if (students.length === 0) {
      return res.status(400).json({ error: 'No students found in this class' });
    }

    // Create or update generation lock
    if (!existingLock) {
      await GenerationLock.create({
        class: classId,
        assessmentCycle,
        lockPair,
        lockedBy: req.user._id,
        lockedByRole: teacherRole,
        autoReleaseAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
    }

    // Generate personalized worksheets using AI
    const worksheets = [];
    for (const student of students) {
      const level = student.currentLevel || 'Level1';

      // Fetch recent weaknesses from last evaluation
      const lastReport = await EvaluationReport.findOne({ student: student._id })
        .sort({ evaluatedAt: -1 })
        .select('weaknesses');
      const weakCompetencies = lastReport?.weaknesses || [];

      let questions;
      try {
        questions = await aiService.generateQuestions({
          grade: classData.grade,
          subject: 'Mathematics',
          studentName: student.name,
          level,
          weakCompetencies,
          count: 10,
        });
      } catch (aiError) {
        console.warn(`AI generation failed for ${student.name}, using fallback:`, aiError.message);
        questions = generateMockQuestions(level);
      }

      const worksheet = await Worksheet.create({
        worksheetId: `WS-${Date.now()}-${student.studentId}`,
        student: student._id,
        class: classId,
        school: classData.school._id,
        level,
        assessmentCycle,
        worksheetJson: {
          exam_id: `EXAM-${Date.now()}`,
          class: classData.grade,
          total_questions: questions.length,
          questions,
        },
        generatedBy: req.user._id,
        generatedByRole: teacherRole,
        lockedBy: existingLock ? existingLock.lockedBy : req.user._id,
        status: 'generated'
      });
      worksheets.push(worksheet);
    }

    // Log the generation
    await Logbook.create({
      action: 'generate_worksheet',
      performedBy: req.user._id,
      performedByRole: teacherRole,
      school: classData.school._id,
      class: classId,
      description: `Generated ${worksheets.length} worksheets for class ${classData.name}`,
      metadata: { assessmentCycle, studentCount: worksheets.length }
    });

    res.json({
      message: `Generated ${worksheets.length} worksheets successfully`,
      count: worksheets.length,
      class: classData.name,
      assessmentCycle,
      teacherId: teacherRole === 'teacher' ? teacherId : undefined,
      schoolId: teacherRole === 'school' ? teacherId : undefined,
      volunteerId: teacherRole === 'volunteer' ? teacherId : undefined,
      blockAdminId: teacherRole === 'block_admin' ? teacherId : undefined
    });
  } catch (error) {
    console.error('Worksheet generation error:', error);
    res.status(500).json({ error: 'Failed to generate worksheets' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { search, grade, level, assessmentCycle, sort, startDate, endDate, subject } = req.query;
    const teacherId = req.user._id;

    const query = { isActive: true };

    // Scope to teacher's generated worksheets
    query.generatedBy = teacherId;

    // Filter by assessment cycle
    if (assessmentCycle) {
      query.assessmentCycle = assessmentCycle;
    }

    // Filter by FLN level
    if (level) {
      query.level = level;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search by student name or studentId
    let studentIds = null;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchedStudents = await Student.find({
        $or: [{ name: searchRegex }, { studentId: searchRegex }]
      }).select('_id');
      studentIds = matchedStudents.map(s => s._id);
      if (studentIds.length === 0) {
        return res.json({ worksheets: [], total: 0 });
      }
      query.student = { $in: studentIds };
    }

    // Grade filter: find classes with matching grade, then filter worksheets
    if (grade) {
      const matchedClasses = await Class.find({ grade: parseInt(grade) }).select('_id');
      const classIds = matchedClasses.map(c => c._id);
      if (classIds.length === 0) {
        return res.json({ worksheets: [], total: 0 });
      }
      query.class = { $in: classIds };
    }

    // Build sort
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    }

    const worksheets = await Worksheet.find(query)
      .populate('student', 'name studentId currentLevel')
      .populate('class', 'name grade section')
      .populate('school', 'name')
      .populate('generatedBy', 'name')
      .sort(sortOption)
      .limit(200);

    res.json({ worksheets, total: worksheets.length });
  } catch (error) {
    console.error('Worksheet history error:', error);
    res.status(500).json({ error: 'Failed to fetch worksheet history' });
  }
};

exports.regenerateWorksheet = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: 'Worksheet ID is required' });
    }

    const worksheet = await Worksheet.findOne({ _id: req.params.id, isActive: true });
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }

    const newWorksheet = await worksheetService.regenerateForWorksheet(worksheet);

    const populated = await Worksheet.findById(newWorksheet._id)
      .populate('student', 'name studentId currentLevel')
      .populate('class', 'name grade section')
      .populate('school', 'name')
      .populate('generatedBy', 'name');

    res.json({ worksheet: populated });
  } catch (error) {
    console.error('Worksheet regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate worksheet' });
  }
};

exports.deleteWorksheet = async (req, res) => {
  try {
    const worksheet = await Worksheet.findOne({ _id: req.params.id, isActive: true });
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    worksheet.isActive = false;
    await worksheet.save();
    res.json({ message: 'Worksheet deleted successfully' });
  } catch (error) {
    console.error('Worksheet delete error:', error);
    res.status(500).json({ error: 'Failed to delete worksheet' });
  }
};

exports.getWorksheetsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId || studentId === 'undefined') {
      return res.json({ worksheets: [] });
    }
    const worksheets = await Worksheet.find({ student: studentId })
      .populate('student', 'name studentId currentLevel')
      .populate('class', 'name grade section')
      .populate('school', 'name')
      .sort({ createdAt: -1 });
    res.json({ worksheets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get worksheets' });
  }
};

exports.getWorksheet = async (req, res) => {
  try {
    const worksheet = await Worksheet.findOne({ _id: req.params.id, isActive: true })
      .populate('student', 'name studentId currentLevel')
      .populate('class', 'name grade section')
      .populate('school', 'name')
      .populate('generatedBy', 'name');
    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    res.json({ worksheet });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get worksheet' });
  }
};

function generateMockQuestions(level) {
  const questionBank = {
    Level1: [
      { question_id: 'Q1', question: 'Count the apples', answer: '5', answer_type: 'text', topic: 'Number Sense', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Counting objects up to 5' },
      { question_id: 'Q2', question: 'Identify the circle', answer: 'circle', answer_type: 'text', topic: 'Shapes', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Basic shape recognition' },
      { question_id: 'Q3', question: 'What comes after 3?', answer: '4', answer_type: 'text', topic: 'Number Sense', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Number sequence' },
      { question_id: 'Q4', question: 'Match the same color', answer: 'red', answer_type: 'text', topic: 'Shapes', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Color matching' },
      { question_id: 'Q5', question: 'Count fingers on one hand', answer: '5', answer_type: 'text', topic: 'Number Sense', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Counting body parts' },
      { question_id: 'Q6', question: 'Which is bigger? 2 or 5', answer: '5', answer_type: 'text', topic: 'Number Sense', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Number comparison' },
      { question_id: 'Q7', question: 'Draw a line under the triangle', answer: 'triangle', answer_type: 'text', topic: 'Shapes', difficulty: 'medium', source_level: 'Preschool 1', class_level: 1, reasoning: 'Shape identification' },
      { question_id: 'Q8', question: 'How many sides does a square have?', answer: '4', answer_type: 'text', topic: 'Shapes', difficulty: 'medium', source_level: 'Preschool 1', class_level: 1, reasoning: 'Shape properties' },
      { question_id: 'Q9', question: 'Write numbers 1 to 5', answer: '12345', answer_type: 'text', topic: 'Number Sense', difficulty: 'medium', source_level: 'Preschool 1', class_level: 1, reasoning: 'Number writing' },
      { question_id: 'Q10', question: 'Count the stars (5 stars shown)', answer: '5', answer_type: 'text', topic: 'Number Sense', difficulty: 'easy', source_level: 'Preschool 1', class_level: 1, reasoning: 'Object counting' }
    ]
  };
  return questionBank[level] || questionBank.Level1;
}
