const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { generateForClass, getWorksheetsByStudent, getWorksheet, getHistory, regenerateWorksheet, deleteWorksheet } = require('../controllers/worksheetController');

router.post('/generate-class', auth, generateForClass);
router.get('/history', auth, getHistory);
router.get('/student/:studentId', auth, getWorksheetsByStudent);
router.get('/:id', auth, getWorksheet);
router.post('/:id/regenerate', auth, regenerateWorksheet);
router.delete('/:id', auth, deleteWorksheet);

module.exports = router;
