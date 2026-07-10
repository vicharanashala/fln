const EvaluationReport = require('../models/EvaluationReport');
const AnswerSubmission = require('../models/AnswerSubmission');
const Worksheet = require('../models/Worksheet');
const Student = require('../models/Student');
const Logbook = require('../models/Logbook');

exports.submitAnswers = async (req, res) => {
  try {
    const { worksheetId, studentId, answers } = req.body;
    if (!worksheetId || !studentId || !answers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const submission = await AnswerSubmission.create({
      worksheet: worksheetId,
      student: studentId,
      answers,
      submittedBy: req.user._id,
      submittedAt: new Date(),
      isDelayed: false,
      ingestionStatus: 'completed'
    });

    await Worksheet.findByIdAndUpdate(worksheetId, { status: 'submitted' });

    await Logbook.create({
      action: 'scan_upload',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      student: studentId,
      description: 'Answers submitted via ICR ingestion',
    });

    // Auto-evaluate after submission
    try {
      const evaluationResult = await runEvaluation(submission, req.user._id);
      res.status(201).json({ submission, evaluation: evaluationResult });
    } catch (evalError) {
      console.error('Auto-evaluation failed:', evalError.message);
      res.status(201).json({ submission, evaluation: null, evalNote: 'Evaluation pending' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit answers' });
  }
};

const runEvaluation = async (submission, userId) => {
  const worksheet = await Worksheet.findById(submission.worksheet);
  if (!worksheet) throw new Error('Worksheet not found');

  const worksheetJson = worksheet.worksheetJson;
  const questions = worksheetJson.questions || [];
  const submittedAnswers = submission.answers;

  const questionResults = [];
  let correctCount = 0;

  for (const q of questions) {
    const studentAnswer = submittedAnswers[q.question_id] || '';
    const isCorrect = studentAnswer.toString().toLowerCase() === q.answer.toString().toLowerCase();
    if (isCorrect) correctCount++;
    questionResults.push({
      questionId: q.question_id,
      correct: isCorrect,
      studentAnswer,
      expectedAnswer: q.answer,
      difficulty: q.difficulty,
      topic: q.topic
    });
  }

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const previousLevel = worksheet.level;
  let recommendedLevel = previousLevel;
  if (score >= 80) {
    recommendedLevel = incrementLevel(previousLevel);
  } else if (score >= 50) {
    recommendedLevel = previousLevel;
  } else {
    recommendedLevel = decrementLevel(previousLevel);
  }

  const levelFlags = [];
  const easyQuestions = questionResults.filter(q => q.difficulty === 'easy');
  if (easyQuestions.length > 0) {
    const failedEasy = easyQuestions.filter(q => !q.correct);
    if (failedEasy.length / easyQuestions.length >= 0.5) {
      levelFlags.push({
        questionId: failedEasy.map(q => q.questionId).join(','),
        reason: '50%+ of students failed easy-tagged question(s)'
      });
    }
  }

  const report = await EvaluationReport.create({
    worksheet: worksheet._id,
    student: submission.student,
    assessmentCycle: worksheet.assessmentCycle,
    totalQuestions,
    correctAnswers: correctCount,
    score,
    questionResults,
    strengths: generateStrengths(questionResults),
    weaknesses: generateWeaknesses(questionResults),
    mistakePatterns: [],
    narrativeSummary: generateNarrative(correctCount, totalQuestions, score),
    previousLevel,
    recommendedLevel,
    assignedLevel: recommendedLevel,
    levelFlags,
    evaluatedAt: new Date()
  });

  await Student.findByIdAndUpdate(submission.student, {
    currentLevel: recommendedLevel,
    $push: {
      levelHistory: {
        level: recommendedLevel,
        assessedAt: new Date(),
        assessmentCycle: worksheet.assessmentCycle
      }
    }
  });

  await Worksheet.findByIdAndUpdate(worksheet._id, { status: 'evaluated' });

  await Logbook.create({
    action: 'evaluate_assessment',
    performedBy: userId,
    performedByRole: 'system',
    student: submission.student,
    description: `Evaluated: ${correctCount}/${totalQuestions} (${score}%) → ${recommendedLevel}`,
  });

  return report;
};

exports.evaluateSubmission = async (req, res) => {
  try {
    const { submissionId } = req.body;
    const submission = await AnswerSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const report = await runEvaluation(submission, req.user._id);
    res.json({ report });
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate submission' });
  }
};

exports.getLatestEvaluation = async (req, res) => {
  try {
    const report = await EvaluationReport.findOne({ student: req.params.studentId })
      .sort({ evaluatedAt: -1 });
    if (!report) {
      return res.status(404).json({ error: 'No evaluation found' });
    }
    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get evaluation' });
  }
};

exports.getEvaluationHistory = async (req, res) => {
  try {
    const reports = await EvaluationReport.find({ student: req.params.studentId })
      .sort({ evaluatedAt: -1 });
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get evaluation history' });
  }
};

function incrementLevel(level) {
  const levels = ['Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7', 'Level8'];
  const idx = levels.indexOf(level);
  return idx < levels.length - 1 ? levels[idx + 1] : level;
}

function decrementLevel(level) {
  const levels = ['Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7', 'Level8'];
  const idx = levels.indexOf(level);
  return idx > 0 ? levels[idx - 1] : level;
}

function generateStrengths(results) {
  const topicScores = {};
  for (const r of results) {
    if (!topicScores[r.topic]) {
      topicScores[r.topic] = { correct: 0, total: 0 };
    }
    topicScores[r.topic].total++;
    if (r.correct) topicScores[r.topic].correct++;
  }
  const strengths = [];
  for (const [topic, data] of Object.entries(topicScores)) {
    if (data.correct / data.total >= 0.7) {
      strengths.push(`${topic}: Strong`);
    } else if (data.correct / data.total < 0.4) {
      strengths.push(`${topic}: Needs Practice`);
    }
  }
  return strengths;
}

function generateWeaknesses(results) {
  const weak = results.filter(r => !r.correct).map(r => r.topic);
  return [...new Set(weak)];
}

function generateNarrative(correct, total, score) {
  if (score >= 80) return `Excellent performance! ${correct} out of ${total} correct. Ready to advance.`;
  if (score >= 50) return `Good effort! ${correct} out of ${total} correct. Keep practicing to improve.`;
  return `Needs improvement. ${correct} out of ${total} correct. Additional practice recommended.`;
}
