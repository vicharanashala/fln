const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { submitAnswers, evaluateSubmission, getLatestEvaluation, getEvaluationHistory } = require('../controllers/evaluationController');

router.post('/submit', auth, submitAnswers);
router.post('/evaluate', auth, evaluateSubmission);
router.get('/:studentId/latest', auth, getLatestEvaluation);
router.get('/:studentId/history', auth, getEvaluationHistory);

module.exports = router;
