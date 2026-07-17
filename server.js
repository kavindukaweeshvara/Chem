require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// FILE UPLOAD SETUP
// ============================================
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'img_' + Date.now() + ext);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        if (ext) return cb(null, true);
        cb(new Error('Only images allowed!'));
    }
});

// ============================================
// TEACHER SETTINGS (Railway Variables)
// ============================================
const TEACHER = {
    name: process.env.TEACHER_NAME || 'Buddika Wijesundara',
    email: process.env.TEACHER_EMAIL || 'buddika@chemistry.lk',
    phone: process.env.TEACHER_PHONE || '0712345678',
    whatsapp: process.env.WHATSAPP_NUMBER || '94771234567',
    bankName: process.env.BANK_NAME || 'Sampath Bank',
    bankAccountName: process.env.BANK_ACCOUNT_NAME || 'B Wijesundara',
    bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
    bankBranch: process.env.BANK_BRANCH || 'Galle'
};

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
                await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, student_id VARCHAR(50) UNIQUE, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL, mobile_number VARCHAR(20) UNIQUE NOT NULL, nic_number VARCHAR(30), school_name VARCHAR(255), district VARCHAR(100), city VARCHAR(100), birthdate DATE, gender VARCHAR(20), address TEXT, profile_image VARCHAR(500), profile_updated BOOLEAN DEFAULT false, role VARCHAR(20) DEFAULT 'student', is_active BOOLEAN DEFAULT true, last_login_at TIMESTAMP, reset_token VARCHAR(255), reset_token_expires TIMESTAMP, verification_code VARCHAR(10), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) DEFAULT 0, image_url VARCHAR(500), teacher_name VARCHAR(255) DEFAULT '${TEACHER.name}', teacher_image VARCHAR(500), status VARCHAR(20) DEFAULT 'draft', created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`DROP TABLE IF EXISTS lessons CASCADE`);
                await db.query(`CREATE TABLE lessons (id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, topic_name VARCHAR(255), zoom_link VARCHAR(500), video_url VARCHAR(500), order_number INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`DROP TABLE IF EXISTS enrollments CASCADE`);
                await db.query(`CREATE TABLE enrollments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', payment_status VARCHAR(20) DEFAULT 'unpaid', payment_proof VARCHAR(500), enrolled_at TIMESTAMP DEFAULT NOW(), expires_at TIMESTAMP, revoked_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS activities (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), action VARCHAR(100) NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT NOW())`);
                console.log('✅ All tables created');
                const [admin] = await db.query(`SELECT * FROM users WHERE username = 'Buddika'`);
                if (admin.length === 0) {
                    const hash = await bcrypt.hash('Buddika@2024', 12);
                    await db.query(`INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, { bind: ['BC-ADMIN-001', 'Buddika', TEACHER.email, hash, TEACHER.name, TEACHER.phone, 'admin', true] });
                    console.log(`✅ Admin: Buddika / Buddika@2024`);
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
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(session({ secret: process.env.SESSION_SECRET || 'Buddika@2024_LMS', resave: false, saveUninitialized: false, cookie: { secure: false, maxAge: 86400000 } }));

const ADMIN = { username: 'Buddika', password: 'Buddika@2024', name: TEACHER.name };

function adminAuth(req, res, next) { return req.session && req.session.isAdminLoggedIn ? next() : res.redirect('/admin/login'); }
function studentAuth(req, res, next) { return req.session && req.session.isLoggedIn ? next() : res.redirect('/login'); }

// ============================================
// SHARED - Bootstrap Icons + Eye Icon
// ============================================
const BSI_CDN = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">';
const SHARED_CSS = `.toggle-password{position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;padding:8px;z-index:10;color:#666;transition:0.2s;font-size:18px}.toggle-password:hover{color:#1a237e}`;
const SHARED_JS = `function togglePass(id,el){var i=document.getElementById(id);var icon=el.querySelector('i');if(i.type==='password'){i.type='text';icon.className='bi bi-eye-slash'}else{i.type='password';icon.className='bi bi-eye'}}`;

// ============================================
// GET TEACHER IMAGE
// ============================================
async function getTeacherImage() {
    if (!dbConnected) return '<div style="width:55px;height:55px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:white;">👨‍🏫</div>';
    try {
        const [a] = await db.query(`SELECT profile_image FROM users WHERE username='Buddika' AND role='admin'`);
        if (a.length > 0 && a[0].profile_image) {
            return `<img src="/uploads/${a[0].profile_image}" style="width:55px;height:55px;border-radius:50%;object-fit:cover;">`;
        }
    } catch(e) {}
    return '<div style="width:55px;height:55px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:white;">👨‍🏫</div>';
}

// ============================================
// HOME
// ============================================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>${TEACHER.name} | Chemistry LMS</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.card{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:480px;width:100%;text-align:center}.logo{width:80px;height:80px;background:linear-gradient(135deg,#1a237e,#4a148c);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:35px;color:white}h1{color:#1a237e;font-size:22px;margin-bottom:5px}.name{color:#1a237e;font-weight:bold;font-size:16px;margin:10px 0;background:#f0f0f0;padding:8px 20px;border-radius:25px;display:inline-block}.status{background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin:20px 0;font-weight:bold}.btn{display:block;padding:15px;margin:10px 0;border-radius:10px;text-decoration:none;color:white;font-weight:bold;font-size:16px;transition:0.3s}.btn:hover{transform:translateY(-2px);opacity:0.9}.btn-login{background:#1a237e}.btn-register{background:#28a745}.btn-admin{background:#dc3545}.footer{margin-top:20px;font-size:12px;color:#999}</style></head><body><div class="card"><div class="logo">⚗️</div><h1>Advanced Level Chemistry</h1><p style="color:#666;font-size:14px">Learning Management System</p><p class="name">👨‍🏫 ${TEACHER.name}</p><div class="status">✅ System Online</div><a href="/login" class="btn btn-login">🔐 Student Login</a><a href="/register" class="btn btn-register">📝 New Registration</a><a href="/admin/login" class="btn btn-admin">👨‍🏫 Teacher Login</a><div class="footer">© 2026 ${TEACHER.name}</div></div></body></html>`);
});

// ============================================
// REGISTER GET
// ============================================
app.get('/register', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Register - ${TEACHER.name}</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${BSI_CDN}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:450px}h2{text-align:center;color:#1a237e;margin-bottom:5px;font-size:22px}.sub{text-align:center;color:#666;margin-bottom:20px;font-size:14px}.input-group{position:relative;margin:8px 0}.input-group input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px;transition:0.3s}.input-group input[type="password"]{padding-right:45px}.input-group input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}${SHARED_CSS}.warn{background:#fff3cd;color:#856404;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center;border:1px solid #ffc107}.info{background:#e3f2fd;color:#1565c0;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px;transition:0.3s}button:hover{background:#218838;transform:translateY(-2px)}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}.link a:hover{text-decoration:underline}</style></head><body><div class="box"><h2>📝 Student Registration</h2><p class="sub">👨‍🏫 ${TEACHER.name} | Chemistry</p><form action="/register" method="POST"><div class="input-group"><input type="text" name="fullName" placeholder="Full Name" required></div><div class="input-group"><input type="email" name="email" placeholder="Email Address" required></div><div class="input-group"><input type="tel" name="mobile" placeholder="Mobile Number (0771234567)" pattern="[0-9]{10,12}" required></div><div class="warn">⚠️ One Mobile Number = One Student ID Only</div><div class="info">🆔 Auto Student ID: BC-1001, BC-1002...</div><div class="input-group"><input type="password" name="password" id="regPassword" placeholder="Password (min 6 characters)" minlength="6" required><span class="toggle-password" onclick="togglePass('regPassword', this)"><i class="bi bi-eye"></i></span></div><button type="submit">📝 Register</button></form><div class="link"><a href="/login">Already have account? Login</a></div><div class="link"><a href="/">← Home</a></div></div><script>${SHARED_JS}</script></body></html>`);
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
        res.send(`<!DOCTYPE html><html><head><title>Success!</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:480px;width:100%;text-align:center}.icon{font-size:70px;margin-bottom:20px}h1{color:#28a745;font-size:24px;margin-bottom:10px}.id-box{font-size:36px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:15px;border-radius:10px;margin:20px 0;letter-spacing:2px}.success{background:#d4edda;color:#155724;padding:15px;border-radius:8px;margin:20px 0;font-size:14px}.warn{background:#fff3cd;color:#856404;padding:15px;border-radius:8px;margin:20px 0;font-size:14px}.btn{display:inline-block;padding:14px 30px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}</style></head><body><div class="card"><div class="icon">🎉</div><h1>Registration Successful!</h1><div class="id-box">🆔 ${sid}</div><div class="success">✅ Name: ${fullName}<br>✅ Email: ${email}<br>✅ Mobile: ${mobile}</div><div class="warn">⚠️ Save your Student ID!<br>Send payment receipt with Student ID via WhatsApp.</div><a href="/login" class="btn">🔐 Login Now</a><a href="/" class="btn">🏠 Home</a></div></body></html>`);
    } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/register'</script>`); }
});

