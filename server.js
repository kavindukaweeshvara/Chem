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
                // Users table
                await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, student_id VARCHAR(50) UNIQUE, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL, mobile_number VARCHAR(20) UNIQUE NOT NULL, nic_number VARCHAR(30), school_name VARCHAR(255), role VARCHAR(20) DEFAULT 'student', is_active BOOLEAN DEFAULT true, last_login_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
                
                // Courses table
                await db.query(`CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) DEFAULT 0, status VARCHAR(20) DEFAULT 'draft', created_at TIMESTAMP DEFAULT NOW())`);
                
                // Lessons table - FIXED with video_url column
                await db.query(`DROP TABLE IF EXISTS lessons CASCADE`);
                await db.query(`CREATE TABLE lessons (id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, topic_name VARCHAR(255), zoom_link VARCHAR(500), video_url VARCHAR(500), order_number INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
                
                // Enrollments table
                await db.query(`CREATE TABLE IF NOT EXISTS enrollments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), course_id INTEGER REFERENCES courses(id), status VARCHAR(20) DEFAULT 'pending', payment_status VARCHAR(20) DEFAULT 'unpaid', enrolled_at TIMESTAMP DEFAULT NOW(), expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);
                
                // Activities table
                await db.query(`CREATE TABLE IF NOT EXISTS activities (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(100) NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT NOW())`);
                
                console.log('✅ All tables created');
                
                // Create admin user
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
app.get('/student/dashboard', studentAuth, (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Dashboard - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:700px;margin:30px auto;padding:20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}.id-badge{font-size:28px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:12px 25px;border-radius:10px;display:inline-block;margin:15px 0}.info-row{margin:12px 0;font-size:16px;color:#333;padding:10px;background:#f9f9f9;border-radius:5px}.btn-courses{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:15px}</style></head><body><div class="header"><h1>👨‍🎓 Student Dashboard</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="card"><h2 style="color:#1a237e">Welcome, ${req.session.userName}!</h2><div class="id-badge">🆔 ${req.session.studentId}</div><div class="info-row"><strong>📱 Mobile:</strong> ${req.session.userMobile || 'N/A'}</div><div class="info-row"><strong>📚 Course:</strong> Advanced Level Chemistry</div><div class="info-row"><strong>👨‍🏫 Teacher:</strong> Buddika Wijesundara</div><a href="/student/courses" class="btn-courses">📚 View My Courses</a></div></div></body></html>`);
});

// ============================================
// STUDENT - VIEW COURSES
// ============================================
app.get('/student/courses', studentAuth, async (req, res) => {
    let courses = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM courses WHERE status='published' ORDER BY created_at DESC`); courses = rows; } catch(e) {} }
    let courseCards = '';
    if (courses.length > 0) {
        courses.forEach(c => { courseCards += `<div class="course-card"><h3>📚 ${c.title}</h3><p style="color:#666;">${c.description || ''}</p><p style="font-size:13px;color:#999;">Price: Rs.${c.price || 0}</p><a href="/student/courses/${c.id}/lessons" class="btn">📖 View Lessons</a></div>`; });
    } else { courseCards = '<p style="text-align:center;color:#666;padding:30px;">No courses available yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>Courses - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:900px;margin:25px auto;padding:0 20px}h2{color:#1a237e;margin-bottom:20px}.course-card{background:white;padding:20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:15px}.course-card h3{color:#1a237e;margin-bottom:8px}.btn{display:inline-block;padding:10px 22px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;margin-top:10px}</style></head><body><div class="header"><h1>👨‍🎓 ${req.session.userName}</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><h2>📚 My Courses</h2>${courseCards}<div style="text-align:center;margin-top:20px;"><a href="/student/dashboard">← Dashboard</a></div></div></body></html>`);
});

