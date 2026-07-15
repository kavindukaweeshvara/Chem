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
            dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
        });
        db.authenticate().then(async () => {
            dbConnected = true;
            console.log('✅ Database Connected');
            try {
                await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, student_id VARCHAR(50) UNIQUE, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL, mobile_number VARCHAR(20) UNIQUE NOT NULL, nic_number VARCHAR(30), school_name VARCHAR(255), role VARCHAR(20) DEFAULT 'student', is_active BOOLEAN DEFAULT true, last_login_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) DEFAULT 0, status VARCHAR(20) DEFAULT 'draft', created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`DROP TABLE IF EXISTS lessons CASCADE`);
                await db.query(`CREATE TABLE lessons (id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, topic_name VARCHAR(255), zoom_link VARCHAR(500), video_url VARCHAR(500), order_number INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`DROP TABLE IF EXISTS enrollments CASCADE`);
                await db.query(`CREATE TABLE enrollments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', payment_status VARCHAR(20) DEFAULT 'unpaid', payment_proof VARCHAR(500), enrolled_at TIMESTAMP DEFAULT NOW(), expires_at TIMESTAMP, revoked_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS activities (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(100) NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT NOW())`);
                console.log('✅ All tables created');
                const [admin] = await db.query(`SELECT * FROM users WHERE username = 'Buddika'`);
                if (admin.length === 0) {
                    const hash = await bcrypt.hash('Buddika@2024', 12);
                    await db.query(`INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, { bind: ['BC-ADMIN-001', 'Buddika', 'buddika@chemistry.lk', hash, 'Buddika Wijesundara', '94771234567', 'admin', true] });
                    console.log('✅ Admin: Buddika / Buddika@2024');
                }
            } catch (e) { console.error('Table error:', e.message); }
        }).catch(() => { dbConnected = false; });
    }
} catch (e) {}

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET || 'Buddika@2024_LMS', resave: false, saveUninitialized: false, cookie: { secure: false, maxAge: 86400000 } }));

const ADMIN = { username: 'Buddika', password: 'Buddika@2024', name: 'Buddika Wijesundara' };

function adminAuth(req, res, next) { return req.session && req.session.isAdminLoggedIn ? next() : res.redirect('/admin/login'); }
function studentAuth(req, res, next) { return req.session && req.session.isLoggedIn ? next() : res.redirect('/login'); }

// ============================================
// HOME
// ============================================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Buddika Wijesundara | Chemistry LMS</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.card{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:480px;width:100%;text-align:center}.logo{width:80px;height:80px;background:linear-gradient(135deg,#1a237e,#4a148c);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:35px;color:white}h1{color:#1a237e;font-size:22px;margin-bottom:5px}.name{color:#1a237e;font-weight:bold;font-size:16px;margin:10px 0;background:#f0f0f0;padding:8px 20px;border-radius:25px;display:inline-block}.status{background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin:20px 0;font-weight:bold}.btn{display:block;padding:15px;margin:10px 0;border-radius:10px;text-decoration:none;color:white;font-weight:bold;font-size:16px}.btn-login{background:#1a237e}.btn-register{background:#28a745}.btn-admin{background:#dc3545}.btn:hover{opacity:0.9}.footer{margin-top:20px;font-size:12px;color:#999}</style></head><body><div class="card"><div class="logo">⚗️</div><h1>Advanced Level Chemistry</h1><p style="color:#666;font-size:14px">Learning Management System</p><p class="name">👨‍🏫 Buddika Wijesundara</p><div class="status">✅ System Online</div><a href="/login" class="btn btn-login">🔐 Student Login</a><a href="/register" class="btn btn-register">📝 New Registration</a><a href="/admin/login" class="btn btn-admin">👨‍🏫 Teacher Login</a><div class="footer">© 2024 Buddika Wijesundara</div></div></body></html>`);
});

// ============================================
// REGISTER GET
// ============================================
app.get('/register', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Register - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:430px}h2{text-align:center;color:#1a237e;margin-bottom:5px}.sub{text-align:center;color:#666;margin-bottom:20px;font-size:14px}input{width:100%;padding:14px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}input:focus{border-color:#1a237e;outline:none}.warn{background:#fff3cd;color:#856404;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}.info{background:#e3f2fd;color:#1565c0;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}button:hover{background:#218838}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}</style></head><body><div class="box"><h2>📝 Student Registration</h2><p class="sub">👨‍🏫 Buddika Wijesundara | Chemistry</p><form action="/register" method="POST"><input type="text" name="fullName" placeholder="Full Name" required><input type="email" name="email" placeholder="Email" required><input type="tel" name="mobile" placeholder="Mobile (0771234567)" pattern="[0-9]{10,12}" required><div class="warn">⚠️ One Mobile = One Student ID</div><div class="info">🆔 Auto ID: BC-1001, BC-1002...</div><input type="password" name="password" placeholder="Password (min 6)" minlength="6" required><button type="submit">Register</button></form><div class="link"><a href="/login">Already have account? Login</a></div><div class="link"><a href="/">← Home</a></div></div></body></html>`);
});