// ============================================
// LOGIN GET
// ============================================
app.get('/login', (req, res) => {
    if (req.session && req.session.isLoggedIn) return res.redirect('/student/dashboard');
    res.send(`<!DOCTYPE html><html><head><title>Login - ${TEACHER.name}</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${BSI_CDN}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:40px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:420px}h2{text-align:center;color:#1a237e;margin-bottom:5px;font-size:22px}.sub{text-align:center;color:#666;margin-bottom:25px;font-size:14px}.input-group{position:relative;margin:12px 0}.input-group input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px;transition:0.3s}.input-group input[type="password"]{padding-right:45px}.input-group input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}${SHARED_CSS}button{width:100%;padding:14px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:15px;transition:0.3s}button:hover{background:#0d1457;transform:translateY(-2px)}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}.link a:hover{text-decoration:underline}.forgot{text-align:right;margin-top:5px}.forgot a{color:#dc3545;font-size:13px;text-decoration:none}.forgot a:hover{text-decoration:underline}.footer{text-align:center;margin-top:20px;font-size:11px;color:#999}</style></head><body><div class="box"><h2>🔐 Student Login</h2><p class="sub">${TEACHER.name} | Chemistry</p><form action="/login" method="POST"><div class="input-group"><input type="text" name="username" placeholder="Email or Username" required></div><div class="input-group"><input type="password" name="password" id="loginPassword" placeholder="Password" required><span class="toggle-password" onclick="togglePass('loginPassword', this)"><i class="bi bi-eye"></i></span></div><div class="forgot"><a href="/forgot-password">Forgot Password?</a></div><button type="submit">Login</button></form><div class="link"><a href="/register">New Student? Register</a></div><div class="link"><a href="/">← Home</a></div><div class="footer">© 2026 ${TEACHER.name}</div></div><script>${SHARED_JS}</script></body></html>`);
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
// FORGOT PASSWORD - GET
// ============================================
app.get('/forgot-password', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Forgot Password</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:420px}h2{text-align:center;color:#1a237e;margin-bottom:10px;font-size:22px}p{text-align:center;color:#666;margin-bottom:20px;font-size:14px}input{width:100%;padding:14px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:16px;transition:0.3s}input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}button{width:100%;padding:14px;background:#dc3545;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px;transition:0.3s}button:hover{background:#c82333;transform:translateY(-2px)}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}.info{background:#e3f2fd;color:#1565c0;padding:12px;border-radius:8px;font-size:13px;margin:10px 0;text-align:center}</style></head><body><div class="box"><h2>🔑 Forgot Password?</h2><p>Enter your email to receive verification code</p><form action="/forgot-password" method="POST"><input type="email" name="email" placeholder="Your Email Address" required><button type="submit">📧 Send Verification Code</button></form><div class="info">📧 Verification code will be sent to your email</div><div class="link"><a href="/login">← Back to Login</a></div></div></body></html>`);
});

// ============================================
// FORGOT PASSWORD - POST
// ============================================
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.send(`<script>alert('Email required!');window.location.href='/forgot-password'</script>`);
        if (!dbConnected) return res.send(`<script>alert('Database not connected!');window.location.href='/forgot-password'</script>`);
        const [users] = await db.query(`SELECT * FROM users WHERE email = $1`, { bind: [email] });
        if (users.length === 0) return res.send(`<!DOCTYPE html><html><head><title>Not Found</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:400px;text-align:center}h2{color:#dc3545;margin-bottom:10px}p{color:#666;margin-bottom:20px}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold}</style></head><body><div class="box"><h2>❌ Email Not Found!</h2><p>No account found with: <strong>${email}</strong></p><a href="/forgot-password" class="btn">🔄 Try Again</a><br><br><a href="/register" style="color:#1a237e;">📝 Register</a></div></body></html>`);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);
        await db.query(`UPDATE users SET reset_token=$1, reset_token_expires=$2, verification_code=$3 WHERE email=$4`, { bind: [token, expires, code, email] });
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com', port: parseInt(process.env.EMAIL_PORT || '587'), secure: false, auth: { user: process.env.EMAIL_USER || '', pass: process.env.EMAIL_PASS || '' } });
            await transporter.sendMail({ from: `"${TEACHER.name} LMS" <${process.env.EMAIL_FROM || 'noreply@chemistry.lk'}>`, to: email, subject: 'Password Reset Code - ' + TEACHER.name + ' LMS', html: `<div style="max-width:500px;margin:0 auto;padding:30px;font-family:Arial,sans-serif;background:#f5f5f5;border-radius:10px"><div style="text-align:center;font-size:50px;margin-bottom:20px">⚗️</div><h2 style="color:#1a237e;text-align:center">Password Reset Code</h2><p style="color:#666;text-align:center;font-size:16px">Hello, ${users[0].full_name}!</p><p style="color:#666;text-align:center">Your verification code is:</p><div style="background:#1a237e;color:white;padding:20px;border-radius:10px;text-align:center;font-size:36px;font-weight:bold;letter-spacing:10px;margin:20px 0">${code}</div><p style="color:#666;text-align:center;font-size:13px">⚠️ This code expires in 1 hour.</p><p style="color:#999;text-align:center;font-size:12px;margin-top:30px">If you didn't request this, please ignore.</p><hr style="border:1px solid #e0e0e0;margin:20px 0"><p style="text-align:center;color:#1a237e;font-weight:bold">👨‍🏫 ${TEACHER.name}<br>Advanced Level Chemistry LMS</p></div>` });
            console.log('✅ Email sent to:', email);
        } catch(emailErr) { console.error('❌ Email error:', emailErr.message); }
        res.send(`<!DOCTYPE html><html><head><title>Check Email</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.3);width:100%;max-width:430px;text-align:center}h2{color:#1a237e;margin-bottom:10px;font-size:22px}.sub{color:#666;font-size:14px;margin-bottom:20px}.info{background:#e3f2fd;color:#1565c0;padding:12px;border-radius:8px;font-size:13px;margin:15px 0}input{width:100%;padding:14px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:18px;text-align:center;letter-spacing:5px;transition:0.3s}input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px;transition:0.3s}button:hover{background:#218838;transform:translateY(-2px)}.link{margin-top:15px}.link a{color:white;text-decoration:none;font-size:14px;background:rgba(255,255,255,0.2);padding:8px 20px;border-radius:20px}.email-info{color:#1a237e;font-weight:bold;font-size:16px;margin:10px 0}</style></head><body><div class="box"><h2>📧 Check Your Email!</h2><p class="sub">Verification code sent to:</p><p class="email-info">${email}</p><div class="info">📋 Please check your email inbox (and spam)<br>Enter the 6-digit code below<br>⚠️ Code expires in 1 hour</div><form action="/verify-code" method="POST"><input type="hidden" name="token" value="${token}"><input type="hidden" name="email" value="${email}"><input type="text" name="code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autofocus><button type="submit">✅ Verify & Reset Password</button></form><div class="link" style="margin-top:20px;"><a href="/login">← Back to Login</a></div></div></body></html>`);
    } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/forgot-password'</script>`); }
});

