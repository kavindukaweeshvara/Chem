const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Activity = require('../models/Activity');
const { Op } = require('sequelize');
const sequelize = require('sequelize');

// Admin Dashboard
exports.dashboard = async (req, res) => {
    try {
        const totalStudents = await User.count({ where: { role: 'student' } });
        const activeStudents = await User.count({ 
            where: { 
                role: 'student', 
                isActive: true 
            } 
        });
        const totalEnrollments = await Enrollment.count({ 
            where: { status: 'active' } 
        });
        const pendingPayments = await Enrollment.count({ 
            where: { paymentStatus: 'pending_verification' } 
        });

        // Get recent activities
        const recentActivities = await Activity.findAll({
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [{
                model: User,
                attributes: ['studentId', 'fullName']
            }]
        });

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: {
                totalStudents,
                activeStudents,
                totalEnrollments,
                pendingPayments
            },
            recentActivities
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).render('500', { title: 'Server Error' });
    }
};

// Search Student by ID
exports.searchStudent = async (req, res) => {
    try {
        const { studentId } = req.query;
        
        if (!studentId) {
            return res.json({ success: false, message: 'Please provide a Student ID' });
        }

        const student = await User.findOne({
            where: { studentId: studentId.toUpperCase() },
            include: [{
                model: Enrollment,
                include: ['course']
            }]
        });

        if (!student) {
            return res.json({ success: false, message: 'Student not found' });
        }

        res.json({
            success: true,
            student: student.toPublicProfile(),
            enrollments: student.Enrollments
        });
    } catch (error) {
        console.error('Search student error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Approve/Enroll Student
exports.enrollStudent = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;

        const student = await User.findOne({ where: { studentId } });
        if (!student) {
            return res.json({ success: false, message: 'Student not found' });
        }

        // Check existing enrollment
        const existingEnrollment = await Enrollment.findOne({
            where: {
                userId: student.id,
                courseId: courseId,
                status: 'active'
            }
        });

        if (existingEnrollment) {
            return res.json({ success: false, message: 'Student is already enrolled in this course' });
        }

        // Create enrollment
        const enrollment = await Enrollment.create({
            userId: student.id,
            courseId: courseId,
            status: 'active',
            paymentStatus: 'verified',
            approvedBy: req.user.id,
            expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 1)) // 1 month
        });

        // Log activity
        await require('../utils/activityLogger').logActivity(student.id, 'enrollment_approved', {
            courseId: courseId,
            approvedBy: req.user.id
        });

        res.json({
            success: true,
            message: `Student ${studentId} has been enrolled successfully`,
            enrollment
        });
    } catch (error) {
        console.error('Enroll student error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Revoke Student Access
exports.revokeAccess = async (req, res) => {
    try {
        const { enrollmentId } = req.body;

        const enrollment = await Enrollment.findByPk(enrollmentId);
        if (!enrollment) {
            return res.json({ success: false, message: 'Enrollment not found' });
        }

        enrollment.status = 'revoked';
        enrollment.revokedAt = new Date();
        await enrollment.save();

        // Log activity
        await require('../utils/activityLogger').logActivity(enrollment.userId, 'access_revoked', {
            enrollmentId: enrollmentId,
            revokedBy: req.user.id
        });

        res.json({
            success: true,
            message: 'Student access has been revoked'
        });
    } catch (error) {
        console.error('Revoke access error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Inactive Students (7+ days)
exports.inactiveStudents = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const inactiveStudents = await User.findAll({
            where: {
                role: 'student',
                [Op.or]: [
                    { lastLoginAt: { [Op.lt]: sevenDaysAgo } },
                    { lastLoginAt: null }
                ]
            },
            order: [['lastLoginAt', 'ASC']]
        });

        res.render('admin/inactivity', {
            title: 'Inactive Students (7+ Days)',
            inactiveStudents,
            threshold: '7 days'
        });
    } catch (error) {
        console.error('Inactive students error:', error);
        res.status(500).render('500', { title: 'Server Error' });
    }
};
