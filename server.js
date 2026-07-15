// ============================================
// BUDDIKA WIJESUNDARA - CHEMISTRY LMS
// Complete Working Server
// ============================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE SETUP
// ============================================
let db = null;
let dbConnected = false;

try {
    const { Sequelize } = require('sequelize');
    
    if (process.env.DATABASE_URL) {
        db = new Sequelize(process.env.DATABASE_URL, {
            dialect: 'postgres',
            logging: false,
            dialectOptions: {
                ssl: { require: true, rejectUnauthorized: false }
            }
        });
        
        db.authenticate()
            .then(() => {
                dbConnected = true;
                console.log('✅ Database Connected Successfully');
            })
            .catch(err => {
                console.log('⚠️ Database Connection Failed - Running Basic Mode');
                dbConnected = false;
            });
    } else {
        console.log('⚠️ No DATABASE_URL Found - Running Basic Mode');
    }
} catch (error) {
    console.log('⚠️ Database Module Not Found - Running Basic Mode');
}

// ============================================
// MIDDLEWARE SETUP
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'Buddika@2024_LMS_Secret_Key_!@#$%',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ============================================
// ADMIN CREDENTIALS
// ============================================
const ADMIN = {
    username: process.env.ADMIN_USERNAME || 'Buddika',
    password: process.env.ADMIN_PASSWORD || 'Buddika@2024',
    name: process.env.ADMIN_DISPLAY_NAME || 'Buddika Wijesundara'
};

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================
function adminAuth(req, res, next) {
    if (req.session && req.session.isAdminLoggedIn) {
        return next();
    }
    return res.redirect('/admin/login?error=please_login');
}

function studentAuth(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        return next();
    }
    return res.redirect('/login');
}

