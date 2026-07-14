const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(ensureAuthenticated);
router.use(ensureAdmin);

// Admin Dashboard
router.get('/dashboard', adminController.dashboard);

// Student Management
router.get('/students', async (req, res) => {
    const students = await require('../models/User').findAll({
        where: { role: 'student' },
        order: [['createdAt', 'DESC']]
    });
    res.render('admin/students', { title: 'Student Management', students });
});

// Search Student
router.get('/students/search', adminController.searchStudent);

// Enrollment Management
router.get('/enrollments', async (req, res) => {
    const enrollments = await require('../models/Enrollment').findAll({
        include: ['user', 'course'],
        order: [['createdAt', 'DESC']]
    });
    res.render('admin/enrollments', { title: 'Enrollment Management', enrollments });
});

// Enroll Student (One-click)
router.post('/enroll', adminController.enrollStudent);

// Revoke Access
router.post('/revoke', adminController.revokeAccess);

// Inactive Students
router.get('/inactivity', adminController.inactiveStudents);

// Analytics
router.get('/analytics', async (req, res) => {
    const activities = await require('../models/Activity').findAll({
        include: ['user'],
        order: [['createdAt', 'DESC']],
        limit: 100
    });
    res.render('admin/analytics', { title: 'Student Analytics', activities });
});

module.exports = router;