// ============================================
// REGISTER POST
// ============================================
app.post('/register', async (req, res) => {
    try {
        const { fullName, email, mobile, password } = req.body;
        if (!fullName || !email || !mobile || !password) return res.send(`<script>alert('All fields required!');window.location.href='/register'</script>`);
        if (!dbConnected) return res.send(`<script>alert('Database not connected!');window.location.href='/register'</script>`);
        const [mob] = await db.query(`SELECT * FROM users WHERE mobile_number = $1`, { bind: [mobile] });
        if (mob.length > 0) return res.send(`<script>alert('Mobile already registered!');window.location.href='/register'</script>`);
        const [em] = await db.query(`SELECT * FROM users WHERE email = $1`, { bind: [email] });
        if (em.length > 0) return res.send(`<script>alert('Email already registered!');window.location.href='/register'</script>`);
        const [last] = await db.query(`SELECT student_id FROM users WHERE role='student' ORDER BY id DESC LIMIT 1`);
        let num = 1001;
        if (last.length > 0 && last[0].student_id) { const n = parseInt(last[0].student_id.replace('BC-', '')); if (!isNaN(n)) num = n + 1; }
        const sid = 'BC-' + num;
        const hash = await bcrypt.hash(password, 12);
        await db.query(`INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, { bind: [sid, email.split('@')[0] + '_' + Date.now(), email, hash, fullName, mobile, 'student', true] });
        res.send(`<!DOCTYPE html><html><head><title>Success!</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:480px;width:100%;text-align:center}.icon{font-size:70px;margin-bottom:20px}h1{color:#28a745;font-size:24px;margin-bottom:10px}.id-box{font-size:36px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:15px;border-radius:10px;margin:20px 0}.success{background:#d4edda;color:#155724;padding:15px;border-radius:8px;margin:20px 0;font-size:14px}.warn{background:#fff3cd;color:#856404;padding:15px;border-radius:8px;margin:20px 0;font-size:14px}.btn{display:inline-block;padding:14px 30px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}</style></head><body><div class="card"><div class="icon">🎉</div><h1>Registration Successful!</h1><div class="id-box">🆔 ${sid}</div><div class="success">✅ Name: ${fullName}<br>✅ Email: ${email}<br>✅ Mobile: ${mobile}</div><div class="warn">⚠️ Save your Student ID!<br>Send payment receipt with Student ID via WhatsApp.</div><a href="/login" class="btn">🔐 Login Now</a><a href="/" class="btn">🏠 Home</a></div></body></html>`);
    } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/register'</script>`); }
});

// ============================================
// LOGIN GET
// ============================================
app.get('/login', (req, res) => {
    if (req.session && req.session.isLoggedIn) return res.redirect('/student/dashboard');
    res.send(`<!DOCTYPE html><html><head><title>Login - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:400px}h2{text-align:center;color:#1a237e;margin-bottom:20px}input{width:100%;padding:14px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}input:focus{border-color:#1a237e;outline:none}button{width:100%;padding:14px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}button:hover{background:#0d1457}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}</style></head><body><div class="box"><h2>🔐 Student Login</h2><form action="/login" method="POST"><input type="text" name="username" placeholder="Email or Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form><div class="link"><a href="/register">New Student? Register</a></div><div class="link"><a href="/">← Home</a></div></div></body></html>`);
});

// ============================================
// LOGIN POST
// ============================================
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!dbConnected) return res.send(`<script>alert('Database not connected!');window.location.href='/login'</script>`);
        const [users] = await db.query(`SELECT * FROM users WHERE email = $1 OR username = $1`, { bind: [username] });
        if (users.length === 0) return res.send(`<script>alert('User not found!');window.location.href='/login'</script>`);
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.send(`<script>alert('Wrong password!');window.location.href='/login'</script>`);
        await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, { bind: [user.id] });
        req.session.isLoggedIn = true;
        req.session.userId = user.id;
        req.session.studentId = user.student_id;
        req.session.userName = user.full_name;
        req.session.userMobile = user.mobile_number;
        req.session.userRole = user.role;
        if (user.role === 'admin') { req.session.isAdminLoggedIn = true; req.session.adminName = user.full_name; return res.redirect('/admin/dashboard'); }
        return res.redirect('/student/dashboard');
    } catch (e) { res.send(`<script>alert('Login failed!');window.location.href='/login'</script>`); }
});