// ============================================
// STUDENT - VIEW LESSONS (Live + Recording Cards)
// ============================================
app.get('/student/courses/:courseId/lessons', studentAuth, async (req, res) => {
    const courseId = req.params.courseId;
    let course = { title: 'Course' };
    let lessons = [];
    if (dbConnected) {
        try {
            const [c] = await db.query(`SELECT * FROM courses WHERE id=$1`, { bind: [courseId] });
            if (c.length > 0) course = c[0];
            const [l] = await db.query(`SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_number`, { bind: [courseId] });
            lessons = l;
        } catch(e) {}
    }
    let lessonCards = '';
    if (lessons.length > 0) {
        lessons.forEach(l => {
            lessonCards += `<div class="lesson-card"><h3>📖 ${l.title}</h3><p class="topic-name">📚 ${l.topic_name || 'Advanced Level Chemistry'}</p><div class="actions">${l.zoom_link ? `<a href="${l.zoom_link}" target="_blank" class="action-box live-box"><span class="icon">📡</span><span class="label">Live Session</span><span class="desc">Join Zoom Meeting</span></a>` : `<div class="action-box live-box inactive"><span class="icon">📡</span><span class="label">Live Session</span><span class="desc">Not Available</span></div>`}${l.video_url ? `<a href="${l.video_url}" target="_blank" class="action-box recording-box"><span class="icon">🎬</span><span class="label">Watch Recording</span><span class="desc">Secured Video</span></a>` : `<div class="action-box recording-box inactive"><span class="icon">🎬</span><span class="label">Watch Recording</span><span class="desc">Not Available</span></div>`}</div></div>`;
        });
    } else { lessonCards = '<p style="text-align:center;color:#666;padding:30px;">No lessons available yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>${course.title} - Lessons</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:800px;margin:25px auto;padding:0 20px}h2{color:#1a237e;margin-bottom:5px}.topic{color:#666;margin-bottom:25px}.lesson-card{background:white;padding:25px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08);margin-bottom:20px}.lesson-card h3{color:#1a237e;margin-bottom:5px}.topic-name{color:#2563eb;font-weight:bold;font-size:14px;margin-bottom:20px;background:#eff6ff;padding:8px 15px;border-radius:20px;display:inline-block}.actions{display:flex;gap:20px;flex-wrap:wrap}.action-box{flex:1;min-width:200px;padding:25px 20px;border-radius:12px;text-align:center;text-decoration:none;color:white;transition:0.3s;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer}.action-box:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(0,0,0,0.15)}.live-box{background:linear-gradient(135deg,#dc3545,#c82333)}.recording-box{background:linear-gradient(135deg,#1a237e,#283593)}.inactive{opacity:0.5;cursor:not-allowed;pointer-events:none}.icon{font-size:40px}.label{font-size:18px;font-weight:bold}.desc{font-size:13px;opacity:0.9}</style></head><body><div class="header"><h1>📚 ${course.title}</h1><a href="/student/courses" class="back">← Courses</a></div><div class="container"><h2>Lessons</h2><p class="topic">👨‍🏫 Buddika Wijesundara | Chemistry</p>${lessonCards}</div></body></html>`);
});

// ============================================
// ADMIN LOGIN GET
// ============================================
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdminLoggedIn) return res.redirect('/admin/dashboard');
    const err = req.query.error === '1' ? '❌ Wrong Username or Password!' : '';
    res.send(`<!DOCTYPE html><html><head><title>Teacher Login</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#0d1457);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.4);width:100%;max-width:400px}.icon{text-align:center;font-size:60px;margin-bottom:20px}h2{text-align:center;color:#1a237e;margin-bottom:5px}.sub{text-align:center;color:#666;margin-bottom:25px;font-size:14px}.error{background:#f8d7da;color:#721c24;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;${err?'':'display:none'}}input{width:100%;padding:15px;margin:10px 0;border:2px solid #e0e0e0;border-radius:10px;font-size:16px}input:focus{border-color:#1a237e;outline:none}button{width:100%;padding:15px;margin-top:15px;background:linear-gradient(135deg,#1a237e,#283593);color:white;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer}button:hover{transform:translateY(-2px)}.link{text-align:center;margin-top:20px}.link a{color:#1a237e;text-decoration:none;font-size:14px}.note{text-align:center;margin-top:20px;font-size:12px;color:#999;background:#f5f5f5;padding:10px;border-radius:8px}</style></head><body><div class="box"><div class="icon">🔒</div><h2>👨‍🏫 Teacher Login</h2><p class="sub">Buddika Wijesundara | Chemistry LMS</p><div class="error">${err}</div><form action="/admin/login" method="POST"><input type="text" name="username" placeholder="👤 Username" required autofocus><input type="password" name="password" placeholder="🔑 Password" required><button type="submit">🔐 Login</button></form><div class="note">🛡️ Authorized Teacher Only</div><div class="link"><a href="/">← Home</a></div></div></body></html>`);
});

