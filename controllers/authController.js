const User = require('../models/User');
const { validationResult } = require('express-validator');
const generateStudentId = require('../utils/generateStudentId');

// Show Register Page
exports.showRegister = (req, res) => {
    res.render('auth/register', { 
        title: 'Student Registration',
        errors: [],
        oldInput: {}
    });
};

// Handle Registration
exports.register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/register', {
                title: 'Student Registration',
                errors: errors.array(),
                oldInput: req.body
            });
        }

        const { fullName, email, mobileNumber, password } = req.body;

        // Check if mobile number already exists
        const existingMobile = await User.findOne({ where: { mobileNumber } });
        if (existingMobile) {
            return res.render('auth/register', {
                title: 'Student Registration',
                errors: [{ msg: 'This mobile number is already registered. One mobile number = One Student ID only.' }],
                oldInput: req.body
            });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            return res.render('auth/register', {
                title: 'Student Registration',
                errors: [{ msg: 'This email is already registered.' }],
                oldInput: req.body
            });
        }

        // Generate Unique Student ID
        const studentId = await generateStudentId();

        // Create User
        const user = await User.create({
            studentId,
            username: email.split('@')[0] + '_' + Date.now(),
            email,
            password,
            fullName,
            mobileNumber,
            role: 'student'
        });

        // Log activity
        await require('../utils/activityLogger').logActivity(user.id, 'registration', {
            studentId: user.studentId
        });

        req.flash('success_msg', `Registration successful! Your Student ID is: ${studentId}. Please save this for future reference.`);
        
        // Auto login after registration
        req.login(user, (err) => {
            if (err) {
                console.error('Auto login error:', err);
                return res.redirect('/login');
            }
            return res.redirect('/student/dashboard');
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Student Registration',
            errors: [{ msg: 'Server error. Please try again.' }],
            oldInput: req.body
        });
    }
};

// Show Login Page
exports.showLogin = (req, res) => {
    res.render('auth/login', { 
        title: 'Login',
        errors: []
    });
};

// Handle Login
exports.login = (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/student/dashboard',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next);
};

// Handle Logout
exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        req.flash('success_msg', 'You have been logged out.');
        res.redirect('/login');
    });
};