// ============================================
// STUDENT DASHBOARD
// ============================================
app.get('/student/dashboard', studentAuth, async (req, res) => {
    let hasActiveEnrollment = false;
    if (dbConnected) { try { const [e] = await db.query(`SELECT * FROM enrollments WHERE user_id=$1 AND status='active' AND payment_status='verified' LIMIT 1`, { bind: [req.session.userId] }); hasActiveEnrollment = e.length > 0; } catch(e) {} }
    res.send(`<!DOCTYPE html><html><head><title>Dashboard</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:700px;margin:30px auto;padding:20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}.id-badge{font-size:28px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:12px 25px;border-radius:10px;display:inline-block;margin:15px 0}.info-row{margin:12px 0;font-size:16px;color:#333;padding:10px;background:#f9f9f9;border-radius:5px}.btn-courses{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px 5px}.btn-pay{background:#25D366}.status-badge{padding:5px 15px;border-radius:20px;font-size:13px;font-weight:bold;display:inline-block;margin:10px 0}.paid{background:#d4edda;color:#155724}.unpaid{background:#f8d7da;color:#721c24}</style></head><body><div class="header"><h1>👨‍🎓 Student Dashboard</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="card"><h2 style="color:#1a237e">Welcome, ${req.session.userName}!</h2><div class="id-badge">🆔 ${req.session.studentId}</div><div class="info-row"><strong>📱 Mobile:</strong> ${req.session.userMobile || 'N/A'}</div><div class="info-row"><strong>📚 Course:</strong> Advanced Level Chemistry</div><div class="info-row"><strong>👨‍🏫 Teacher:</strong> Buddika Wijesundara</div><div class="info-row"><strong>Payment Status:</strong> <span class="status-badge ${hasActiveEnrollment ? 'paid' : 'unpaid'}">${hasActiveEnrollment ? '✅ Paid & Active' : '❌ Payment Required'}</span></div><a href="/student/courses" class="btn-courses">📚 View Courses</a><a href="/student/payment" class="btn-courses btn-pay">💰 Make Payment</a></div></div></body></html>`);
});

// ============================================
// STUDENT - PAYMENT PAGE
// ============================================
app.get('/student/payment', studentAuth, (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Payment - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);max-width:500px;width:100%;text-align:center}h2{color:#1a237e;margin-bottom:15px}.bank-details{background:#f9f9f9;padding:20px;border-radius:10px;margin:20px 0;text-align:left}.bank-details p{margin:8px 0;font-size:15px}.highlight{background:#fff3cd;color:#856404;padding:15px;border-radius:8px;margin:20px 0;font-size:14px}.btn-wa{display:inline-block;padding:14px 30px;background:#25D366;color:white;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;margin:10px}.btn-back{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}</style></head><body><div class="card"><h2>💰 Payment Details</h2><p style="color:#666;">Buddika Wijesundara - Chemistry LMS</p><div class="bank-details"><h3 style="color:#1a237e;margin-bottom:10px;">🏦 Bank Details</h3><p><strong>Bank:</strong> Sampath Bank</p><p><strong>Account Name:</strong> B Wijesundara</p><p><strong>Account Number:</strong> 1234567890</p><p><strong>Branch:</strong> Kuruneegala</p></div><div class="highlight"><strong>📱 Payment කළ පසු:</strong><br>1. Screenshot/Receipt එක ගන්න<br>2. පහත WhatsApp Button click කරන්න<br>3. Receipt + Student ID (${req.session.studentId}) send කරන්න</div><a href="https://wa.me/94740231163?text=Payment%20Receipt%20-%20Student%20ID:%20${req.session.studentId}%20-%20Name:%20${encodeURIComponent(req.session.userName)}" target="_blank" class="btn-wa">📱 Send Receipt via WhatsApp</a><br><a href="/student/dashboard" class="btn-back">← Back to Dashboard</a></div></body></html>`);
});

// ============================================
// STUDENT - VIEW COURSES
// ============================================
app.get('/student/courses', studentAuth, async (req, res) => {
    let courses = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM courses WHERE status='published' ORDER BY created_at DESC`); courses = rows; } catch(e) {} }
    let courseCards = '';
    if (courses.length > 0) { courses.forEach(c => { courseCards += `<div class="course-card"><h3>📚 ${c.title}</h3><p style="color:#666;">${c.description || ''}</p><p style="font-size:13px;color:#999;">Price: Rs.${c.price || 0}</p><a href="/s