// ============================================
// ADMIN LOGIN POST
// ============================================
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN.username && password === ADMIN.password) {
        req.session.isAdminLoggedIn = true;
        req.session.adminName = ADMIN.name;
        req.session.loginTime = new Date().toLocaleString();
        return res.redirect('/admin/dashboard');
    }
    return res.redirect('/admin/login?error=1');
});

// ============================================
// ADMIN DASHBOARD
// ============================================
app.get('/admin/dashboard', adminAuth, async (req, res) => {
    let total = 0;
    if (dbConnected) { try { const [c] = await db.query(`SELECT COUNT(*) as count FROM users WHERE role='student'`); total = c[0]?.count || 0; } catch(e) {} }
    const dbStatus = dbConnected ? '<span style="color:#28a745">✅ Connected</span>' : '<span style="color:#dc3545">❌ Not Connected</span>';
    res.send(`<!DOCTYPE html><html><head><title>Admin - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:1100px;margin:25px auto;padding:0 20px}.teacher-card{background:white;padding:20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px;display:flex;align-items:center;gap:15px}.avatar{width:55px;height:55px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:white}.db-status{background:white;padding:12px 20px;border-radius:8px;margin-bottom:20px;font-size:14px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:25px}.card{background:white;padding:20px;border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,0.08);text-align:center}.card h3{color:#666;font-size:13px}.card .num{font-size:32px;font-weight:bold;color:#1a237e;margin:8px 0}.menu{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:25px}.menu a{padding:12px 22px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold}.menu a:hover{background:#0d1457}.menu .green{background:#28a745}.menu .warning{background:#ffc107;color:#333}</style></head><body><div class="header"><h1>👨‍🏫 Buddika Wijesundara - Admin</h1><div><span style="font-size:13px;margin-right:10px">${ADMIN.name}</span><a href="/admin/logout" class="logout">🚪 Logout</a></div></div><div class="container"><div class="db-status">Database: ${dbStatus}</div><div class="teacher-card"><div class="avatar">👨‍🏫</div><div><h2 style="color:#1a237e">${ADMIN.name}</h2><p style="color:#666">Advanced Level Chemistry</p></div></div><div class="cards"><div class="card"><h3>📊 Total Students</h3><div class="num">${total}</div></div><div class="card"><h3>✅ Active</h3><div class="num">${total}</div></div><div class="card"><h3>⏳ Pending</h3><div class="num">0</div></div><div class="card"><h3>🚨 Inactive</h3><div class="num">0</div></div></div><div class="menu"><a href="/admin/courses" class="green">📚 Manage Courses</a><a href="/admin/students">👥 Students</a><a href="/admin/enrollments">📋 Enrollments</a><a href="/admin/inactivity" class="warning">🚨 Inactive Alerts</a><a href="/admin/analytics">📊 Analytics</a><a href="/">🏠 Home</a></div></div></body></html>`);
});

// ============================================
// ADMIN - COURSES PAGE
// ============================================
app.get('/admin/courses', adminAuth, async (req, res) => {
    let courses = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM courses ORDER BY created_at DESC`); courses = rows; } catch(e) {} }
    let courseCards = '';
    if (courses.length > 0) {
        courses.forEach(c => { courseCards += `<div class="course-card"><h3>📚 ${c.title}</h3><p style="color:#666;margin:8px 0;">${c.description || 'No description'}</p><p style="font-size:13px;color:#999;">Price: Rs.${c.price || 0} | Status: ${c.status}</p><div style="margin-top:15px;"><a href="/admin/courses/${c.id}/lessons" class="btn-small">📖 Lessons</a><a href="/admin/courses/delete/${c.id}" class="btn-small btn-danger" onclick="return confirm('Delete?')">🗑️</a></div></div>`; });
    } else { courseCards = '<p style="color:#666;text-align:center;padding:30px;">No courses yet. Create your first course!</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>Courses - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:20px}input,textarea,select{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;margin-top:10px}.course-card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:15px}.course-card h3{color:#1a237e;margin-bottom:5px}.btn-small{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin:3px;background:#1a237e;color:white}.btn-danger{background:#dc3545}</style></head><body><div class="header"><h1>📚 Course Management</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>➕ Create New Course</h2><form action="/admin/courses/create" method="POST"><input type="text" name="title" placeholder="Course Title (e.g., 2026 Revision Chemistry)" required><textarea name="description" placeholder="Course Description" rows="3"></textarea><input type="number" name="price" placeholder="Price (Rs.)" value="0"><select name="status"><option value="published">Published</option><option value="draft">Draft</option></select><button type="submit">➕ Create Course</button></form></div><h2 style="color:#1a237e;margin:20px 0;">📖 All Courses</h2>${courseCards}</div></body></html>`);
});

