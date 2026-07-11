const Worksheet = require('../models/Worksheet');
const Student = require('../models/Student');
const Class = require('../models/Class');
const EvaluationReport = require('../models/EvaluationReport');
const aiService = require('./aiService');
const { generateMockQuestions } = require('../data/mockQuestions');

async function regenerateForWorksheet(originalWorksheet) {
  const student = await Student.findById(originalWorksheet.student);
  if (!student) throw new Error('Student not found');

  const classData = await Class.findById(originalWorksheet.class).populate('school');
  if (!classData) throw new Error('Class not found');

  const level = student.currentLevel || originalWorksheet.level || 'Level1';

  const lastReport = await EvaluationReport.findOne({ student: student._id })
    .sort({ evaluatedAt: -1 })
    .select('weaknesses');
  const weakCompetencies = lastReport?.weaknesses || [];

  const grade = originalWorksheet.worksheetJson?.class || classData.grade;
  const subject = originalWorksheet.worksheetJson?.subject || 'Mathematics';
  const count = originalWorksheet.worksheetJson?.total_questions || 10;

  let questions;
  try {
    questions = await aiService.generateQuestions({
      grade,
      subject,
      studentName: student.name,
      level,
      weakCompetencies,
      count,
    });
  } catch (aiError) {
    console.warn(`AI regeneration failed for ${student.name}, using fallback:`, aiError.message);
    questions = generateMockQuestions(level);
  }

  const newWorksheet = await Worksheet.create({
    worksheetId: `WS-${Date.now()}-${student.studentId}-R`,
    student: student._id,
    class: originalWorksheet.class,
    school: classData.school._id,
    level,
    assessmentCycle: originalWorksheet.assessmentCycle,
    worksheetJson: {
      exam_id: `EXAM-${Date.now()}`,
      class: grade,
      subject,
      total_questions: questions.length,
      questions,
    },
    generatedBy: originalWorksheet.generatedBy,
    generatedByRole: originalWorksheet.generatedByRole,
    status: 'generated',
  });

  return newWorksheet;
}

module.exports = { regenerateForWorksheet };
