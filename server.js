// Buddika Wijesundara LMS - With Password Protection
const express = require('express');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session Setup (Login remember කරන්න)
app.use(session({
    secret: 'Buddika@2024_LMS_Secret_Key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ============================================
// ADMIN CREDENTIALS
// ============================================
const ADMIN_CREDENTIALS = {
    username: 'Buddika',
    password: 'Buddika@2024',
    name: 'Buddika Wijesundara'
};

// ============================================
// MIDDLEWARE: Check if Admin is Logged In
// ============================================
function requireAdminLogin(req, res, next) {
    if (req.session && req.session.isAdminLoggedIn) {
        return next(); // Already logged in → Allow access
    }
    // Not logged in → Redirect to login page
    res.redirect('/admin/login');
}

// ============================================
// HOME PAGE
// ============================================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Buddika Wijesundara - Chemistry LMS</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #1a237e, #4a148c);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .card {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                .logo {
                    width: 80px; height: 80px;
                    background: linear-gradient(135deg, #1a237e, #4a148c);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 35px; color: white;
                }
                h1 { color: #1a237e; font-size: 24px; margin-bottom: 5px; }
                .subtitle { color: #666; font-size: 14px; margin-bottom: 5px; }
                .teacher-name { 
                    color: #1a237e; font-size: 18px; font-weight: bold; 
                    margin-bottom: 15px; background: #f0f0f0;
                    padding: 8px 20px; border-radius: 25px; display: inline-block;
                }
                .status { 
                    background: #d4edda; color: #155724; 
                    padding: 12px; border-radius: 8px; margin: 20px 0; font-weight: bold;
                }
                .btn {
                    display: block; padding: 15px; margin: 10px 0;
                    border-radius: 10px; text-decoration: none;
                    font-weight: bold; font-size: 16px; transition: 0.3s;
                }
                .btn-primary { background: #1a237e; color: white; }
                .btn-success { background: #28a745; color: white; }
                .btn-info { background: #17a2b8; color: white; }
                .btn:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
                .footer { margin-top: 20px; font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="logo">⚗️</div>
                <h1>Advanced Level Chemistry</h1>
                <p class="subtitle">Learning Management System</p>
                <div class="teacher-name">👨‍🏫 Buddika Wijesundara</div>
                
                <div class="status">✅ System Online & Running</div>
                
                <a href="/login" class="btn btn-primary">🔐 Student Login</a>
                <a href="/register" class="btn btn-success">📝 New Registration</a>
                <a href="/admin/login" class="btn btn-info">👨‍🏫 Teacher Login</a>
                
                <div class="footer">
                    © 2024 Buddika Wijesundara | Chemistry LMS
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================
// STUDENT LOGIN PAGE
// ============================================
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Login - Buddika Wijesundara</title>
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
                .login-box {
                    background: white; padding: 40px; border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    width: 100%; max-width: 400px;
                }
                .teacher-badge {
                    text-align: center; margin-bottom: 20px;
                    color: #1a237e; font-weight: bold;
                }
                h2 { text-align: center; color: #1a237e; margin-bottom: 10px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
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
                .link { text-align: center; margin-top: 20px; }
                .link a { color: #1a237e; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <div class="teacher-badge">👨‍🏫 Buddika Wijesundara</div>
                <h2>🔐 Student Login</h2>
                <p class="subtitle">Advanced Level Chemistry</p>
                <form action="/login" method="POST">
                    <input type="text" name="username" placeholder="Email or Username" required>
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                <div class="link">
                    <a href="/register">New Student? Register Here</a>
                </div>
                <div class="link">
                    <a href="/">← Back to Home</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================
// STUDENT REGISTER PAGE
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
                .register-box {
                    background: white; padding: 40px; border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    width: 100%; max-width: 450px;
                }
                .teacher-badge {
                    text-align: center; margin-bottom: 15px;
                    color: #1a237e; font-weight: bold;
                }
                h2 { text-align: center; color: #1a237e; margin-bottom: 5px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
                input {
                    width: 100%; padding: 14px; margin: 8px 0;
                    border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;
                }
                input:focus { border-color: #1a237e; outline: none; }
                .warning {
                    background: #fff3cd; color: #856404;
                    padding: 10px; border-radius: 5px; font-size: 13px;
                    margin: 10px 0; text-align: center; border: 1px solid #ffc107;
                }
                .info {
                    background: #e3f2fd; color: #1565c0;
                    padding: 10px; border-radius: 5px; font-size: 13px;
                    margin: 10px 0; text-align: center;
                }
                button {
                    width: 100%; padding: 14px; background: #28a745;
                    color: white; border: none; border-radius: 8px;
                    font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px;
                }
                button:hover { background: #218838; }
                .link { text-align: center; margin-top: 20px; }
                .link a { color: #1a237e; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="register-box">
                <div class="teacher-badge">👨‍🏫 Buddika Wijesundara</div>
                <h2>📝 Student Registration</h2>
                <p class="subtitle">Advanced Level Chemistry LMS</p>
                <form action="/register" method="POST">
                    <input type="text" name="fullName" placeholder="Full Name" required>
                    <input type="email" name="email" placeholder="Email Address" required>
                    <input type="tel" name="mobile" placeholder="Mobile Number (e.g., 0771234567)" pattern="[0-9]{10,12}" required>
                    
                    <div class="warning">
                        ⚠️ එක Mobile Number = එක Student ID<br>
                        One Mobile = Only One Student ID
                    </div>
                    <div class="info">
                        🆔 Auto Student ID: BC-1001, BC-1002...
                    </div>
                    
                    <input type="password" name="password" placeholder="Password (min 6 characters)" minlength="6" required>
                    <button type="submit">ලියාපදිංචි වන්න / Register</button>
                </form>
                <div class="link">
                    <a href="/login">Already have account? Login</a>
                </div>
                <div class="link">
                    <a href="/">← Back to Home</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================
// 🔐 ADMIN LOGIN PAGE (Password Protected)
// ============================================
app.get('/admin/login', (req, res) => {
    // Already logged in → Go to dashboard
    if (req.session.isAdminLoggedIn) {
        return res.redirect('/admin/dashboard');
    }
    
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
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #1a237e, #0d1457);
                    display: flex; justify-content: center; align-items: center;
                    min-height: 100vh; padding: 20px;
                }
                .login-container {
                    background: white; padding: 40px; border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                    width: 100%; max-width: 420px;
                }
                .lock-icon {
                    text-align: center; font-size: 60px; margin-bottom: 20px;
                }
                h2 { text-align: center; color: #1a237e; margin-bottom: 5px; font-size: 22px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
                
                .error-msg {
                    background: #f8d7da; color: #721c24; padding: 12px;
                    border-radius: 8px; margin-bottom: 20px; text-align: center;
                    font-size: 14px; display: none;
                }
                .error-msg.show { display: block; }
                
                input {
                    width: 100%; padding: 15px; margin: 10px 0;
                    border: 2px solid #e0e0e0; border-radius: 10px;
                    font-size: 16px; transition: 0.3s;
                }
                input:focus { border-color: #1a237e; outline: none; box-shadow: 0 0 0 3px rgba(26,35,126,0.1); }
                
                button {
                    width: 100%; padding: 15px; margin-top: 15px;
                    background: linear-gradient(135deg, #1a237e, #283593);
                    color: white; border: none; border-radius: 10px;
                    font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s;
                }
                button:hover { background: linear-gradient(135deg, #0d1457, #1a237e); transform: translateY(-2px); }
                
                .back-link { text-align: center; margin-top: 25px; }
                .back-link a { color: #1a237e; text-decoration: none; font-size: 14px; }
                .back-link a:hover { text-decoration: underline; }
                
                .security-note {
                    text-align: center; margin-top: 20px; font-size: 12px;
                    color: #999; background: #f5f5f5; padding: 10px; border-radius: 8px;
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <div class="lock-icon">🔒</div>
                <h2>👨‍🏫 Teacher Access Only</h2>
                <p class="subtitle">Buddika Wijesundara - Chemistry LMS</p>
                
                <div class="error-msg" id="errorMsg">
                    ❌ Invalid Username or Password!
                </div>
                
                <form action="/admin/login" method="POST" id="adminLoginForm">
                    <input type="text" name="username" placeholder="👤 Username" required autofocus>
                    <input type="password" name="password" placeholder="🔑 Password" required>
                    <button type="submit">🔐 Login to Admin Panel</button>
                </form>
                
                <div class="security-note">
                    🛡️ This area is restricted to authorized teacher only<br>
                    👨‍🏫 Buddika Wijesundara
                </div>
                
                <div class="back-link">
                    <a href="/">← Back to Home</a>
                </div>
            </div>
            
            <script>
                // Check URL for error
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('error') === '1') {
                    document.getElementById('errorMsg').classList.add('show');
                }
            </script>
        </body>
        </html>
    `);
});

// ============================================
// 🔐 ADMIN LOGIN - POST (Verify Password)
// ============================================
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // Verify credentials
    if (username === ADMIN_CREDENTIALS.username && 
        password === ADMIN_CREDENTIALS.password) {
        
        // Login Success
        req.session.isAdminLoggedIn = true;
        req.session.adminUsername = username;
        req.session.adminName = ADMIN_CREDENTIALS.name;
        req.session.loginTime = new Date().toISOString();
        
        console.log(`✅ Admin Login: ${username} at ${req.session.loginTime}`);
        
        // Redirect to Dashboard
        res.redirect('/admin/dashboard');
    } else {
        // Login Failed
        console.log(`❌ Failed Login Attempt: ${username}`);
        res.redirect('/admin/login?error=1');
    }
});

// ============================================
// 🔒 ADMIN DASHBOARD (Protected)
// ============================================
app.get('/admin/dashboard', requireAdminLogin, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Buddika Wijesundara</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; }
                .header {
                    background: linear-gradient(135deg, #1a237e, #283593);
                    color: white; padding: 20px 30px;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .header h1 { font-size: 20px; }
                .header .user-info { font-size: 14px; text-align: right; }
                .logout-btn {
                    background: #dc3545; color: white; border: none;
                    padding: 8px 20px; border-radius: 5px; cursor: pointer;
                    text-decoration: none; font-size: 13px; margin-left: 10px;
                }
                .logout-btn:hover { background: #c82333; }
                
                .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                
                .teacher-card {
                    background: white; padding: 20px; border-radius: 12px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.08); margin-bottom: 25px;
                    display: flex; align-items: center; gap: 20px;
                }
                .teacher-avatar {
                    width: 60px; height: 60px; background: #1a237e;
                    border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; font-size: 25px; color: white;
                }
                .teacher-info h2 { color: #1a237e; font-size: 20px; }
                .teacher-info p { color: #666; font-size: 14px; }
                
                .cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px; margin-bottom: 30px;
                }
                .card {
                    background: white; padding: 25px; border-radius: 12px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                }
                .card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
                .card .number { font-size: 36px; font-weight: bold; color: #1a237e; }
                
                .menu { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 30px; }
                .menu a {
                    padding: 12px 25px; background: #1a237e; color: white;
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;
                }
                .menu a:hover { background: #0d1457; transform: translateY(-2px); }
                
                .alert-success {
                    background: #d4edda; color: #155724; padding: 15px;
                    border-radius: 8px; margin-bottom: 20px; font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>👨‍🏫 Teacher Dashboard</h1>
                </div>
                <div class="user-info">
                    <div>Welcome, ${req.session.adminName}</div>
                    <div style="font-size:12px; opacity:0.8;">Login: ${req.session.loginTime}</div>
                    <a href="/admin/logout" class="logout-btn">🚪 Logout</a>
                </div>
            </div>
            
            <div class="container">
                <div class="alert-success">
                    🔓 Login Successful! Welcome back, ${req.session.adminName}!
                </div>
                
                <div class="teacher-card">
                    <div class="teacher-avatar">👨‍🏫</div>
                    <div class="teacher-info">
                        <h2>${ADMIN_CREDENTIALS.name}</h2>
                        <p>Advanced Level Chemistry Teacher</p>
                        <p style="color:#28a745; font-weight:bold;">✅ Admin Access Active</p>
                    </div>
                </div>
                
                <div class="cards">
                    <div class="card">
                        <h3>📊 Total Students</h3>
                        <div class="number">0</div>
                        <small>Add database to enable</small>
                    </div>
                    <div class="card">
                        <h3>✅ Active Students</h3>
                        <div class="number">0</div>
                        <small>Add database to enable</small>
                    </div>
                    <div class="card">
                        <h3>⏳ Pending Payments</h3>
                        <div class="number">0</div>
                        <small>Add database to enable</small>
                    </div>
                    <div class="card">
                        <h3>🚨 Inactive (7+ days)</h3>
                        <div class="number">0</div>
                        <small>Add database to enable</small>
                    </div>
                </div>
                
                <div class="menu">
                    <a href="/admin/students">👥 Students</a>
                    <a href="/admin/enrollments">📋 Enrollments</a>
                    <a href="/admin/inactivity">🚨 Inactive Alerts</a>
                    <a href="/admin/analytics">📊 Analytics</a>
                    <a href="/">🏠 Home</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================
// 🔒 OTHER ADMIN PAGES (Protected)
// ============================================
app.get('/admin/students', requireAdminLogin, (req, res) => {
    res.send(`<h1>Student Management</h1><p>Protected page for ${req.session.adminName}</p><a href="/admin/dashboard">Back</a>`);
});

app.get('/admin/enrollments', requireAdminLogin, (req, res) => {
    res.send(`<h1>Enrollments</h1><p>Protected page for ${req.session.adminName}</p><a href="/admin/dashboard">Back</a>`);
});

app.get('/admin/inactivity', requireAdminLogin, (req, res) => {
    res.send(`<h1>Inactive Students</h1><p>Protected page for ${req.session.adminName}</p><a href="/admin/dashboard">Back</a>`);
});

app.get('/admin/analytics', requireAdminLogin, (req, res) => {
    res.send(`<h1>Video Analytics</h1><p>Protected page for ${req.session.adminName}</p><a href="/admin/dashboard">Back</a>`);
});

// ============================================
// 🔓 ADMIN LOGOUT
// ============================================
app.get('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/admin/login?msg=logged_out');
    });
});

// ============================================
// OLD /admin → Redirect to Login
// ============================================
app.get('/admin', (req, res) => {
    res.redirect('/admin/login');
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'Buddika Wijesundara LMS',
        time: new Date().toISOString()
    });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('========================================');
    console.log('⚗️  Buddika Wijesundara - Chemistry LMS');
    console.log('========================================');
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`👨‍🏫 Admin: http://localhost:${PORT}/admin/login`);
    console.log(`🔑 Username: Buddika`);
    console.log(`🔐 Password: Buddika@2024`);
    console.log('========================================');
});