// ============================================
// VERIFY CODE + RESET PASSWORD
// ============================================
app.post('/verify-code', async (req, res) => { try { const { token, email, code } = req.body; if (!token || !email || !code) return res.send(`<script>alert('All fields required!');window.location.href='/forgot-password'</script>`); if (dbConnected) { const [users] = await db.query(`SELECT * FROM users WHERE email=$1 AND reset_token=$2 AND verification_code=$3 AND reset_token_expires > NOW()`, { bind: [email, token, code] }); if (users.length === 0) return res.send(`<!DOCTYPE html><html><head><title>Invalid</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:400px;text-align:center}h2{color:#dc3545;margin-bottom:10px}p{color:#666;margin-bottom:20px}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold}</style></head><body><div class="box"><h2>❌ Invalid Code!</h2><p>The verification code is incorrect or expired.</p><a href="/forgot-password" class="btn">🔄 Try Again</a></div></body></html>`); } res.redirect(`/reset-password?token=${token}&verified=true`); } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/forgot-password'</script>`); } });

app.get('/reset-password', async (req, res) => {
    const { token, verified } = req.query;
    if (!token || !verified) return res.redirect('/forgot-password');
    if (dbConnected) { const [users] = await db.query(`SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`, { bind: [token] }); if (users.length === 0) return res.send(`<script>alert('Invalid or expired link!');window.location.href='/forgot-password'</script>`); }
    res.send(`<!DOCTYPE html><html><head><title>Reset Password</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${BSI_CDN}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#28a745,#218838);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.2);width:100%;max-width:420px}h2{color:#28a745;margin-bottom:5px;text-align:center;font-size:22px}.sub{text-align:center;color:#666;margin-bottom:20px;font-size:14px}.verified{background:#d4edda;color:#155724;padding:10px;border-radius:8px;text-align:center;margin-bottom:20px;font-size:13px;font-weight:bold}.input-group{position:relative;margin:10px 0}.input-group input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px;transition:0.3s}.input-group input[type="password"]{padding-right:45px}.input-group input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}${SHARED_CSS}button{width:100%;padding:14px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px;transition:0.3s}button:hover{background:#0d1457;transform:translateY(-2px)}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}</style></head><body><div class="box"><h2>🔑 Reset Password</h2><p class="sub">✅ Email Verified Successfully!</p><div class="verified">✅ Verification Successful - Enter New Password</div><form action="/reset-password" method="POST"><input type="hidden" name="token" value="${token}"><div class="input-group"><input type="password" name="password" id="newPass1" placeholder="New Password (min 6)" minlength="6" required><span class="toggle-password" onclick="togglePass('newPass1', this)"><i class="bi bi-eye"></i></span></div><div class="input-group"><input type="password" name="confirmPassword" id="newPass2" placeholder="Confirm Password" minlength="6" required><span class="toggle-password" onclick="togglePass('newPass2', this)"><i class="bi bi-eye"></i></span></div><button type="submit">🔐 Update Password</button></form><div class="link"><a href="/login">← Back to Login</a></div></div><script>${SHARED_JS}</script></body></html>`);
});

app.post('/reset-password', async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;
        if (!token || !password || !confirmPassword) return res.send(`<script>alert('All fields required!');window.location.href='/reset-password?token=${token}&verified=true'</script>`);
        if (password !== confirmPassword) return res.send(`<script>alert('Passwords do not match!');window.location.href='/reset-password?token=${token}&verified=true'</script>`);
        if (password.length < 6) return res.send(`<script>alert('Password must be at least 6 characters!');window.location.href='/reset-password?token=${token}&verified=true'</script>`);
        if (dbConnected) { const [users] = await db.query(`SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`, { bind: [token] }); if (users.length === 0) return res.send(`<script>alert('Invalid or expired!');window.location.href='/forgot-password'</script>`); const hash = await bcrypt.hash(password, 12); await db.query(`UPDATE users SET password=$1, reset_token=NULL, reset_token_expires=NULL, verification_code=NULL WHERE reset_token=$2`, { bind: [hash, token] }); }
        res.send(`<!DOCTYPE html><html><head><title>Updated</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#28a745,#218838);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.2);width:100%;max-width:400px;text-align:center}h2{color:#28a745;margin-bottom:10px}p{color:#666;margin-bottom:20px}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold}</style></head><body><div class="box"><h2>✅ Password Updated!</h2><p>Your password has been changed successfully.</p><a href="/login" class="btn">🔐 Login Now</a></div></body></html>`);
    } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/login'</script>`); }
});

// ============================================
// STUDENT DASHBOARD
// ============================================
app.get('/student/dashboard', studentAuth, async (req, res) => {
    let hasActiveEnrollment = false;
    let teacherImg = '<div style="width:50px;height:50px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;color:white;margin-right:10px;">👨‍🏫</div>';
    if (dbConnected) {
        try {
            const [e] = await db.query(`SELECT * FROM enrollments WHERE user_id=$1 AND status='active' AND payment_status='verified' LIMIT 1`, { bind: [req.session.userId] });
            hasActiveEnrollment = e.length > 0;
            const [a] = await db.query(`SELECT profile_image FROM users WHERE username='Buddika' AND role='admin'`);
            if (a.length > 0 && a[0].profile_image) {
                teacherImg = `<img src="/uploads/${a[0].profile_image}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-right:10px;">`;
            }
        } catch(e) {}
    }
    res.send(`<!DOCTYPE html><html><head><title>Dashboard</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:700px;margin:30px auto;padding:20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}.teacher-card{background:white;padding:15px 20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px;display:flex;align-items:center}.id-badge{font-size:28px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:12px 25px;border-radius:10px;display:inline-block;margin:15px 0;letter-spacing:2px}.info-row{margin:12px 0;font-size:16px;color:#333;padding:10px;background:#f9f9f9;border-radius:5px}.btn-courses{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px 5px;transition:0.3s}.btn-courses:hover{transform:translateY(-2px)}.btn-pay{background:#25D366}.btn-profile{background:#ffc107;color:#333}.status-badge{padding:5px 15px;border-radius:20px;font-size:13px;font-weight:bold;display:inline-block;margin:10px 0}.paid{background:#d4edda;color:#155724}.unpaid{background:#f8d7da;color:#721c24}</style></head><body><div class="header"><h1>👨‍🎓 Student Dashboard</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="teacher-card">${teacherImg}<div><strong style="color:#1a237e;font-size:15px;">${TEACHER.name}</strong><br><small style="color:#666;">Advanced Level Chemistry</small></div></div><div class="card"><h2 style="color:#1a237e">Welcome, ${req.session.userName}!</h2><div class="id-badge">🆔 ${req.session.studentId}</div><div class="info-row"><strong>📱 Mobile:</strong> ${req.session.userMobile || 'N/A'}</div><div class="info-row"><strong>📚 Course:</strong> Advanced Level Chemistry</div><div class="info-row"><strong>Payment Status:</strong> <span class="status-badge ${hasActiveEnrollment ? 'paid' : 'unpaid'}">${hasActiveEnrollment ? '✅ Paid & Active' : '❌ Payment Required'}</span></div><a href="/student/courses" class="btn-courses">📚 View Courses</a><a href="/student/payment" class="btn-courses btn-pay">💰 Make Payment</a><a href="/student/profile" class="btn-courses btn-profile">👤 Edit Profile</a></div></div></body></html>`);
});

