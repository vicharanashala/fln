const Student = require('../models/Student');
const Class = require('../models/Class');
const Logbook = require('../models/Logbook');

exports.createStudent = async (req, res) => {
  try {
    const { name, age, classId, section, identityType, identityNumber, isNewEnrollment } = req.body;
    const schoolId = req.user.school || req.body.schoolId;

    if (!name || !age || !classId || !identityType || !identityNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const studentId = `STU-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const student = await Student.create({
      studentId,
      name,
      age,
      class: classId,
      school: schoolId || classData.school,
      section,
      identityType,
      identityNumber,
      isNewEnrollment: isNewEnrollment || false,
      currentLevel: 'Level1'
    });

    await Logbook.create({
      action: 'add_student',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      school: schoolId || classData.school,
      class: classId,
      student: student._id,
      description: `Added student ${name} (${studentId})`,
    });

    res.status(201).json({ student });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Student with this identity number already exists' });
    }
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const { classId } = req.query;
    const filter = { isActive: true };
    if (classId) filter.class = classId;
    if (req.user.role === 'teacher' && req.user.assignedClasses?.length > 0) {
      filter.class = { $in: req.user.assignedClasses };
    }
    const students = await Student.find(filter)
      .populate('class', 'name grade section')
      .sort({ name: 1 });
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get students' });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('class', 'name grade section')
      .populate('school', 'name schoolId');
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    // Mask identity number for non-superadmin
    const result = student.toObject();
    if (req.user.role !== 'superadmin') {
      result.identityNumber = result.identityNumberMasked;
    }
    res.json({ student: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get student' });
  }
};

exports.getStudentHistory = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({
      levelHistory: student.levelHistory,
      currentLevel: student.currentLevel
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get student history' });
  }
};