// ============================================
// 🌐 HOME PAGE
// ============================================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Buddika Wijesundara | Chemistry LMS</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #1a237e, #4a148c);
            min-height: 100vh;
            display: flex; justify-content: center; align-items: center;
            padding: 20px;
        }
        .card {
            background: white; padding: 40px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 480px; width: 100%; text-align: center;
        }
        .logo {
            width: 80px; height: 80px; background: linear-gradient(135deg, #1a237e, #4a148c);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            margin: 0 auto 20px; font-size: 35px; color: white;
        }
        h1 { color: #1a237e; font-size: 22px; margin-bottom: 5px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 5px; }
        .name { 
            color: #1a237e; font-weight: bold; font-size: 16px; 
            margin: 10px 0; background: #f0f0f0; padding: 8px 20px; 
            border-radius: 25px; display: inline-block;
        }
        .status { 
            background: #d4edda; color: #155724; 
            padding: 12px; border-radius: 8px; margin: 20px 0; 
            font-weight: bold;
        }
        .btn {
            display: block; padding: 15px; margin: 10px 0;
            border-radius: 10px; text-decoration: none; color: white;
            font-weight: bold; font-size: 16px; transition: 0.3s;
        }
        .btn-login { background: #1a237e; }
        .btn-register { background: #28a745; }
        .btn-admin { background: #dc3545; }
        .btn:hover { transform: translateY(-2px); opacity: 0.9; }
        .footer { margin-top: 20px; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">⚗️</div>
        <h1>Advanced Level Chemistry</h1>
        <p class="subtitle">Learning Management System</p>
        <p class="name">👨‍🏫 Buddika Wijesundara</p>
        
        <div class="status">✅ System Online & Running</div>
        
        <a href="/login" class="btn btn-login">🔐 Student Login</a>
        <a href="/register" class="btn btn-register">📝 New Registration</a>
        <a href="/admin/login" class="btn btn-admin">👨‍🏫 Teacher Login</a>
        
        <div class="footer">© 2024 Buddika Wijesundara | Chemistry LMS</div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 📝 STUDENT REGISTER - GET
// ============================================
app.get('/register', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Register - Buddika Wijesundara</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f5f5f5;
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; padding: 20px;
        }
        .box {
            background: white; padding: 35px; border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            width: 100%; max-width: 430px;
        }
        h2 { text-align: center; color: #1a237e; margin-bottom: 5px; }
        .sub { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
        input {
            width: 100%; padding: 14px; margin: 8px 0;
            border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;
        }
        input:focus { border-color: #1a237e; outline: none; }
        .warn {
            background: #fff3cd; color: #856404; padding: 10px;
            border-radius: 5px; font-size: 13px; margin: 10px 0; text-align: center;
            border: 1px solid #ffc107;
        }
        .info {
            background: #e3f2fd; color: #1565c0; padding: 10px;
            border-radius: 5px; font-size: 13px; margin: 10px 0; text-align: center;
        }
        button {
            width: 100%; padding: 14px; background: #28a745;
            color: white; border: none; border-radius: 8px;
            font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px;
        }
        button:hover { background: #218838; }
        .link { text-align: center; margin-top: 15px; }
        .link a { color: #1a237e; text-decoration: none; font-size: 14px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>📝 Student Registration</h2>
        <p class="sub">👨‍🏫 Buddika Wijesundara | Chemistry</p>
        <form action="/register" method="POST">
            <input type="text" name="fullName" placeholder="Full Name" required>
            <input type="email" name="email" placeholder="Email Address" required>
            <input type="tel" name="mobile" placeholder="Mobile Number (0771234567)" pattern="[0-9]{10,12}" required>
            <div class="warn">
                ⚠️ එක Mobile Number = එක Student ID<br>
                One Mobile = Only One Student ID
            </div>
            <div class="info">🆔 Auto Student ID: BC-1001, BC-1002...</div>
            <input type="password" name="password" placeholder="Password (min 6 characters)" minlength="6" required>
            <button type="submit">ලියාපදිංචි වන්න / Register</button>
        </form>
        <div class="link"><a href="/login">Already have account? Login</a></div>
        <div class="link"><a href="/">← Home</a></div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 📝 STUDENT REGISTER - POST
// ============================================
app.post('/register', async (req, res) => {
    try {
        const { fullName, email, mobile, password } = req.body;

        if (!fullName || !email || !mobile || !password) {
            return res.send(`<script>alert('❌ All fields are required!'); window.location.href='/register';</script>`);
        }

        if (!dbConnected) {
            return res.send(`<script>alert('⚠️ Database not connected. Please add PostgreSQL in Railway.'); window.location.href='/register';</script>`);
        }

        // Check mobile
        const [existingMobile] = await db.query(
            `SELECT * FROM users WHERE mobile_number = $1`, { bind: [mobile] }
        );

        if (existingMobile.length > 0) {
            return res.send(`<script>alert('⚠️ This mobile number is already registered!\\n\\nඑක Mobile Number = එක Student ID'); window.location.href='/register';</script>`);
        }

        // Check email
        const [existingEmail] = await db.query(
            `SELECT * FROM users WHERE email = $1`, { bind: [email] }
        );

        if (existingEmail.length > 0) {
            return res.send(`<script>alert('⚠️ This email is already registered!'); window.location.href='/register';</script>`);
        }

        // Generate Student ID
        const [lastStudent] = await db.query(
            `SELECT student_id FROM users WHERE role = 'student' ORDER BY id DESC LIMIT 1`
        );

        let nextNumber = 1001;
        if (lastStudent.length > 0 && lastStudent[0].student_id) {
            const lastNum = parseInt(lastStudent[0].student_id.replace('BC-', ''));
            if (!isNaN(lastNum)) nextNumber = lastNum + 1;
        }
        
        const studentId = `BC-${nextNumber}`;

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert User
        await db.query(
            `INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            {
                bind: [studentId, email.split('@')[0] + '_' + Date.now(), email, hashedPassword, fullName, mobile, 'student', true]
            }
        );

        // Success Page
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Registration Successful</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #1a237e, #4a148c);
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; padding: 20px;
        }
        .card {
            background: white; padding: 40px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 480px; width: 100%; text-align: center;
        }
        .icon { font-size: 70px; margin-bottom: 20px; }
        h1 { color: #28a745; font-size: 24px; margin-bottom: 10px; }
        .id-box {
            font-size: 36px; font-weight: bold; color: #1a237e;
            background: #f0f0f0; padding: 15px; border-radius: 10px;
            margin: 20px 0; letter-spacing: 2px;
        }
        .success {
            background: #d4edda; color: #155724; padding: 15px;
            border-radius: 8px; margin: 20px 0; font-size: 14px;
        }
        .warn {
            background: #fff3cd; color: #856404; padding: 15px;
            border-radius: 8px; margin: 20px 0; font-size: 14px;
        }
        .btn {
            display: inline-block; padding: 14px 30px;
            background: #1a237e; color: white; text-decoration: none;
            border-radius: 8px; font-weight: bold; margin: 10px;
        }
        .btn:hover { background: #0d1457; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">🎉</div>
        <h1>Registration Successful!</h1>
        <p style="color:#666;">Welcome to Buddika Wijesundara Chemistry LMS</p>
        
        <div class="id-box">🆔 ${studentId}</div>
        
        <div class="success">
            ✅ <strong>Name:</strong> ${fullName}<br>
            ✅ <strong>Email:</strong> ${email}<br>
            ✅ <strong>Mobile:</strong> ${mobile}
        </div>
        
        <div class="warn">
            ⚠️ <strong>වැදගත්!</strong><br>
            කරුණාකර ඔබගේ Student ID එක save කරගන්න.<br>
            Payment receipt එක Student ID සමඟ WhatsApp වෙත එවන්න.
        </div>
        
        <a href="/login" class="btn">🔐 Login Now</a>
        <a href="/" class="btn">🏠 Home</a>
    </div>
</body>
</html>
        `);

    } catch (error) {
        console.error('Registration Error:', error);
        res.send(`<script>alert('❌ Registration failed! Error: ${error.message}'); window.location.href='/register';</script>`);
    }
});

// ============================================
// 🔐 STUDENT LOGIN - GET
// ============================================
app.get('/login', (req, res) => {
    if (req.session && req.session.isLoggedIn) {
        return res.redirect('/student/dashboard');
    }
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Login - Buddika Wijesundara</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; padding: 20px;
        }
        .box {
            background: white; padding: 35px; border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            width: 100%; max-width: 400px;
        }
        h2 { text-align: center; color: #1a237e; margin-bottom: 20px; }
        input {
            width: 100%; padding: 14px; margin: 10px 0;
            border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;
        }
        input:focus { border-color: #1a237e; outline: none; }
        button {
            width: 100%; padding: 14px; background: #1a237e;
            color: white; border: none; border-radius: 8px;
            font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px;
        }
        button:hover { background: #0d1457; }
        .link { text-align: center; margin-top: 15px; }
        .link a { color: #1a237e; text-decoration: none; font-size: 14px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>🔐 Student Login</h2>
        <form action="/login" method="POST">
            <input type="text" name="username" placeholder="Email or Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
        <div class="link"><a href="/register">New Student? Register Here</a></div>
        <div class="link"><a href="/">← Back to Home</a></div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔐 STUDENT LOGIN - POST
// ============================================
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!dbConnected) {
            return res.send(`<script>alert('⚠️ Database not connected!'); window.location.href='/login';</script>`);
        }

        const [users] = await db.query(
            `SELECT * FROM users WHERE email = $1 OR username = $1`, { bind: [username] }
        );

        if (users.length === 0) {
            return res.send(`<script>alert('❌ User not found! Please register first.'); window.location.href='/login';</script>`);
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.send(`<script>alert('❌ Wrong password!'); window.location.href='/login';</script>`);
        }

        // Update last login
        await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, { bind: [user.id] });

        // Create session
        req.session.isLoggedIn = true;
        req.session.userId = user.id;
        req.session.studentId = user.student_id;
        req.session.userName = user.full_name;
        req.session.userMobile = user.mobile_number;
        req.session.userRole = user.role;

        if (user.role === 'admin') {
            req.session.isAdminLoggedIn = true;
            req.session.adminName = user.full_name;
            return res.redirect('/admin/dashboard');
        }

        return res.redirect('/student/dashboard');

    } catch (error) {
        console.error('Login Error:', error);
        res.send(`<script>alert('❌ Login failed!'); window.location.href='/login';</script>`);
    }
});

// ============================================
// 👨‍🎓 STUDENT DASHBOARD
// ============================================
app.get('/student/dashboard', studentAuth, (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard - Buddika Wijesundara</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; background: #f0f2f5; }
        .header {
            background: linear-gradient(135deg, #1a237e, #283593);
            color: white; padding: 15px 25px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .header h1 { font-size: 18px; }
        .logout {
            background: #dc3545; color: white; padding: 8px 18px;
            border-radius: 5px; text-decoration: none; font-size: 13px;
        }
        .container { max-width: 700px; margin: 30px auto; padding: 20px; }
        .card {
            background: white; padding: 25px; border-radius: 12px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.08); margin-bottom: 20px;
        }
        .id-badge {
            font-size: 28px; font-weight: bold; color: #1a237e;
            background: #f0f0f0; padding: 12px 25px; border-radius: 10px;
            display: inline-block; margin: 15px 0; letter-spacing: 2px;
        }
        .info-row {
            margin: 12px 0; font-size: 16px; color: #333;
            padding: 10px; background: #f9f9f9; border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>👨‍🎓 Student Dashboard</h1>
        <a href="/logout" class="logout">🚪 Logout</a>
    </div>
    <div class="container">
        <div class="card">
            <h2 style="color:#1a237e;">Welcome, ${req.session.userName}!</h2>
            <div class="id-badge">🆔 ${req.session.studentId}</div>
            
            <div class="info-row"><strong>📧 Email:</strong> User</div>
            <div class="info-row"><strong>📱 Mobile:</strong> ${req.session.userMobile || 'N/A'}</div>
            <div class="info-row"><strong>📚 Course:</strong> Advanced Level Chemistry</div>
            <div class="info-row"><strong>👨‍🏫 Teacher:</strong> Buddika Wijesundara</div>
        </div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔒 ADMIN LOGIN - GET
// ============================================
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdminLoggedIn) {
        return res.redirect('/admin/dashboard');
    }
    
    const errorMsg = req.query.error === '1' ? '❌ Wrong Username or Password!' : '';
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Teacher Login - Buddika Wijesundara</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #1a237e, #0d1457);
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; padding: 20px;
        }
        .box {
            background: white; padding: 40px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            width: 100%; max-width: 400px;
        }
        .icon { text-align: center; font-size: 60px; margin-bottom: 20px; }
        h2 { text-align: center; color: #1a237e; margin-bottom: 5px; }
        .sub { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
        .error {
            background: #f8d7da; color: #721c24; padding: 12px;
            border-radius: 8px; margin-bottom: 20px; text-align: center;
            ${errorMsg ? '' : 'display:none;'}
        }
        input {
            width: 100%; padding: 15px; margin: 10px 0;
            border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;
        }
        input:focus { border-color: #1a237e; outline: none; }
        button {
            width: 100%; padding: 15px; margin-top: 15px;
            background: linear-gradient(135deg, #1a237e, #283593);
            color: white; border: none; border-radius: 10px;
            font-size: 16px; font-weight: bold; cursor: pointer;
        }
        button:hover { transform: translateY(-2px); }
        .link { text-align: center; margin-top: 20px; }
        .link a { color: #1a237e; text-decoration: none; font-size: 14px; }
        .note {
            text-align: center; margin-top: 20px; font-size: 12px;
            color: #999; background: #f5f5f5; padding: 10px; border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="box">
        <div class="icon">🔒</div>
        <h2>👨‍🏫 Teacher Login</h2>
        <p class="sub">Buddika Wijesundara | Chemistry LMS</p>
        
        <div class="error">${errorMsg}</div>
        
        <form action="/admin/login" method="POST">
            <input type="text" name="username" placeholder="👤 Username" required autofocus>
            <input type="password" name="password" placeholder="🔑 Password" required>
            <button type="submit">🔐 Login to Admin Panel</button>
        </form>
        
        <div class="note">🛡️ Restricted Area | Authorized Teacher Only</div>
        <div class="link"><a href="/">← Back to Home</a></div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔒 ADMIN LOGIN - POST
// ============================================
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN.username && password === ADMIN.password) {
        req.session.isAdminLoggedIn = true;
        req.session.adminName = ADMIN.name;
        req.session.loginTime = new Date().toLocaleString();
        console.log(`✅ Admin Login: ${ADMIN.name}`);
        return res.redirect('/admin/dashboard');
    } else {
        console.log(`❌ Failed Admin Login: ${username}`);
        return res.redirect('/admin/login?error=1');
    }
});

// ============================================
// 🔒 ADMIN DASHBOARD
// ============================================
app.get('/admin/dashboard', adminAuth, async (req, res) => {
    let totalStudents = 0;
    let activeStudents = 0;
    
    if (dbConnected) {
        try {
            const [count] = await db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'student'`);
            totalStudents = count[0]?.count || 0;
            
            const [active] = await db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'student' AND is_active = true`);
            activeStudents = active[0]?.count || 0;
        } catch (e) {
            console.error('Count error:', e);
        }
    }
    
    const dbStatus = dbConnected 
        ? '<span style="color:#28a745;">✅ Connected</span>' 
        : '<span style="color:#dc3545;">❌ Not Connected</span>';
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Admin Dashboard - Buddika Wijesundara</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; background: #f0f2f5; }
        .header {
            background: linear-gradient(135deg, #1a237e, #283593);
            color: white; padding: 15px 25px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .header h1 { font-size: 18px; }
        .logout {
            background: #dc3545; color: white; padding: 8px 18px;
            border-radius: 5px; text-decoration: none; font-size: 13px;
        }
        .container { max-width: 1100px; margin: 25px auto; padding: 0 20px; }
        
        .teacher-card {
            background: white; padding: 20px; border-radius: 12px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.08); margin-bottom: 20px;
            display: flex; align-items: center; gap: 15px;
        }
        .avatar {
            width: 55px; height: 55px; background: #1a237e;
            border-radius: 50%; display: flex; align-items: center;
            justify-content: center; font-size: 22px; color: white;
        }
        
        .db-status {
            background: white; padding: 12px 20px; border-radius: 8px;
            margin-bottom: 20px; font-size: 14px;
        }
        
        .cards {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px; margin-bottom: 25px;
        }
        .card {
            background: white; padding: 20px; border-radius: 10px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.08); text-align: center;
        }
        .card h3 { color: #666; font-size: 13px; }
        .card .num { font-size: 32px; font-weight: bold; color: #1a237e; margin: 8px 0; }
        
        .menu { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 25px; }
        .menu a {
            padding: 12px 22px; background: #1a237e; color: white;
            text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold;
        }
        .menu a:hover { background: #0d1457; }
        .menu .warning { background: #ffc107; color: #333; }
        .menu .danger { background: #dc3545; }
        
        table {
            width: 100%; background: white; border-radius: 10px;
            overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        }
        th { background: #1a237e; color: white; padding: 12px; text-align: left; font-size: 13px; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>👨‍🏫 Buddika Wijesundara - Admin Panel</h1>
        <div>
            <span style="font-size:13px; margin-right:10px;">Welcome, ${ADMIN.name}</span>
            <a href="/admin/logout" class="logout">🚪 Logout</a>
        </div>
    </div>
    
    <div class="container">
        <div class="db-status">
            Database Status: ${dbStatus} | 
            Login Time: ${req.session.loginTime || 'Now'}
        </div>
        
        <div class="teacher-card">
            <div class="avatar">👨‍🏫</div>
            <div>
                <h2 style="color:#1a237e;">${ADMIN.name}</h2>
                <p style="color:#666;">Advanced Level Chemistry Teacher</p>
            </div>
        </div>
        
        <div class="cards">
            <div class="card">
                <h3>📊 Total Students</h3>
                <div class="num">${totalStudents}</div>
                <small>Registered</small>
            </div>
            <div class="card">
                <h3>✅ Active Students</h3>
                <div class="num">${activeStudents}</div>
                <small>Active</small>
            </div>
            <div class="card">
                <h3>⏳ Pending Payments</h3>
                <div class="num">0</div>
                <small>Pending</small>
            </div>
            <div class="card">
                <h3>🚨 Inactive</h3>
                <div class="num">0</div>
                <small>7+ days</small>
            </div>
        </div>
        
        <div class="menu">
            <a href="/admin/students">👥 Student List</a>
            <a href="/admin/enrollments">📋 Enrollments</a>
            <a href="/admin/inactivity" class="warning">🚨 Inactive Alerts</a>
            <a href="/admin/analytics">📊 Analytics</a>
            <a href="/">🏠 Home</a>
        </div>
        
        <h3 style="margin-bottom:12px; color:#1a237e;">📋 Student List</h3>
        <table>
            <thead>
                <tr><th>Student ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Status</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="5" style="text-align:center; padding:25px; color:#666;">
                        ${dbConnected ? 'Database Connected - Students will appear here after registration' : '⚠️ Add PostgreSQL Database to see students'}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔒 ADMIN SUB PAGES
// ============================================
app.get('/admin/students', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>👥 Student Management</h1><p>Protected Page for ${ADMIN.name}</p><a href="/admin/dashboard">← Back</a></div>`);
});

app.get('/admin/enrollments', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>📋 Enrollments</h1><p>Protected Page for ${ADMIN.name}</p><a href="/admin/dashboard">← Back</a></div>`);
});

app.get('/admin/inactivity', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>🚨 Inactive Students</h1><p>Protected Page for ${ADMIN.name}</p><a href="/admin/dashboard">← Back</a></div>`);
});

app.get('/admin/analytics', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>📊 Video Analytics</h1><p>Protected Page for ${ADMIN.name}</p><a href="/admin/dashboard">← Back</a></div>`);
});

// ============================================
// 🚪 LOGOUT
// ============================================
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login?msg=logged_out');
    });
});

// Redirect
app.get('/admin', (req, res) => {
    res.redirect('/admin/login');
});

// ============================================
// ❤️ HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'Buddika Wijesundara LMS',
        db: dbConnected ? 'connected' : 'disconnected',
        time: new Date().toISOString()
    });
});

// ============================================
// 🚀 START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('===========================================');
    console.log('⚗️  Buddika Wijesundara - Chemistry LMS');
    console.log('===========================================');
    console.log(`✅ Website: http://localhost:${PORT}`);
    console.log(`📝 Register: http://localhost:${PORT}/register`);
    console.log(`🔐 Student Login: http://localhost:${PORT}/login`);
    console.log(`🔒 Admin Login: http://localhost:${PORT}/admin/login`);
    console.log(`👤 Admin Username: ${ADMIN.username}`);
    console.log(`🔑 Admin Password: ${ADMIN.password}`);
    console.log(`🗄️  Database: ${dbConnected ? '✅ Connected' : '⚠️ Not Connected'}`);
    console.log('===========================================');
});