// ============================================
// STUDENT - PROFILE PAGE
// ============================================
app.get('/student/profile', studentAuth, async (req, res) => {
    let user = { full_name: '', email: '', mobile_number: '', student_id: '', nic_number: '', school_name: '', district: '', city: '', birthdate: '', gender: '', address: '' };
    if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM users WHERE id=$1`, { bind: [req.session.userId] }); if (rows.length > 0) user = rows[0]; } catch(e) {} }
    res.send(`<!DOCTYPE html><html><head><title>My Profile</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:700px;margin:30px auto;padding:0 20px}.card{background:white;padding:30px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:5px}.sub{color:#666;margin-bottom:25px;font-size:14px}.id-badge{font-size:22px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:10px 20px;border-radius:10px;display:inline-block;margin-bottom:20px;letter-spacing:2px}.form-row{display:flex;gap:15px;flex-wrap:wrap;margin-bottom:10px}.form-group{flex:1;min-width:200px;margin-bottom:15px}.form-group label{display:block;font-weight:600;color:#333;margin-bottom:5px;font-size:13px}.form-group input,.form-group select,.form-group textarea{width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;transition:0.3s}.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}.form-group textarea{resize:vertical;min-height:80px}.form-group input[readonly]{background:#f5f5f5;color:#666}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px;transition:0.3s}button:hover{background:#218838;transform:translateY(-2px)}.back-link{display:inline-block;margin-top:15px;color:#1a237e;text-decoration:none;font-size:14px}.back-link:hover{text-decoration:underline}.success-msg{background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-weight:bold}</style></head><body><div class="header"><h1>👤 My Profile</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container">${req.query.saved ? '<div class="success-msg">✅ Profile Updated Successfully!</div>' : ''}<div class="card"><h2>Profile Details</h2><p class="sub">👨‍🏫 ${TEACHER.name} | Chemistry LMS</p><div class="id-badge">🆔 ${user.student_id || req.session.studentId}</div><form action="/student/profile/update" method="POST"><div class="form-row"><div class="form-group"><label>Full Name *</label><input type="text" name="fullName" value="${user.full_name || req.session.userName || ''}" required></div><div class="form-group"><label>Email</label><input type="email" value="${user.email || ''}" readonly></div></div><div class="form-row"><div class="form-group"><label>Mobile Number</label><input type="tel" value="${user.mobile_number || req.session.userMobile || ''}" readonly></div><div class="form-group"><label>NIC Number *</label><input type="text" name="nicNumber" value="${user.nic_number || ''}" placeholder="200012345678 or 987654321V" required></div></div><div class="form-row"><div class="form-group"><label>Birth Date</label><input type="date" name="birthdate" value="${user.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : ''}"></div><div class="form-group"><label>Gender</label><select name="gender"><option value="">Select...</option><option value="male" ${user.gender==='male'?'selected':''}>Male</option><option value="female" ${user.gender==='female'?'selected':''}>Female</option></select></div></div><div class="form-row"><div class="form-group"><label>School Name *</label><input type="text" name="schoolName" value="${user.school_name || ''}" placeholder="Royal College, Colombo 07" required></div><div class="form-group"><label>District *</label><select name="district" required><option value="">Select District...</option>${['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'].map(d => `<option value="${d}" ${user.district===d?'selected':''}>${d}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-group"><label>City *</label><input type="text" name="city" value="${user.city || ''}" placeholder="Galle City" required></div><div class="form-group"><label>Address</label><textarea name="address" placeholder="Your full address...">${user.address || ''}</textarea></div></div><button type="submit">💾 Save Profile</button></form><a href="/student/dashboard" class="back-link">← Back to Dashboard</a></div></div></body></html>`);
});

app.post('/student/profile/update', studentAuth, async (req, res) => {
    try {
        const { fullName, nicNumber, birthdate, gender, schoolName, district, city, address } = req.body;
        if (!fullName || !nicNumber || !schoolName || !district || !city) return res.send(`<script>alert('Please fill all required fields (*)');window.location.href='/student/profile'</script>`);
        if (dbConnected) { await db.query(`UPDATE users SET full_name=$1, nic_number=$2, birthdate=$3, gender=$4, school_name=$5, district=$6, city=$7, address=$8, profile_updated=true WHERE id=$9`, { bind: [fullName, nicNumber, birthdate || null, gender || null, schoolName, district, city, address || null, req.session.userId] }); req.session.userName = fullName; }
        res.redirect('/student/profile?saved=1');
    } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/student/profile'</script>`); }
});

// ============================================
// STUDENT - PAYMENT PAGE
// ============================================
app.get('/student/payment', studentAuth, (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Payment - ${TEACHER.name}</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);max-width:500px;width:100%;text-align:center}h2{color:#1a237e;margin-bottom:15px}.bank-details{background:#f9f9f9;padding:20px;border-radius:10px;margin:20px 0;text-align:left}.bank-details p{margin:8px 0;font-size:15px}.highlight{background:#fff3cd;color:#856404;padding:15px;border-radius:8px;margin:20px 0;font-size:14px}.btn-wa{display:inline-block;padding:14px 30px;background:#25D366;color:white;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;margin:10px;transition:0.3s}.btn-wa:hover{transform:translateY(-2px)}.btn-back{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}</style></head><body><div class="card"><h2>💰 Payment Details</h2><p style="color:#666;">${TEACHER.name} - Chemistry LMS</p><div class="bank-details"><h3 style="color:#1a237e;margin-bottom:10px;">🏦 Bank Details</h3><p><strong>Bank:</strong> ${TEACHER.bankName}</p><p><strong>Account Name:</strong> ${TEACHER.bankAccountName}</p><p><strong>Account Number:</strong> ${TEACHER.bankAccountNumber}</p><p><strong>Branch:</strong> ${TEACHER.bankBranch}</p></div><div class="highlight"><strong>📱 Payment කළ පසු:</strong><br>1. Screenshot/Receipt එක ගන්න<br>2. පහත WhatsApp Button click කරන්න<br>3. Receipt + Student ID (<strong>${req.session.studentId}</strong>) send කරන්න</div><a href="https://wa.me/${TEACHER.whatsapp}?text=Payment%20Receipt%20-%20Student%20ID:%20${req.session.studentId}%20-%20Name:%20${encodeURIComponent(req.session.userName)}" target="_blank" class="btn-wa">📱 Send Receipt via WhatsApp</a><br><a href="/student/dashboard" class="btn-back">← Back</a></div></body></html>`);
});

