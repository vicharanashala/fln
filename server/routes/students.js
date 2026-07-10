const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { createStudent, getStudents, getStudent, getStudentHistory } = require('../controllers/studentController');

router.post('/', auth, createStudent);
router.get('/', auth, getStudents);
router.get('/:id', auth, getStudent);
router.get('/:id/history', auth, getStudentHistory);

module.exports = router;
