const Worksheet = require('../models/Worksheet');
const Student = require('../models/Student');
const Class = require('../models/Class');
const EvaluationReport = require('../models/EvaluationReport');
const aiService = require('./aiService');

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
