// ============================================
// BUDDIKA WIJESUNDARA LMS - COMPLETE FIX
// Admin Password + Database Optional
// ============================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE SETUP (Optional)
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
                console.log('✅ Database connected');
            })
            .catch(err => {
                console.log('⚠️ Database not available - running basic mode');
                dbConnected = false;
            });
    } else {
        console.log('⚠️ No DATABASE_URL - running basic mode');
    }
} catch (error) {
    console.log('⚠️ Database module not available - running basic mode');
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'Buddika@2024_LMS_Secret',
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
// MIDDLEWARE: Admin Login Check
// ============================================
function adminAuth(req, res, next) {
    if (req.session && req.session.isAdminLoggedIn) {
        return next();
    }
    return res.redirect('/admin/login?error=please_login');
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
            font-family: Arial, sans-serif;
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
        .name { color: #1a237e; font-weight: bold; font-size: 16px; margin: 10px 0; }
        .status { background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin: 20px 0; }
        .btn {
            display: block; padding: 15px; margin: 10px 0;
            border-radius: 10px; text-decoration: none; color: white;
            font-weight: bold; font-size: 16px;
        }
        .btn-login { background: #1a237e; }
        .btn-register { background: #28a745; }
        .btn-admin { background: #dc3545; }
        .btn:hover { opacity: 0.9; transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">⚗️</div>
        <h1>Advanced Level Chemistry</h1>
        <p class="name">👨‍🏫 Buddika Wijesundara</p>
        <div class="status">✅ System Online</div>
        <a href="/login" class="btn btn-login">🔐 Student Login</a>
        <a href="/register" class="btn btn-register">📝 New Registration</a>
        <a href="/admin/login" class="btn btn-admin">👨‍🏫 Teacher Login</a>
    </div>
</body>
</html>
    `);
});

// ============================================
// 📝 STUDENT REGISTER
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
            font-family: Arial, sans-serif; background: #f5f5f5;
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
            <div class="warn">⚠️ එක Mobile Number = එක Student ID</div>
            <div class="info">🆔 Auto Student ID: BC-1001, BC-1002...</div>
            <input type="password" name="password" placeholder="Password (min 6)" minlength="6" required>
            <button type="submit">Register</button>
        </form>
        <div class="link"><a href="/login">Already have account? Login</a></div>
        <div class="link"><a href="/">← Home</a></div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔐 STUDENT LOGIN
// ============================================
app.get('/login', (req, res) => {
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
            font-family: Arial, sans-serif; background: #f5f5f5;
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
        <div class="link"><a href="/register">New Student? Register</a></div>
        <div class="link"><a href="/">← Home</a></div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔒 ADMIN LOGIN PAGE
// ============================================
app.get('/admin/login', (req, res) => {
    // Already logged in → Go to dashboard
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
            <button type="submit">🔐 Login</button>
        </form>
        
        <div class="note">🛡️ Restricted Area | Authorized Teacher Only</div>
        <div class="link"><a href="/">← Back to Home</a></div>
    </div>
</body>
</html>
    `);
});

// ============================================
// 🔐 ADMIN LOGIN VERIFY
// ============================================
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN.username && password === ADMIN.password) {
        req.session.isAdminLoggedIn = true;
        req.session.adminName = ADMIN.name;
        req.session.loginTime = new Date().toLocaleString();
        console.log(`✅ Admin Login Success: ${ADMIN.name}`);
        return res.redirect('/admin/dashboard');
    } else {
        console.log(`❌ Failed Login: ${username}`);
        return res.redirect('/admin/login?error=1');
    }
});

// ============================================
// 🔒 ADMIN DASHBOARD (Protected)
// ============================================
app.get('/admin/dashboard', adminAuth, (req, res) => {
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
        .logout:hover { background: #c82333; }
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
        .menu .danger { background: #dc3545; }
        .menu .warning { background: #ffc107; color: #333; }
        
        table {
            width: 100%; background: white; border-radius: 10px;
            overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        }
        th { background: #1a237e; color: white; padding: 12px; text-align: left; font-size: 13px; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        
        .db-status {
            background: white; padding: 12px 20px; border-radius: 8px;
            margin-bottom: 20px; font-size: 14px;
        }
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
            Login Time: ${req.session.loginTime}
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
                <div class="num">0</div>
                <small>${dbConnected ? 'Loading...' : 'Add Database'}</small>
            </div>
            <div class="card">
                <h3>✅ Active Students</h3>
                <div class="num">0</div>
                <small>${dbConnected ? 'Loading...' : 'Add Database'}</small>
            </div>
            <div class="card">
                <h3>⏳ Pending</h3>
                <div class="num">0</div>
                <small>${dbConnected ? 'Loading...' : 'Add Database'}</small>
            </div>
            <div class="card">
                <h3>🚨 Inactive</h3>
                <div class="num">0</div>
                <small>${dbConnected ? 'Loading...' : 'Add Database'}</small>
            </div>
        </div>
        
        <div class="menu">
            <a href="/admin/students">👥 Students</a>
            <a href="/admin/enrollments">📋 Enrollments</a>
            <a href="/admin/inactivity" class="warning">🚨 Inactive Alerts</a>
            <a href="/admin/analytics">📊 Analytics</a>
            <a href="/">🏠 Home</a>
        </div>
        
        <h3 style="margin-bottom:12px; color:#1a237e;">📋 Recent Activity</h3>
        <table>
            <thead>
                <tr><th>Student ID</th><th>Name</th><th>Action</th><th>Time</th><th>Status</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="5" style="text-align:center; padding:25px; color:#666;">
                        ${dbConnected 
                            ? '✅ Database Connected - Ready to use! <br><small>Run: npm run seed (to create admin) then npm run migrate</small>'
                            : '⚠️ Database not connected<br><small>Add PostgreSQL in Railway to enable all features</small>'
                        }
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
    res.send(`<div style="padding:30px;"><h1>👥 Student Management</h1><p>Protected Page</p><a href="/admin/dashboard">← Back</a></div>`);
});

app.get('/admin/enrollments', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>📋 Enrollments</h1><p>Protected Page</p><a href="/admin/dashboard">← Back</a></div>`);
});

app.get('/admin/inactivity', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>🚨 Inactive Students</h1><p>Protected Page</p><a href="/admin/dashboard">← Back</a></div>`);
});

app.get('/admin/analytics', adminAuth, (req, res) => {
    res.send(`<div style="padding:30px;"><h1>📊 Video Analytics</h1><p>Protected Page</p><a href="/admin/dashboard">← Back</a></div>`);
});

// ============================================
// 🚪 ADMIN LOGOUT
// ============================================
app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login?msg=logged_out');
    });
});

// Redirect /admin to /admin/login
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
        db: dbConnected ? 'connected' : 'not connected',
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
    console.log(`🔒 Admin:  http://localhost:${PORT}/admin/login`);
    console.log(`👤 Username: ${ADMIN.username}`);
    console.log(`🔑 Password: ${ADMIN.password}`);
    console.log(`🗄️  Database: ${dbConnected ? '✅ Connected' : '⚠️ Not Connected'}`);
    console.log('===========================================');
});