// ============================================
// STUDENT - VIEW COURSES
// ============================================
app.get('/student/courses', studentAuth, async (req, res) => {
    let courses = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM courses WHERE status='published' ORDER BY created_at DESC`); courses = rows; } catch(e) {} }
    let cc = '';
    if (courses.length > 0) { courses.forEach(c => { cc += `<div class="course-card"><h3>📚 ${c.title}</h3><p style="color:#666;">${c.description||''}</p><p style="font-size:13px;color:#999;">Price: Rs.${c.price||0}</p><a href="/student/courses/${c.id}/lessons" class="btn">📖 View Lessons</a></div>`; }); } else { cc = '<p style="text-align:center;color:#666;padding:30px;">No courses available yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>Courses</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:900px;margin:25px auto;padding:0 20px}h2{color:#1a237e;margin-bottom:20px}.course-card{background:white;padding:20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:15px}.course-card h3{color:#1a237e}.btn{display:inline-block;padding:10px 22px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;margin-top:10px;transition:0.3s}.btn:hover{background:#0d1457}</style></head><body><div class="header"><h1>👨‍🎓 ${req.session.userName}</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><h2>📚 My Courses</h2>${cc}<div style="text-align:center;margin-top:20px;"><a href="/student/dashboard">← Dashboard</a></div></div></body></html>`);
});

// ============================================
// STUDENT - VIEW LESSONS
// ============================================
app.get('/student/courses/:courseId/lessons', studentAuth, async (req, res) => {
    const courseId = req.params.courseId; const userId = req.session.userId;
    let course = { title: 'Course' }; let lessons = []; let hasAccess = false;
    if (dbConnected) { try { const [c] = await db.query(`SELECT * FROM courses WHERE id=$1`, { bind: [courseId] }); if (c.length > 0) course = c[0]; const [enrollment] = await db.query(`SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2 AND status='active' AND payment_status='verified'`, { bind: [userId, courseId] }); hasAccess = enrollment.length > 0; if (hasAccess) { const [l] = await db.query(`SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_number`, { bind: [courseId] }); lessons = l; } } catch(e) {} }
    if (!hasAccess) return res.send(`<!DOCTYPE html><html><head><title>Access Denied</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#dc3545,#c82333);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:500px;width:100%;text-align:center}.icon{font-size:70px;margin-bottom:20px}h2{color:#dc3545;margin-bottom:10px}p{color:#666;line-height:1.8;margin:15px 0}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}.btn-wa{background:#25D366}</style></head><body><div class="card"><div class="icon">🔒</div><h2>Payment Required!</h2><p>ඔබ තවමත් Payment කර නැත!<br>You have not made the payment yet.</p><p style="font-size:14px;color:#dc3545;"><strong>⚠️ Payment කළ පසුව පමණක් Videos සහ Live Sessions Access කළ හැක.</strong></p><a href="/student/payment" class="btn btn-wa">💰 Make Payment Now</a><a href="/student/courses" class="btn">← Back</a></div></body></html>`);
    let ll = '';
    if (lessons.length > 0) { lessons.forEach(l => { ll += `<div class="lesson-card"><h3>📖 ${l.title}</h3><p class="topic-name">📚 ${l.topic_name || 'Chemistry'}</p><div class="actions">${l.zoom_link ? `<a href="${l.zoom_link}" target="_blank" class="action-box live-box"><span class="icon">📡</span><span class="label">Live Session</span><span class="desc">Join Zoom</span></a>` : `<div class="action-box live-box inactive"><span class="icon">📡</span><span class="label">Live</span><span class="desc">N/A</span></div>`}${l.video_url ? `<a href="${l.video_url}" target="_blank" class="action-box recording-box"><span class="icon">🎬</span><span class="label">Recording</span><span class="desc">Watch</span></a>` : `<div class="action-box recording-box inactive"><span class="icon">🎬</span><span class="label">Recording</span><span class="desc">N/A</span></div>`}</div></div>`; }); } else { ll = '<p style="text-align:center;color:#666;padding:30px;">No lessons yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>${course.title}</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#28a745,#218838);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.badge{background:rgba(255,255,255,0.2);padding:5px 15px;border-radius:20px;font-size:13px}.back{color:white;text-decoration:none}.container{max-width:800px;margin:25px auto;padding:0 20px}h2{color:#1a237e;margin-bottom:5px}.topic{color:#666;margin-bottom:25px}.lesson-card{background:white;padding:25px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08);margin-bottom:20px}.lesson-card h3{color:#1a237e}.topic-name{color:#2563eb;font-weight:bold;font-size:14px;margin-bottom:20px;background:#eff6ff;padding:8px 15px;border-radius:20px;display:inline-block}.actions{display:flex;gap:20px;flex-wrap:wrap}.action-box{flex:1;min-width:200px;padding:25px 20px;border-radius:12px;text-align:center;text-decoration:none;color:white;transition:0.3s;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer}.action-box:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(0,0,0,0.15)}.live-box{background:linear-gradient(135deg,#dc3545,#c82333)}.recording-box{background:linear-gradient(135deg,#1a237e,#283593)}.inactive{opacity:0.5;pointer-events:none}.icon{font-size:40px}.label{font-size:18px;font-weight:bold}.desc{font-size:13px;opacity:0.9}</style></head><body><div class="header"><h1>📚 ${course.title}</h1><div><span class="badge">✅ Paid</span><a href="/student/courses" class="back" style="margin-left:15px;">← Courses</a></div></div><div class="container"><h2>Lessons</h2><p class="topic">👨‍🏫 ${TEACHER.name}</p>${ll}</div></body></html>`);
});

// ============================================
// ADMIN LOGIN GET
// ============================================
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdminLoggedIn) return res.redirect('/admin/dashboard');
    const err = req.query.error === '1' ? '❌ Wrong Username or Password!' : '';
    res.send(`<!DOCTYPE html><html><head><title>Teacher Login</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${BSI_CDN}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#0d1457);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.box{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.4);width:100%;max-width:420px}.icon{text-align:center;font-size:60px;margin-bottom:20px}h2{text-align:center;color:#1a237e;margin-bottom:5px;font-size:22px}.sub{text-align:center;color:#666;margin-bottom:25px;font-size:14px}.error{background:#f8d7da;color:#721c24;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;${err?'':'display:none'}}.input-group{position:relative;margin:10px 0}.input-group input{width:100%;padding:15px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;transition:0.3s}.input-group input[type="password"]{padding-right:45px}.input-group input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1)}${SHARED_CSS}button{width:100%;padding:15px;margin-top:15px;background:linear-gradient(135deg,#1a237e,#283593);color:white;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;transition:0.3s}button:hover{transform:translateY(-2px);box-shadow:0 5px 20px rgba(26,35,126,0.3)}.forgot{text-align:right;margin-top:5px}.forgot a{color:#dc3545;font-size:13px;text-decoration:none}.link{text-align:center;margin-top:20px}.link a{color:#1a237e;text-decoration:none;font-size:14px}.note{text-align:center;margin-top:20px;font-size:12px;color:#999;background:#f5f5f5;padding:10px;border-radius:8px}.footer{text-align:center;margin-top:20px;font-size:11px;color:#999}</style></head><body><div class="box"><div class="icon">🔒</div><h2>👨‍🏫 Teacher Login</h2><p class="sub">${TEACHER.name} | Chemistry LMS</p><div class="error">${err}</div><form action="/admin/login" method="POST"><div class="input-group"><input type="text" name="username" placeholder="👤 Username" required autofocus></div><div class="input-group"><input type="password" name="password" id="adminPassword" placeholder="🔑 Password" required><span class="toggle-password" onclick="togglePass('adminPassword', this)"><i class="bi bi-eye"></i></span></div><div class="forgot"><a href="/forgot-password">Forgot Password?</a></div><button type="submit">🔐 Login</button></form><div class="note">🛡️ Authorized Teacher Only</div><div class="link"><a href="/">← Home</a></div><div class="footer">© 2026 ${TEACHER.name}</div></div><script>${SHARED_JS}</script></body></html>`);
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN.username && password === ADMIN.password) { req.session.isAdminLoggedIn = true; req.session.adminName = ADMIN.name; return res.redirect('/admin/dashboard'); }
    return res.redirect('/admin/login?error=1');
});