// CREATE COURSE
app.post('/admin/courses/create', adminAuth, async (req, res) => {
    const { title, description, price, status } = req.body;
    if (!title) return res.send(`<script>alert('Title required!');window.location.href='/admin/courses'</script>`);
    if (dbConnected) { await db.query(`INSERT INTO courses (title, description, price, status) VALUES ($1,$2,$3,$4)`, { bind: [title, description, price, status] }); }
    res.redirect('/admin/courses');
});

// DELETE COURSE
app.get('/admin/courses/delete/:id', adminAuth, async (req, res) => {
    if (dbConnected) { await db.query(`DELETE FROM courses WHERE id=$1`, { bind: [req.params.id] }); }
    res.redirect('/admin/courses');
});

// ============================================
// ADMIN - LESSONS PAGE
// ============================================
app.get('/admin/courses/:courseId/lessons', adminAuth, async (req, res) => {
    const courseId = req.params.courseId;
    let course = { title: 'Unknown' };
    let lessons = [];
    if (dbConnected) {
        try {
            const [c] = await db.query(`SELECT * FROM courses WHERE id=$1`, { bind: [courseId] });
            if (c.length > 0) course = c[0];
            const [l] = await db.query(`SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_number`, { bind: [courseId] });
            lessons = l;
        } catch(e) {}
    }
    let lessonList = '';
    if (lessons.length > 0) {
        lessons.forEach(l => { lessonList += `<div class="lesson-card"><div><strong style="color:#1a237e;">📖 ${l.title}</strong><span style="background:#e3f2fd;color:#1565c0;padding:3px 10px;border-radius:12px;font-size:12px;margin-left:10px;">${l.topic_name || 'No Topic'}</span>${l.zoom_link ? '<br><small style="color:#28a745;">📡 Zoom: ' + l.zoom_link.substring(0,50) + '...</small>' : ''}${l.video_url ? '<br><small style="color:#2563eb;">🎬 Video: ' + l.video_url.substring(0,50) + '...</small>' : ''}</div><div><a href="/admin/lessons/delete/${l.id}?courseId=${courseId}" class="btn-small btn-danger" onclick="return confirm('Delete?')">🗑️</a></div></div>`; });
    } else { lessonList = '<p style="color:#666;text-align:center;padding:20px;">No lessons yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>Lessons - ${course.title}</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:900px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:20px}input,textarea{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;margin-top:10px}.lesson-card{background:white;padding:15px 20px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.05);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}.btn-small{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin:3px;background:#1a237e;color:white}.btn-danger{background:#dc3545}.info-box{background:#e3f2fd;color:#1565c0;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px}</style></head><body><div class="header"><h1>📖 Lessons: ${course.title}</h1><a href="/admin/courses" class="back">← Courses</a></div><div class="container"><div class="info-box">💡 Zoom Link = Live Session | Video URL = Recording</div><div class="card"><h2>➕ Add New Lesson</h2><form action="/admin/lessons/create" method="POST"><input type="hidden" name="courseId" value="${courseId}"><input type="text" name="title" placeholder="Lesson Title (e.g., Organic Chemistry - Day 01)" required><input type="text" name="topicName" placeholder="Topic Name (e.g., 2026 Revision Chemistry Special)"><input type="text" name="zoomLink" placeholder="📡 Zoom Meeting Link"><input type="text" name="videoUrl" placeholder="🎬 Video URL (VdoCipher/Vimeo/YouTube)"><input type="number" name="orderNumber" placeholder="Order Number (1,2,3...)" value="${lessons.length + 1}"><button type="submit">➕ Add Lesson</button></form></div><h2 style="color:#1a237e;margin:20px 0;">📚 Lesson List</h2>${lessonList}</div></body></html>`);
});

// CREATE LESSON
app.post('/admin/lessons/create', adminAuth, async (req, res) => {
    try {
        const { courseId, title, topicName, zoomLink, videoUrl, orderNumber } = req.body;
        if (!title) return res.send(`<script>alert('Title required!');window.location.href='/admin/courses/${courseId}/lessons'</script>`);
        if (dbConnected) {
            await db.query(`INSERT INTO lessons (course_id, title, topic_name, zoom_link, video_url, order_number) VALUES ($1,$2,$3,$4,$5,$6)`, { bind: [courseId, title, topicName, zoomLink, videoUrl, orderNumber || 0] });
        }
        res.redirect(`/admin/courses/${courseId}/lessons`);
    } catch (e) {
        res.send(`<script>alert('Error: ${e.message}');window.location.href='/admin/courses/${req.body.courseId}/lessons'</script>`);
    }
});

// DELETE LESSON
app.get('/admin/lessons/delete/:id', adminAuth, async (req, res) => {
    const courseId = req.query.courseId;
    if (dbConnected) { await db.query(`DELETE FROM lessons WHERE id=$1`, { bind: [req.params.id] }); }
    res.redirect(`/admin/courses/${courseId}/lessons`);
});

// ============================================
// ADMIN - STUDENTS PAGE
// ============================================
app.get('/admin/students', adminAuth, async (req, res) => {
    let students = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT student_id, full_name, email, mobile_number, school_name, is_active, last_login_at, created_at FROM users WHERE role='student' ORDER BY created_at DESC`); students = rows; } catch(e) {} }
    let tableRows = '';
    if (students.length > 0) { students.forEach(s => { tableRows += `<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.email}</td><td>${s.mobile_number}</td><td>${s.school_name || 'N/A'}</td><td><span class="badge ${s.is_active ? 'active' : 'inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td><td>${s.last_login_at ? new Date(s.last_login_at).toLocaleDateString() : 'Never'}</td><td>${new Date(s.created_at).toLocaleDateString()}</td></tr>`; }); } else { tableRows = '<tr><td colspan="8" style="text-align:center;padding:30px;">No students yet.</td></tr>'; }
    res.send(`<!DOCTYPE html><html><head><title>Students - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:1200px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#1a237e;color:white;padding:12px;text-align:left;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:14px}tr:hover{background:#f5f5f5}.badge{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}.active{background:#d4edda;color:#155724}.inactive{background:#f8d7da;color:#721c24}.search-box{margin-bottom:20px}.search-box input{padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;width:300px}.count{background:#e3f2fd;color:#1565c0;padding:10px 20px;border-radius:8px;display:inline-block;margin-bottom:15px;font-weight:bold}</style></head><body><div class="header"><h1>👥 Student Management</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>All Students</h2><div class="count">📊 Total: ${students.length} Students</div><div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search..." onkeyup="searchTable()"></div><table id="studentTable"><thead><tr><th>Student ID</th><th>Full Name</th><th>Email</th><th>Mobile</th><th>School</th><th>Status</th><th>Last Login</th><th>Registered</th></tr></thead><tbody>${tableRows}</tbody></table></div></div><script>function searchTable(){var i=document.getElementById('searchInput'),f=i.value.toUpperCase(),t=document.getElementById('studentTable'),r=t.getElementsByTagName('tr');for(var j=1;j<r.length;j++){var d=r[j].getElementsByTagName('td'),o=false;for(var k=0;k<d.length;k++){if(d[k]&&d[k].textContent.toUpperCase().indexOf(f)>-1){o=true;break}}r[j].style.display=o?'':'none'}}</script></body></html>`);
});

