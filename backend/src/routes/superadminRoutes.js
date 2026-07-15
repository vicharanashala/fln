const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');

// Schools
router.get('/schools', superadminController.getSchools);
router.post('/schools', superadminController.onboardSchool);

// Students
router.get('/students', superadminController.getStudents);

// Admin / Coordinators
router.get('/admin/coordinators', superadminController.getCoordinators);
router.post('/admin/create', superadminController.createCoordinator);

// Announcements
router.post('/announcements/create', superadminController.createAnnouncement);

// Reset
router.get('/reset', superadminController.resetDatabase);
router.post('/reset', superadminController.resetDatabase);

// Analytics
router.get('/analytics', superadminController.getAnalytics);

module.exports = router;