// ============================================
// ADMIN DASHBOARD (with Teacher Photo)
// ============================================
app.get('/admin/dashboard', adminAuth, async (req, res) => {
    let total = 0;
    let adminAvatar = '<div style="width:55px;height:55px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:white;">👨‍🏫</div>';
    if (dbConnected) {
        try {
            const [c] = await db.query(`SELECT COUNT(*) as count FROM users WHERE role='student'`);
            total = c[0]?.count || 0;
            const [a] = await db.query(`SELECT profile_image FROM users WHERE username='Buddika' AND role='admin'`);
            if (a.length > 0 && a[0].profile_image) {
                adminAvatar = `<img src="/uploads/${a[0].profile_image}" style="width:55px;height:55px;border-radius:50%;object-fit:cover;">`;
            }
        } catch(e) {}
    }
    const dbStatus = dbConnected ? '<span style="color:#28a745">✅ Connected</span>' : '<span style="color:#dc3545">❌ Not Connected</span>';
    res.send(`<!DOCTYPE html><html><head><title>Admin</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:1100px;margin:25px auto;padding:0 20px}.teacher-card{background:white;padding:20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px;display:flex;align-items:center;gap:15px}.db-status{background:white;padding:12px 20px;border-radius:8px;margin-bottom:20px;font-size:14px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:25px}.card{background:white;padding:20px;border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,0.08);text-align:center}.card h3{color:#666;font-size:13px}.card .num{font-size:32px;font-weight:bold;color:#1a237e;margin:8px 0}.menu{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:25px}.menu a{padding:12px 22px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;transition:0.3s}.menu a:hover{background:#0d1457;transform:translateY(-2px)}.green{background:#28a745!important}.warning{background:#ffc107!important;color:#333!important}.profile-link{font-size:12px;color:#2563eb;text-decoration:none}.profile-link:hover{text-decoration:underline}</style></head><body><div class="header"><h1>👨‍🏫 ${TEACHER.name}</h1><a href="/admin/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="db-status">Database: ${dbStatus}</div><div class="teacher-card">${adminAvatar}<div><h2 style="color:#1a237e">${TEACHER.name}</h2><p style="color:#666">Advanced Level Chemistry</p><a href="/admin/profile" class="profile-link">📷 Change Photo</a></div></div><div class="cards"><div class="card"><h3>📊 Total Students</h3><div class="num">${total}</div></div><div class="card"><h3>✅ Active</h3><div class="num">${total}</div></div><div class="card"><h3>⏳ Pending</h3><div class="num">0</div></div><div class="card"><h3>🚨 Inactive</h3><div class="num">0</div></div></div><div class="menu"><a href="/admin/courses" class="green">📚 Courses</a><a href="/admin/enrollments">💰 Payments</a><a href="/admin/students">👥 Students</a><a href="/admin/inactivity" class="warning">🚨 Inactive</a><a href="/admin/analytics">📊 Analytics</a><a href="/">🏠 Home</a></div></div></body></html>`);
});

// ============================================
// ADMIN - PROFILE PAGE (Photo Upload)
// ============================================
app.get('/admin/profile', adminAuth, async (req, res) => {
    let admin = { full_name: TEACHER.name, profile_image: '' };
    if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM users WHERE username='Buddika' AND role='admin'`); if (rows.length > 0) admin = rows[0]; } catch(e) {} }
    const imgDisplay = admin.profile_image ? `<img src="/uploads/${admin.profile_image}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid #1a237e;margin-bottom:15px;">` : '<div style="width:120px;height:120px;border-radius:50%;background:#1a237e;display:flex;align-items:center;justify-content:center;font-size:50px;color:white;margin:0 auto 15px;">👨‍🏫</div>';
    res.send(`<!DOCTYPE html><html><head><title>Teacher Profile</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px}.container{max-width:600px;margin:30px auto;padding:0 20px}.card{background:white;padding:30px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08);text-align:center}h2{color:#1a237e;margin-bottom:20px}.upload-area{background:#f9f9f9;border:3px dashed #ccc;border-radius:15px;padding:30px;margin:20px 0;cursor:pointer;transition:0.3s}.upload-area:hover{border-color:#1a237e;background:#f0f0f0}input[type="file"]{display:none}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px;transition:0.3s}button:hover{background:#218838;transform:translateY(-2px)}.back-link{display:inline-block;margin-top:15px;color:#1a237e;text-decoration:none;font-size:14px}.success{background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin-bottom:20px;font-weight:bold}</style></head><body><div class="header"><h1>👨‍🏫 Teacher Profile</h1><a href="/admin/logout" class="logout">🚪 Logout</a></div><div class="container">${req.query.uploaded ? '<div class="success">✅ Profile Picture Updated!</div>' : ''}<div class="card"><h2>${TEACHER.name}</h2><p style="color:#666;margin-bottom:20px;">Advanced Level Chemistry</p>${imgDisplay}<form action="/admin/profile/upload" method="POST" enctype="multipart/form-data"><div class="upload-area" onclick="document.getElementById('photoFile').click()"><p style="font-size:40px;margin-bottom:10px;">📷</p><p style="color:#666;">Click to Select Photo</p><p style="font-size:12px;color:#999;">JPG, PNG, GIF (Max 5MB)</p></div><input type="file" id="photoFile" name="photo" accept="image/*" onchange="previewImage(this)" required><img id="preview" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid #1a237e;margin:15px auto;display:none;"><br><button type="submit">💾 Upload Photo</button></form><a href="/admin/dashboard" class="back-link">← Back to Dashboard</a></div></div><script>function previewImage(input){var preview=document.getElementById('preview');if(input.files&&input.files[0]){var reader=new FileReader();reader.onload=function(e){preview.src=e.target.result;preview.style.display='block';document.querySelector('.upload-area').style.display='none'};reader.readAsDataURL(input.files[0])}}</script></body></html>`);
});

app.post('/admin/profile/upload', adminAuth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.send(`<script>alert('Please select a photo!');window.location.href='/admin/profile'</script>`);
        const filename = req.file.filename;
        if (dbConnected) { await db.query(`UPDATE users SET profile_image=$1 WHERE username='Buddika' AND role='admin'`, { bind: [filename] }); }
        res.redirect('/admin/profile?uploaded=1');
    } catch(e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/admin/profile'</script>`); }
});

// ============================================
// ADMIN - COURSES
// ============================================
app.get('/admin/courses', adminAuth, async (req, res) => {
    let courses = []; if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM courses ORDER BY created_at DESC`); courses = rows; } catch(e) {} }
    let cc = ''; if (courses.length > 0) { courses.forEach(c => { cc += `<div class="course-card"><h3>📚 ${c.title}</h3><p style="color:#666;margin:8px 0;">${c.description||''}</p><p style="font-size:13px;color:#999;">Rs.${c.price||0} | ${c.status}</p><div style="margin-top:15px;"><a href="/admin/courses/${c.id}/lessons" class="btn-small">📖 Lessons</a><a href="/admin/courses/delete/${c.id}" class="btn-small btn-danger" onclick="return confirm('Delete?')">🗑️</a></div></div>`; }); } else { cc = '<p style="color:#666;text-align:center;padding:30px;">No courses yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>Courses</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:20px}input,textarea,select{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:10px}.course-card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:15px}.course-card h3{color:#1a237e}.btn-small{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin:3px;background:#1a237e;color:white}.btn-danger{background:#dc3545}</style></head><body><div class="header"><h1>📚 Courses</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>➕ Create Course</h2><form action="/admin/courses/create" method="POST"><input type="text" name="title" placeholder="Course Title" required><textarea name="description" placeholder="Description" rows="3"></textarea><input type="number" name="price" placeholder="Price (Rs.)" value="0"><select name="status"><option value="published">Published</option><option value="draft">Draft</option></select><button type="submit">➕ Create</button></form></div><h2>📖 All Courses</h2>${cc}</div></body></html>`);
});