// ============================================
// ADMIN - ENROLLMENTS PAGE
// ============================================
app.get('/admin/enrollments', adminAuth, async (req, res) => {
    let enrollments = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT e.*, u.student_id, u.full_name, u.mobile_number FROM enrollments e JOIN users u ON e.user_id = u.id ORDER BY e.created_at DESC`); enrollments = rows; } catch(e) {} }
    let tableRows = '';
    if (enrollments.length > 0) { enrollments.forEach(e => { tableRows += `<tr><td><strong>${e.student_id}</strong></td><td>${e.full_name}</td><td>${e.mobile_number}</td><td><span class="badge badge-${e.status}">${e.status}</span></td><td><span class="badge badge-${e.payment_status}">${e.payment_status}</span></td><td>${new Date(e.enrolled_at).toLocaleDateString()}</td></tr>`; }); } else { tableRows = '<tr><td colspan="6" style="text-align:center;padding:30px;">No enrollments yet.</td></tr>'; }
    res.send(`<!DOCTYPE html><html><head><title>Enrollments</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#1a237e;color:white;padding:12px;text-align:left;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:14px}.badge{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}.badge-active{background:#d4edda;color:#155724}.badge-pending{background:#fff3cd;color:#856404}.badge-revoked{background:#f8d7da;color:#721c24}</style></head><body><div class="header"><h1>📋 Enrollments</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>All Enrollments</h2><table><thead><tr><th>Student ID</th><th>Name</th><th>Mobile</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead><tbody>${tableRows}</tbody></table></div></div></body></html>`);
});

