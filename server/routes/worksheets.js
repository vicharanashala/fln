const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { generateForClass, getWorksheetsByStudent, getWorksheet } = require('../controllers/worksheetController');

router.post('/generate-class', auth, generateForClass);
router.get('/student/:studentId', auth, getWorksheetsByStudent);
router.get('/:id', auth, getWorksheet);

module.exports = router;