app.post('/admin/courses/create', adminAuth, async (req, res) => { const { title, description, price, status } = req.body; if (!title) return res.send(`<script>alert('Title required!');window.location.href='/admin/courses'</script>`); if (dbConnected) { await db.query(`INSERT INTO courses (title, description, price, status) VALUES ($1,$2,$3,$4)`, { bind: [title, description, price, status] }); } res.redirect('/admin/courses'); });
app.get('/admin/courses/delete/:id', adminAuth, async (req, res) => { if (dbConnected) { await db.query(`DELETE FROM courses WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/courses'); });

// ============================================
// ADMIN - LESSONS
// ============================================
app.get('/admin/courses/:courseId/lessons', adminAuth, async (req, res) => {
    const courseId = req.params.courseId; let course = { title: 'Unknown' }; let lessons = [];
    if (dbConnected) { try { const [c] = await db.query(`SELECT * FROM courses WHERE id=$1`, { bind: [courseId] }); if (c.length > 0) course = c[0]; const [l] = await db.query(`SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_number`, { bind: [courseId] }); lessons = l; } catch(e) {} }
    let ll = ''; if (lessons.length > 0) { lessons.forEach(l => { ll += `<div class="lesson-card"><div><strong style="color:#1a237e;">📖 ${l.title}</strong><span style="background:#e3f2fd;color:#1565c0;padding:3px 10px;border-radius:12px;font-size:12px;margin-left:10px;">${l.topic_name||''}</span>${l.zoom_link?'<br><small style="color:#28a745;">📡 '+l.zoom_link.substring(0,50)+'...</small>':''}${l.video_url?'<br><small style="color:#2563eb;">🎬 '+l.video_url.substring(0,50)+'...</small>':''}</div><a href="/admin/lessons/delete/${l.id}?courseId=${courseId}" class="btn-small btn-danger" onclick="return confirm('Delete?')">🗑️</a></div>`; }); } else { ll = '<p style="color:#666;text-align:center;padding:20px;">No lessons yet.</p>'; }
    res.send(`<!DOCTYPE html><html><head><title>Lessons - ${course.title}</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:900px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:20px}input{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:10px}.lesson-card{background:white;padding:15px 20px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.05);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}.btn-small{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin:3px;background:#1a237e;color:white}.btn-danger{background:#dc3545}.info-box{background:#e3f2fd;color:#1565c0;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px}</style></head><body><div class="header"><h1>📖 Lessons: ${course.title}</h1><a href="/admin/courses" class="back">← Courses</a></div><div class="container"><div class="info-box">💡 Zoom Link = Live Session | Video URL = Recording</div><div class="card"><h2>➕ Add Lesson</h2><form action="/admin/lessons/create" method="POST"><input type="hidden" name="courseId" value="${courseId}"><input type="text" name="title" placeholder="Lesson Title" required><input type="text" name="topicName" placeholder="Topic Name"><input type="text" name="zoomLink" placeholder="📡 Zoom Link"><input type="text" name="videoUrl" placeholder="🎬 Video URL"><input type="number" name="orderNumber" placeholder="Order" value="${lessons.length+1}"><button type="submit">➕ Add</button></form></div><h2>📚 Lessons</h2>${ll}</div></body></html>`);
});

app.post('/admin/lessons/create', adminAuth, async (req, res) => { try { const { courseId, title, topicName, zoomLink, videoUrl, orderNumber } = req.body; if (!title) return res.send(`<script>alert('Title required!');window.location.href='/admin/courses/${courseId}/lessons'</script>`); if (dbConnected) { await db.query(`INSERT INTO lessons (course_id, title, topic_name, zoom_link, video_url, order_number) VALUES ($1,$2,$3,$4,$5,$6)`, { bind: [courseId, title, topicName, zoomLink, videoUrl, orderNumber||0] }); } res.redirect(`/admin/courses/${courseId}/lessons`); } catch (e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/admin/courses/${req.body.courseId}/lessons'</script>`); } });
app.get('/admin/lessons/delete/:id', adminAuth, async (req, res) => { const courseId = req.query.courseId; if (dbConnected) { await db.query(`DELETE FROM lessons WHERE id=$1`, { bind: [req.params.id] }); } res.redirect(`/admin/courses/${courseId}/lessons`); });

// ============================================
// ADMIN - ENROLLMENTS
// ============================================
app.get('/admin/enrollments', adminAuth, async (req, res) => {
    let enrollments = []; let courses = []; let students = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT e.*, u.student_id, u.full_name, u.mobile_number, c.title as course_title FROM enrollments e JOIN users u ON e.user_id = u.id JOIN courses c ON e.course_id = c.id ORDER BY e.created_at DESC`); enrollments = rows; const [cRows] = await db.query(`SELECT * FROM courses WHERE status='published'`); courses = cRows; const [sRows] = await db.query(`SELECT id, student_id, full_name FROM users WHERE role='student'`); students = sRows; } catch(e) {} }
    let tr = ''; if (enrollments.length > 0) { enrollments.forEach(e => { const sc = e.status==='active'?'#28a745':e.status==='revoked'?'#dc3545':'#ffc107'; const pc = e.payment_status==='verified'?'#28a745':e.payment_status==='pending_verification'?'#17a2b8':'#dc3545'; tr += `<tr><td><strong>${e.student_id}</strong></td><td>${e.full_name}</td><td>${e.mobile_number}</td><td>${e.course_title}</td><td><span style="background:${sc};color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${e.status}</span></td><td><span style="background:${pc};color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${e.payment_status}</span></td><td>${e.payment_proof?'<a href="'+e.payment_proof+'" target="_blank">📎</a>':'N/A'}</td><td>${e.payment_status==='pending_verification'?`<a href="/admin/enrollments/verify/${e.id}" class="btn-mini btn-approve" onclick="return confirm('Approve?')">✅</a>`:''}${e.status==='active'?`<a href="/admin/enrollments/revoke/${e.id}" class="btn-mini btn-revoke" onclick="return confirm('Revoke?')">❌</a>`:e.status==='revoked'?`<a href="/admin/enrollments/activate/${e.id}" class="btn-mini btn-approve">🔄</a>`:''}<a href="/admin/enrollments/delete/${e.id}" class="btn-mini btn-delete" onclick="return confirm('Delete?')">🗑️</a></td></tr>`; }); } else { tr = '<tr><td colspan="8" style="text-align:center;padding:30px;">No enrollments yet.</td></tr>'; }
    let co = courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    let so = students.map(s => `<option value="${s.id}">${s.student_id} - ${s.full_name}</option>`).join('');
    res.send(`<!DOCTYPE html><html><head><title>Enrollments</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1200px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:20px}input,select{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:10px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1a237e;color:white;padding:10px;font-size:12px}td{padding:10px;border-bottom:1px solid #eee}tr:hover{background:#f5f5f5}.btn-mini{padding:5px 12px;border-radius:5px;text-decoration:none;font-size:11px;font-weight:bold;display:inline-block;margin:2px;color:white}.btn-approve{background:#28a745}.btn-revoke{background:#dc3545}.btn-delete{background:#6c757d}.info-box{background:#e8f5e9;color:#2e7d32;padding:15px;border-radius:8px;margin-bottom:20px;font-size:13px}</style></head><body><div class="header"><h1>💰 Payments</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="info-box">💡 Student pays → Sends receipt → Admin Approves → Access granted</div><div class="card"><h2>➕ Manual Enroll</h2><form action="/admin/enrollments/create" method="POST"><select name="studentId" required><option value="">Select Student...</option>${so}</select><select name="courseId" required><option value="">Select Course...</option>${co}</select><select name="status"><option value="active">Active (Approve)</option><option value="pending">Pending</option></select><button type="submit">➕ Enroll</button></form></div><div class="card"><h2>All Enrollments</h2><div style="overflow-x:auto"><table><thead><tr><th>Student ID</th><th>Name</th><th>Mobile</th><th>Course</th><th>Status</th><th>Payment</th><th>Proof</th><th>Action</th></tr></thead><tbody>${tr}</tbody></table></div></div></div></body></html>`);
});

app.post('/admin/enrollments/create', adminAuth, async (req, res) => { const { studentId, courseId, status } = req.body; if (dbConnected) { await db.query(`INSERT INTO enrollments (user_id, course_id, status, payment_status) VALUES ($1,$2,$3,$4)`, { bind: [studentId, courseId, status||'active', status==='active'?'verified':'unpaid'] }); } res.redirect('/admin/enrollments'); });
app.get('/admin/enrollments/verify/:id', adminAuth, async (req, res) => { if (dbConnected) { await db.query(`UPDATE enrollments SET payment_status='verified', status='active', enrolled_at=NOW() WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/enrollments'); });
app.get('/admin/enrollments/revoke/:id', adminAuth, async (req, res) => { if (dbConnected) { await db.query(`UPDATE enrollments SET status='revoked', revoked_at=NOW() WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/enrollments'); });
app.get('/admin/enrollments/activate/:id', adminAuth, async (req, res) => { if (dbConnected) { await db.query(`UPDATE enrollments SET status='active' WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/enrollments'); });
app.get('/admin/enrollments/delete/:id', adminAuth, async (req, res) => { if (dbConnected) { await db.query(`DELETE FROM enrollments WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/enrollments'); });

// ============================================
// ADMIN - STUDENTS, INACTIVE, ANALYTICS
// ============================================
app.get('/admin/students', adminAuth, async (req, res) => {
    let students = []; if (dbConnected) { try { const [rows] = await db.query(`SELECT student_id, full_name, email, mobile_number, school_name, district, city, nic_number, is_active, last_login_at FROM users WHERE role='student' ORDER BY created_at DESC`); students = rows; } catch(e) {} }
    let tr = ''; if (students.length > 0) { students.forEach(s => { tr += `<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.mobile_number}</td><td>${s.school_name||'N/A'}</td><td>${s.district||'N/A'}</td><td>${s.nic_number||'N/A'}</td><td><span class="badge ${s.is_active?'active':'inactive'}">${s.is_active?'Active':'Inactive'}</span></td><td>${s.last_login_at?new Date(s.last_login_at).toLocaleDateString():'Never'}</td></tr>`; }); } else { tr = '<tr><td colspan="8" style="text-align:center;padding:30px;">No students yet.</td></tr>'; }
    res.send(`<!DOCTYPE html><html><head><title>Students</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1200px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#1a237e;color:white;padding:12px;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:13px}tr:hover{background:#f5f5f5}.badge{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}.active{background:#d4edda;color:#155724}.inactive{background:#f8d7da;color:#721c24}.search-box{margin-bottom:20px}.search-box input{padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;width:300px}.count{background:#e3f2fd;color:#1565c0;padding:10px 20px;border-radius:8px;display:inline-block;margin-bottom:15px;font-weight:bold}</style></head><body><div class="header"><h1>👥 Students</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>All Students</h2><div class="count">📊 Total: ${students.length}</div><div class="search-box"><input type="text" id="si" placeholder="🔍 Search..." onkeyup="searchTable()"></div><table id="st"><thead><tr><th>Student ID</th><th>Name</th><th>Mobile</th><th>School</th><th>District</th><th>NIC</th><th>Status</th><th>Last Login</th></tr></thead><tbody>${tr}</tbody></table></div></div><script>function searchTable(){var i=document.getElementById('si'),f=i.value.toUpperCase(),t=document.getElementById('st'),r=t.getElementsByTagName('tr');for(var j=1;j<r.length;j++){var d=r[j].getElementsByTagName('td'),o=false;for(var k=0;k<d.length;k++){if(d[k]&&d[k].textContent.toUpperCase().indexOf(f)>-1){o=true;break}}r[j].style.display=o?'':'none'}}</script></body></html>`);
});

app.get('/admin/inactivity', adminAuth, async (req, res) => {
    let inactive = []; if (dbConnected) { try { const [rows] = await db.query(`SELECT student_id, full_name, mobile_number, last_login_at FROM users WHERE role='student' AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '7 days') ORDER BY last_login_at ASC NULLS FIRST`); inactive = rows; } catch(e) {} }
    let tr = ''; if (inactive.length > 0) { inactive.forEach(s => { const days = s.last_login_at ? Math.floor((Date.now() - new Date(s.last_login_at)) / (86400000)) : 'Never'; tr += `<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.mobile_number}</td><td>${s.last_login_at?new Date(s.last_login_at).toLocaleDateString():'Never'}</td><td><span class="badge">${days} days</span></td></tr>`; }); } else { tr = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#28a745;">✅ All students active!</td></tr>'; }
    res.send(`<!DOCTYPE html><html><head><title>Inactive</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#dc3545,#c82333);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#dc3545;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#dc3545;color:white;padding:12px;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:14px}.badge{background:#f8d7da;color:#721c24;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}.count{background:#f8d7da;color:#721c24;padding:10px 20px;border-radius:8px;display:inline-block;margin-bottom:15px;font-weight:bold}</style></head><body><div class="header"><h1>🚨 Inactive (7+ Days)</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>Inactive Students</h2><div class="count">⚠️ ${inactive.length} Inactive</div><table><thead><tr><th>Student ID</th><th>Name</th><th>Mobile</th><th>Last Login</th><th>Status</th></tr></thead><tbody>${tr}</tbody></table></div></div></body></html>`);
});

app.get('/admin/analytics', adminAuth, async (req, res) => {
    let t=0,a=0,i=0; if (dbConnected) { try { const [r1]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student'`); t=r1[0]?.c||0; const [r2]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student' AND last_login_at > NOW() - INTERVAL '1 day'`); a=r2[0]?.c||0; const [r3]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student' AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '7 days')`); i=r3[0]?.c||0; } catch(e) {} }
    res.send(`<!DOCTYPE html><html><head><title>Analytics</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:900px;margin:25px auto;padding:0 20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}.card{background:white;padding:30px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);text-align:center}.card .icon{font-size:40px;margin-bottom:10px}.card .num{font-size:42px;font-weight:bold;color:#1a237e;margin:10px 0}.card .label{color:#666;font-size:14px}.green{border-top:4px solid #28a745}.blue{border-top:4px solid #1a237e}.red{border-top:4px solid #dc3545}</style></head><body><div class="header"><h1>📊 Analytics</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="cards"><div class="card blue"><div class="icon">👥</div><div class="num">${t}</div><div class="label">Total Students</div></div><div class="card green"><div class="icon">✅</div><div class="num">${a}</div><div class="label">Active Today</div></div><div class="card red"><div class="icon">🚨</div><div class="num">${i}</div><div class="label">Inactive 7+ Days</div></div></div></div></body></html>`);
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
    console.log(`⚗️  ${TEACHER.name} LMS`);
    console.log(`✅ http://localhost:${PORT}`);
    console.log(`🔑 Admin: Buddika / Buddika@2024`);
    console.log(`📷 Upload Photo: /admin/profile`);
    console.log(`📱 WhatsApp: ${TEACHER.whatsapp}`);
    console.log('===================================');
});