// ============================================
// ADMIN - INACTIVE PAGE
// ============================================
app.get('/admin/inactivity', adminAuth, async (req, res) => {
    let inactive = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT student_id, full_name, mobile_number, last_login_at FROM users WHERE role='student' AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '7 days') ORDER BY last_login_at ASC NULLS FIRST`); inactive = rows; } catch(e) {} }
    let tableRows = '';
    if (inactive.length > 0) { inactive.forEach(s => { const days = s.last_login_at ? Math.floor((Date.now() - new Date(s.last_login_at)) / (86400000)) : 'Never'; tableRows += `<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.mobile_number}</td><td>${s.last_login_at ? new Date(s.last_login_at).toLocaleDateString() : 'Never'}</td><td><span class="badge">${days} days</span></td></tr>`; }); } else { tableRows = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#28a745;">✅ All students active!</td></tr>'; }
    res.send(`<!DOCTYPE html><html><head><title>Inactive Students</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#dc3545,#c82333);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#dc3545;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#dc3545;color:white;padding:12px;text-align:left;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:14px}tr:hover{background:#fff5f5}.badge{background:#f8d7da;color:#721c24;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}.count{background:#f8d7da;color:#721c24;padding:10px 20px;border-radius:8px;display:inline-block;margin-bottom:15px;font-weight:bold}</style></head><body><div class="header"><h1>🚨 Inactive Students (7+ Days)</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>Inactive Students</h2><div class="count">⚠️ ${inactive.length} Students Inactive</div><table><thead><tr><th>Student ID</th><th>Name</th><th>Mobile</th><th>Last Login</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table></div></div></body></html>`);
});

// ============================================
// ADMIN - ANALYTICS PAGE
// ============================================
app.get('/admin/analytics', adminAuth, async (req, res) => {
    let t=0, a=0, i=0;
    if (dbConnected) { try { const [r1]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student'`); t=r1[0]?.c||0; const [r2]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student' AND last_login_at > NOW() - INTERVAL '1 day'`); a=r2[0]?.c||0; const [r3]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student' AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '7 days')`); i=r3[0]?.c||0; } catch(e) {} }
    res.send(`<!DOCTYPE html><html><head><title>Analytics</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:900px;margin:25px auto;padding:0 20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:25px}.card{background:white;padding:30px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);text-align:center}.card .icon{font-size:40px;margin-bottom:10px}.card .num{font-size:42px;font-weight:bold;color:#1a237e;margin:10px 0}.card .label{color:#666;font-size:14px}.card.green{border-top:4px solid #28a745}.card.blue{border-top:4px solid #1a237e}.card.red{border-top:4px solid #dc3545}.info-box{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e;margin-bottom:15px}p{color:#666;line-height:1.8}</style></head><body><div class="header"><h1>📊 Analytics</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="cards"><div class="card blue"><div class="icon">👥</div><div class="num">${t}</div><div class="label">Total Students</div></div><div class="card green"><div class="icon">✅</div><div class="num">${a}</div><div class="label">Active Today</div></div><div class="card red"><div class="icon">🚨</div><div class="num">${i}</div><div class="label">Inactive 7+ Days</div></div></div><div class="info-box"><h2>📹 Video Analytics</h2><p>Video watch tracking available after VdoCipher integration.</p><p style="margin-top:15px;color:#1a237e"><strong>👨‍🏫 Teacher:</strong> Buddika Wijesundara</p><p><strong>📚 Subject:</strong> Advanced Level Chemistry</p></div></div></body></html>`);
});

// ============================================
// LOGOUT
// ============================================
app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });
app.get('/admin/logout', (req, res) => { req.session.destroy(() => res.redirect('/admin/login')); });
app.get('/admin', (req, res) => res.redirect('/admin/login'));

// ============================================
// HEALTH
// ============================================
app.get('/health', (req, res) => res.json({ status: 'ok', db: dbConnected ? 'connected' : 'disconnected', time: new Date().toISOString() }));

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('===================================');
    console.log('⚗️  Buddika Wijesundara LMS');
    console.log(`✅ http://localhost:${PORT}`);
    console.log(`🔑 Admin: Buddika / Buddika@2024`);
    console.log(`🗄️  DB: ${dbConnected ? '✅' : '⏳'}`);
    console.log('===================================');
});
