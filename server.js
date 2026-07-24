require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// Upload folder
const uploadDir = path.join(__dirname, 'public', 'uploads');
try { if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); } } catch(e) {}

// Multer
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, uploadDir), filename: (req, file, cb) => { cb(null, 'file_' + Date.now() + path.extname(file.originalname)); } });
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { cb(null, /jpeg|jpg|png|gif|webp|pdf/.test(path.extname(file.originalname).toLowerCase())); } });

// Create PWA files if not exist
const swPath = path.join(__dirname, 'public', 'service-worker.js');
if (!fs.existsSync(swPath)) {
    fs.writeFileSync(swPath, `const CACHE_NAME = 'chemistry-lms-v1';const ASSETS = ['/','/login','/register','/manifest.json','/offline.html'];self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)))});self.addEventListener('fetch',(e)=>{e.respondWith(caches.match(e.request).then(response=>{return response||fetch(e.request).then(fetchResponse=>{return caches.open(CACHE_NAME).then(cache=>{cache.put(e.request,fetchResponse.clone());return fetchResponse})})}).catch(()=>{if(e.request.mode==='navigate'){return caches.match('/offline.html')}}))});self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then(keys=>{return Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))}))});`);
}

const offlinePath = path.join(__dirname, 'public', 'offline.html');
if (!fs.existsSync(offlinePath)) {
    fs.writeFileSync(offlinePath, `<!DOCTYPE html><html><head><title>Offline</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh;color:white}.box{text-align:center;padding:40px}.icon{font-size:80px}h1{font-size:28px;margin:20px 0}p{opacity:0.8}.btn{display:inline-block;padding:12px 25px;background:white;color:#1a237e;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:20px}</style></head><body><div class="box"><div class="icon">📡</div><h1>No Internet</h1><p>Please check your connection</p><a href="/" class="btn">🔄 Retry</a></div></body></html>`);
}

// Teacher Settings
const T = {
    name: process.env.TEACHER_NAME || 'Buddika Wijesundara',
    email: process.env.TEACHER_EMAIL || 'buddhika@chemistry.lk',
    phone: process.env.TEACHER_PHONE || '0712345678',
    whatsapp: process.env.WHATSAPP_NUMBER || '94771234567',
    bankName: process.env.BANK_NAME || 'Sampath Bank',
    bankAccountName: process.env.BANK_ACCOUNT_NAME || 'B Wijesundara',
    bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
    bankBranch: process.env.BANK_BRANCH || 'Galle'
};

const DISTRICTS = ['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'];

// Database with timeout
let db = null; let dbConnected = false;
try {
    const { Sequelize } = require('sequelize');
    if (process.env.DATABASE_URL) {
        db = new Sequelize(process.env.DATABASE_URL, { 
            dialect: 'postgres', 
            logging: false, 
            dialectOptions: { 
                ssl: { require: true, rejectUnauthorized: false },
                connectTimeout: 10000
            },
            pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
        });
        db.authenticate().then(async () => {
            dbConnected = true; console.log('✅ DB');
            try {
                await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, student_id VARCHAR(50) UNIQUE, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL, mobile_number VARCHAR(20) UNIQUE NOT NULL, nic_number VARCHAR(30), school_name VARCHAR(255), district VARCHAR(100), city VARCHAR(100), birthdate DATE, gender VARCHAR(20), address TEXT, profile_image VARCHAR(500), profile_updated BOOLEAN DEFAULT false, role VARCHAR(20) DEFAULT 'student', is_active BOOLEAN DEFAULT true, last_login_at TIMESTAMP, reset_token VARCHAR(255), reset_token_expires TIMESTAMP, verification_code VARCHAR(10), session_token VARCHAR(255), session_device VARCHAR(500), delete_requested BOOLEAN DEFAULT false, delete_requested_by INTEGER, can_delete_students BOOLEAN DEFAULT false, can_manage_lessons BOOLEAN DEFAULT false, can_send_reset_codes BOOLEAN DEFAULT false, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) DEFAULT 0, status VARCHAR(20) DEFAULT 'draft', is_paper BOOLEAN DEFAULT false, paper_url VARCHAR(500), answer_url VARCHAR(500), created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, topic_name VARCHAR(255), zoom_link VARCHAR(500), video_url VARCHAR(500), order_number INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS enrollments (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', payment_status VARCHAR(20) DEFAULT 'unpaid', payment_proof VARCHAR(500), enrolled_at TIMESTAMP DEFAULT NOW(), expires_at TIMESTAMP, revoked_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT, created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())`);
                await db.query(`CREATE TABLE IF NOT EXISTS video_tracking (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), lesson_id INTEGER REFERENCES lessons(id), started_at TIMESTAMP DEFAULT NOW(), last_watched_at TIMESTAMP DEFAULT NOW(), watched_seconds INTEGER DEFAULT 0, completed BOOLEAN DEFAULT false, device_info VARCHAR(500))`);
                await db.query(`CREATE TABLE IF NOT EXISTS notification_logs (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), type VARCHAR(50), subject VARCHAR(255), sent_to VARCHAR(255), status VARCHAR(20), sent_at TIMESTAMP DEFAULT NOW())`);
                const [admin] = await db.query(`SELECT * FROM users WHERE username = 'Buddika'`);
                if (admin.length === 0) { const hash = await bcrypt.hash('Buddika@2024', 12); await db.query(`INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, is_active, can_delete_students, can_manage_lessons, can_send_reset_codes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, { bind: ['BC-ADMIN-001', 'Buddika', T.email, hash, T.name, T.phone, 'admin', true, true, true, true] }); }
            } catch (e) { console.error(e.message); }
        }).catch((err) => { console.log('DB Error:', err.message); dbConnected = false; });
    }
} catch (e) { console.log('DB Setup:', e.message); }

// Middleware
app.use(express.json({ limit: '10mb' })); app.use(express.urlencoded({ extended: true, limit: '10mb' })); app.use(express.static('public')); app.use('/uploads', express.static(uploadDir));
app.use(session({ secret: process.env.SESSION_SECRET || 'Buddika@2024_LMS', resave: false, saveUninitialized: false, cookie: { secure: false, maxAge: 86400000 } }));

function auth(req, res, next) { return req.session && req.session.isLoggedIn ? next() : res.redirect('/login'); }
function adminAuth(req, res, next) {
    if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
    if (req.session.userRole === 'admin' || req.session.userRole === 'sub_admin') return next();
    return res.redirect('/student/dashboard');
}

async function checkDeviceSession(req, res, next) {
    if (!req.session || !req.session.isLoggedIn) return next();
    if (req.session.userRole !== 'student') return next();
    if (!dbConnected) return next();
    try {
        const [user] = await db.query(`SELECT session_token, is_active FROM users WHERE id=$1`, { bind: [req.session.userId] });
        if (user.length === 0) { req.session.destroy(); return res.redirect('/login?msg=account_deleted'); }
        if (!user[0].is_active) { req.session.destroy(); return res.redirect('/login?msg=account_deactivated'); }
        if (user[0].session_token && req.session.deviceToken !== user[0].session_token) { req.session.destroy(); return res.redirect('/login?msg=another_device'); }
    } catch(e) {}
    next();
}

// Shared
const BSI = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">';
async function teacherImg(size = 55) { if (!dbConnected) return `<div style="width:${size}px;height:${size}px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size/2.5}px;color:white;">👨‍🏫</div>`; try { const [a] = await db.query(`SELECT profile_image FROM users WHERE username='Buddika' AND role='admin'`); if (a.length > 0 && a[0].profile_image) return `<img src="/uploads/${a[0].profile_image}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`; } catch(e) {} return `<div style="width:${size}px;height:${size}px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size/2.5}px;color:white;">👨‍🏫</div>`; }
async function getPerms(uid) { if (!dbConnected) return {}; try { const [r] = await db.query(`SELECT can_delete_students, can_manage_lessons, can_send_reset_codes FROM users WHERE id=$1`, { bind: [uid] }); return r[0] || {}; } catch(e) { return {}; } }

// Email Function
async function sendEmail(to, subject, htmlContent) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        await transporter.sendMail({
            from: `"${T.name} LMS" <${process.env.SMTP_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        return { success: true };
    } catch(e) {
        console.error('Email Error:', e.message);
        return { success: false, error: e.message };
    }
}

async function logNotification(userId, type, subject, sentTo, status) {
    if (!dbConnected) return;
    try {
        await db.query(`INSERT INTO notification_logs (user_id, type, subject, sent_to, status) VALUES ($1,$2,$3,$4,$5)`, 
            { bind: [userId, type, subject, sentTo, status] });
    } catch(e) {}
}

async function sendRegistrationEmail(userEmail, fullName, studentId) {
    const html = `
    <div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);padding:20px;border-radius:15px;">
        <div style="background:white;padding:30px;border-radius:10px;text-align:center;">
            <div style="font-size:50px;">⚗️</div>
            <h1 style="color:#1a237e;">Welcome to Chemistry LMS!</h1>
            <p style="color:#666;font-size:16px;">👨‍🏫 ${T.name}</p>
            <div style="background:#f0f0f0;padding:20px;border-radius:10px;margin:20px 0;">
                <p style="font-size:14px;color:#666;">Your Student ID:</p>
                <h2 style="color:#1a237e;font-size:36px;">${studentId}</h2>
                <p style="font-size:14px;color:#666;">Name: ${fullName}</p>
            </div>
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/login" style="display:inline-block;padding:14px 30px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">🔐 Login Now</a>
            <div style="margin-top:20px;padding:15px;background:#e3f2fd;border-radius:8px;">
                <p style="color:#1565c0;font-size:13px;">📱 Contact Teacher:</p>
                <p style="color:#1565c0;font-size:13px;">📧 ${T.email} | 📞 ${T.phone}</p>
            </div>
        </div>
    </div>`;
    
    return await sendEmail(userEmail, `🎉 Welcome to Chemistry LMS - Your ID: ${studentId}`, html);
}

// ============================================
// PWA
// ============================================
app.get('/manifest.json', (req, res) => {
    res.json({
        name: `${T.name} | Chemistry LMS`,
        short_name: 'Chemistry LMS',
        description: 'Advanced Level Chemistry Learning Management System',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a237e',
        theme_color: '#1a237e',
        orientation: 'portrait-primary',
        icons: [{
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
        }, {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
        }]
    });
});

// ============================================
// HOME
// ============================================
app.get('/', async (req, res) => { 
    let dbStatus = '❌ Not Connected';
    if (dbConnected) { try { const [count] = await db.query(`SELECT COUNT(*) as c FROM users`); dbStatus = `✅ DB Connected | ${count[0].c} Users`; } catch(e) { dbStatus = '✅ DB Connected'; } }
    res.send(`<!DOCTYPE html><html><head><title>${T.name} | Chemistry LMS</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#1a237e"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.card{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:480px;width:100%;text-align:center}.logo{width:80px;height:80px;background:linear-gradient(135deg,#1a237e,#4a148c);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:35px;color:white}h1{color:#1a237e;font-size:22px}.name{color:#1a237e;font-weight:bold;font-size:16px;margin:10px 0;background:#f0f0f0;padding:8px 20px;border-radius:25px;display:inline-block}.db-info{font-size:11px;color:#666;margin:15px 0;background:#f9f9f9;padding:8px;border-radius:5px}.btn{display:block;padding:15px;margin:10px 0;border-radius:10px;text-decoration:none;color:white;font-weight:bold;font-size:16px}.btn-login{background:#1a237e}.btn-register{background:#28a745}.footer{margin-top:20px;font-size:12px;color:#999}.install-btn{display:none;padding:10px 20px;background:#ff9800;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin:10px 0;font-size:14px}</style><script>window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();window.deferredPrompt=e;document.getElementById('installBtn').style.display='inline-block'});function installApp(){if(window.deferredPrompt){window.deferredPrompt.prompt();window.deferredPrompt.userChoice.then(r=>{window.deferredPrompt=null;document.getElementById('installBtn').style.display='none'})}}</script></head><body><div class="card"><div class="logo">⚗️</div><h1>Advanced Level Chemistry</h1><p style="color:#666;font-size:14px">Learning Management System</p><p class="name">👨‍🏫 ${T.name}</p><button id="installBtn" class="install-btn" onclick="installApp()">📱 Install App</button><div class="db-info">${dbStatus}</div><a href="/login" class="btn btn-login">🔐 Login</a><a href="/register" class="btn btn-register">📝 New Registration</a><div class="footer">© 2026 ${T.name}</div></div></body></html>`); 
});

// ============================================
// REGISTER
// ============================================
app.get('/register', (req, res) => { res.send(`<!DOCTYPE html><html><head><title>Register</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json">${BSI}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:450px}h2{text-align:center;color:#1a237e;font-size:22px}.sub{text-align:center;color:#666;margin-bottom:20px}.input-group{position:relative;margin:8px 0}.input-group input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}.input-group input[type="password"]{padding-right:45px}.toggle-password{position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;padding:8px;z-index:10;color:#666;font-size:18px;transition:0.2s}.toggle-password:hover{color:#1a237e}.warn{background:#fff3cd;color:#856404;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}.info{background:#e3f2fd;color:#1565c0;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}</style></head><body><div class="box"><h2>📝 Student Registration</h2><p class="sub">👨‍🏫 ${T.name}</p><form action="/register" method="POST"><div class="input-group"><input type="text" name="fullName" placeholder="Full Name" required></div><div class="input-group"><input type="email" name="email" placeholder="Email" required></div><div class="input-group"><input type="tel" name="mobile" placeholder="Mobile" pattern="[0-9]{10,12}" required></div><div class="warn">⚠️ One Mobile = One ID</div><div class="info">🆔 Auto ID: BC-1001</div><div class="input-group"><input type="password" name="password" id="rp" placeholder="Password (min 6)" minlength="6" required><span class="toggle-password" onclick="togglePass('rp',this)"><i class="bi bi-eye"></i></span></div><button type="submit">📝 Register</button></form><div class="link"><a href="/login">Login</a> | <a href="/">Home</a></div></div><script>function togglePass(id,el){var i=document.getElementById(id);var icon=el.querySelector('i');if(i.type==='password'){i.type='text';icon.className='bi bi-eye-slash';el.style.color='#dc3545'}else{i.type='password';icon.className='bi bi-eye';el.style.color='#666'}}</script></body></html>`); });

app.post('/register', async (req, res) => { 
    try { 
        const { fullName, email, mobile, password } = req.body; 
        if (!fullName || !email || !mobile || !password) return res.send(`<script>alert('All fields required!');window.location.href='/register'</script>`); 
        if (!dbConnected) return res.send(`<script>alert('DB not connected!');window.location.href='/register'</script>`); 
        const [mob] = await db.query(`SELECT * FROM users WHERE mobile_number=$1`,{bind:[mobile]}); 
        if(mob.length>0) return res.send(`<script>alert('Mobile already registered!');window.location.href='/register'</script>`); 
        const [em] = await db.query(`SELECT * FROM users WHERE email=$1`,{bind:[email]}); 
        if(em.length>0) return res.send(`<script>alert('Email already registered!');window.location.href='/register'</script>`); 
        const [last] = await db.query(`SELECT student_id FROM users WHERE role='student' ORDER BY id DESC LIMIT 1`); 
        let num=1001; 
        if(last.length>0&&last[0].student_id){const n=parseInt(last[0].student_id.replace('BC-',''));if(!isNaN(n))num=n+1;} 
        const sid='BC-'+num; 
        const hash=await bcrypt.hash(password,12); 
        const [newUser] = await db.query(`INSERT INTO users (student_id,username,email,password,full_name,mobile_number,role,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,{bind:[sid,email.split('@')[0]+'_'+Date.now(),email,hash,fullName,mobile,'student',true]});
        
        // Send registration email
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            sendRegistrationEmail(email, fullName, sid).then(result => {
                if (newUser.length > 0) {
                    logNotification(newUser[0].id, 'registration', 'Welcome Email', email, result.success ? 'sent' : 'failed');
                }
            });
        }
        
        res.send(`<!DOCTYPE html><html><head><title>Success!</title><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;padding:40px;border-radius:20px;text-align:center}.icon{font-size:70px}h1{color:#28a745}.id-box{font-size:36px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:15px;border-radius:10px;margin:20px 0}.btn{display:inline-block;padding:14px 30px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}</style></head><body><div class="card"><div class="icon">🎉</div><h1>Registration Successful!</h1><div class="id-box">🆔 ${sid}</div><p>✅ ${fullName}<br>✅ ${email}<br>✅ ${mobile}</p><a href="/login" class="btn">🔐 Login Now</a></div></body></html>`); 
    } catch (e) { 
        res.send(`<script>alert('Error');window.location.href='/register'</script>`); 
    } 
});

// ============================================
// LOGIN
// ============================================
app.get('/login', (req, res) => { 
    let msg = '';
    if (req.query.msg === 'another_device') msg = '<div style="background:#fff3cd;color:#856404;padding:12px;border-radius:8px;margin-bottom:15px;text-align:center;font-size:13px;font-weight:bold">⚠️ Logged in from another device. This device logged out.</div>';
    if(req.session&&req.session.isLoggedIn){ const r=req.session.userRole; if(r==='admin'||r==='sub_admin') return res.redirect('/admin/dashboard'); return res.redirect('/student/dashboard'); } 
    res.send(`<!DOCTYPE html><html><head><title>Login - ${T.name}</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="manifest" href="/manifest.json">${BSI}<style>
        *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
        .box{background:white;padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:100%;max-width:420px}
        .logo{text-align:center;font-size:50px;margin-bottom:10px}h2{text-align:center;color:#1a237e;font-size:24px;margin-bottom:5px}
        .sub{text-align:center;color:#666;margin-bottom:25px;font-size:14px}
        .input-group{position:relative;margin:12px 0}
        .input-group input{width:100%;padding:14px 14px 14px 45px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;transition:0.3s;background:#fafafa}
        .input-group input:focus{border-color:#1a237e;outline:none;box-shadow:0 0 0 3px rgba(26,35,126,0.1);background:#fff}
        .input-group input[type="password"]{padding-right:50px}
        .input-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:#999;font-size:18px}
        .toggle-password{position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;padding:8px;z-index:10;color:#666;font-size:18px;transition:0.2s}.toggle-password:hover{color:#1a237e}
        button{width:100%;padding:15px;background:#1a237e;color:white;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:20px;transition:0.3s}
        button:hover{background:#0d1457;transform:translateY(-2px);box-shadow:0 5px 20px rgba(26,35,126,0.3)}
        .link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}
        .forgot{text-align:right;margin-top:5px}.forgot a{color:#dc3545;font-size:13px;text-decoration:none}
        .info-box{background:#e3f2fd;color:#1565c0;padding:10px;border-radius:8px;font-size:12px;margin-top:15px;text-align:center}
    </style></head><body><div class="box"><div class="logo">⚗️</div><h2>🔐 Welcome Back!</h2><p class="sub">${T.name} | Chemistry LMS</p>${msg}
        <form action="/login" method="POST">
            <div class="input-group"><span class="input-icon">👤</span><input type="text" name="username" placeholder="Student ID (BC-1001) or Email" required autofocus></div>
            <div class="input-group"><span class="input-icon">🔑</span><input type="password" name="password" id="lp" placeholder="Password" required><span class="toggle-password" onclick="togglePass('lp',this)"><i class="bi bi-eye"></i></span></div>
            <div class="forgot"><a href="/forgot-password">Forgot Password?</a></div><button type="submit">🔐 Login</button>
        </form>
        <div class="link"><a href="/register">📝 New Student? Register</a></div><div class="link"><a href="/">🏠 Home</a></div>
        <div class="info-box">💡 Login with <strong>Student ID</strong> (BC-1001) or <strong>Email</strong></div>
    </div><script>function togglePass(id,el){var i=document.getElementById(id);var icon=el.querySelector('i');if(i.type==='password'){i.type='text';icon.className='bi bi-eye-slash';el.style.color='#dc3545'}else{i.type='password';icon.className='bi bi-eye';el.style.color='#666'}}</script></body></html>`); 
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if(!dbConnected) return res.send(`<script>alert('DB not connected!');window.location.href='/login'</script>`);
        const [users]=await db.query(`SELECT * FROM users WHERE email=$1 OR username=$1 OR student_id=$1`,{bind:[username]});
        if(users.length===0) return res.send(`<script>alert('User not found!');window.location.href='/login'</script>`);
        const user=users[0];
        if(!user.is_active) return res.send(`<script>alert('Account deactivated!');window.location.href='/login'</script>`);
        const valid=await bcrypt.compare(password,user.password);
        if(!valid) return res.send(`<script>alert('Wrong password!');window.location.href='/login'</script>`);
        if (user.role === 'student') {
            const newToken = crypto.randomBytes(32).toString('hex');
            await db.query(`UPDATE users SET session_token=$1, session_device=$2 WHERE id=$3`, { bind: [newToken, (req.headers['user-agent']||'Unknown').substring(0,200), user.id] });
            req.session.deviceToken = newToken;
        }
        await db.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`,{bind:[user.id]});
        req.session.isLoggedIn=true; req.session.userId=user.id; req.session.studentId=user.student_id; req.session.userName=user.full_name; req.session.userMobile=user.mobile_number; req.session.userRole=user.role;
        if(user.role==='admin'||user.role==='sub_admin'){ req.session.isAdminLoggedIn=true; return res.redirect('/admin/dashboard'); }
        return res.redirect('/student/dashboard');
    } catch(e){res.send(`<script>alert('Login failed!');window.location.href='/login'</script>`);}
});

// ============================================
// FORGOT PASSWORD
// ============================================
app.get('/forgot-password', (req, res) => { res.send(`<!DOCTYPE html><html><head><title>Forgot Password</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:420px}h2{text-align:center;color:#1a237e}p{text-align:center;color:#666;margin-bottom:20px}input{width:100%;padding:14px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}button{width:100%;padding:14px;background:#dc3545;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none}.info{background:#e3f2fd;color:#1565c0;padding:12px;border-radius:8px;font-size:13px;margin:10px 0;text-align:center}</style></head><body><div class="box"><h2>🔑 Forgot Password?</h2><p>Enter email. Teacher will verify.</p><form action="/forgot-password" method="POST"><input type="email" name="email" placeholder="Your Email" required><button type="submit">📱 Request Reset Code</button></form><div class="info">👨‍🏫 Teacher will verify via WhatsApp</div><div class="link"><a href="/login">← Back</a></div></div></body></html>`); });
app.post('/forgot-password', async (req, res) => { try { const { email } = req.body; if(!email) return res.send(`<script>alert('Email required!');</script>`); if(!dbConnected) return res.send(`<script>alert('DB not connected!');</script>`); const [users]=await db.query(`SELECT * FROM users WHERE email=$1`,{bind:[email]}); if(users.length===0) return res.send(`<script>alert('Email not found!');</script>`); const user=users[0]; const code=Math.floor(100000+Math.random()*900000).toString(); const token=crypto.randomBytes(32).toString('hex'); const expires=new Date(Date.now()+3600000); await db.query(`UPDATE users SET reset_token=$1,reset_token_expires=$2,verification_code=$3 WHERE email=$4`,{bind:[token,expires,code,email]}); const waMsg=encodeURIComponent(`🔑 Password Reset\n🆔 ${user.student_id}\n👤 ${user.full_name}\n📧 ${user.email}\n📱 ${user.mobile_number}`); res.send(`<!DOCTYPE html><html><head><title>Request Sent</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.3);width:100%;max-width:460px;text-align:center}h2{color:#1a237e;font-size:22px}.btn-wa{display:inline-block;padding:14px 30px;background:#25D366;color:white;text-decoration:none;border-radius:10px;font-weight:bold;margin:10px}.btn-back{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}input.code-input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:18px;text-align:center;letter-spacing:5px;margin:10px 0}button.submit{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}</style></head><body><div class="box"><h2>📱 Password Reset</h2><p><strong>${user.full_name} (${user.student_id})</strong></p><a href="https://wa.me/${T.whatsapp}?text=${waMsg}" target="_blank" class="btn-wa">📱 Send via WhatsApp</a><p style="color:#666;margin:15px 0">OR enter code:</p><form action="/verify-code" method="POST"><input type="hidden" name="token" value="${token}"><input type="hidden" name="email" value="${email}"><input type="text" name="code" class="code-input" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autofocus><button type="submit" class="submit">✅ Verify & Reset</button></form><a href="/login" class="btn-back">← Back</a></div></body></html>`); } catch(e) { res.send(`<script>alert('Error');window.location.href='/forgot-password'</script>`); } });
app.post('/verify-code', async (req, res) => { try { const { token, email, code } = req.body; if(!token||!email||!code) return res.send(`<script>alert('All fields required!');</script>`); if(dbConnected){const [users]=await db.query(`SELECT * FROM users WHERE email=$1 AND reset_token=$2 AND verification_code=$3 AND reset_token_expires > NOW()`,{bind:[email,token,code]}); if(users.length===0) return res.send(`<script>alert('Invalid code!');</script>`);} res.redirect(`/reset-password?token=${token}&verified=true`); } catch(e) { res.send(`<script>alert('Error');</script>`); } });
app.get('/reset-password', async (req, res) => { const { token, verified } = req.query; if(!token||!verified) return res.redirect('/forgot-password'); if(dbConnected){const [users]=await db.query(`SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`,{bind:[token]}); if(users.length===0) return res.send(`<script>alert('Expired!');</script>`);} res.send(`<!DOCTYPE html><html><head><title>Reset</title><meta charset="UTF-8">${BSI}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#28a745,#218838);display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.2);width:100%;max-width:420px}h2{color:#28a745;text-align:center}.verified{background:#d4edda;color:#155724;padding:10px;border-radius:8px;text-align:center;margin-bottom:20px;font-weight:bold}.input-group{position:relative;margin:10px 0}.input-group input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}.input-group input[type="password"]{padding-right:45px}.toggle-password{position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;padding:8px;z-index:10;color:#666;font-size:18px}button{width:100%;padding:14px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none}</style></head><body><div class="box"><h2>🔑 Reset Password</h2><div class="verified">✅ Enter New Password</div><form action="/reset-password" method="POST"><input type="hidden" name="token" value="${token}"><div class="input-group"><input type="password" name="password" id="np1" placeholder="New Password (min 6)" minlength="6" required><span class="toggle-password" onclick="togglePass('np1',this)"><i class="bi bi-eye"></i></span></div><div class="input-group"><input type="password" name="confirmPassword" id="np2" placeholder="Confirm Password" minlength="6" required><span class="toggle-password" onclick="togglePass('np2',this)"><i class="bi bi-eye"></i></span></div><button type="submit">🔐 Update</button></form><div class="link"><a href="/login">← Login</a></div></div><script>function togglePass(id,el){var i=document.getElementById(id);var icon=el.querySelector('i');if(i.type==='password'){i.type='text';icon.className='bi bi-eye-slash';el.style.color='#dc3545'}else{i.type='password';icon.className='bi bi-eye';el.style.color='#666'}}</script></body></html>`); });
app.post('/reset-password', async (req, res) => { try { const { token, password, confirmPassword } = req.body; if(!token||!password||!confirmPassword) return res.send(`<script>alert('All fields required!');</script>`); if(password!==confirmPassword) return res.send(`<script>alert('Passwords do not match!');</script>`); if(password.length<6) return res.send(`<script>alert('Min 6 characters!');</script>`); if(dbConnected){const [users]=await db.query(`SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`,{bind:[token]}); if(users.length===0) return res.send(`<script>alert('Expired!');</script>`); const hash=await bcrypt.hash(password,12); await db.query(`UPDATE users SET password=$1,reset_token=NULL,reset_token_expires=NULL,verification_code=NULL WHERE reset_token=$2`,{bind:[hash,token]});} res.send(`<!DOCTYPE html><html><head><title>Updated</title><style>*{margin:0}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#28a745,#218838);display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;text-align:center}h2{color:#28a745}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold}</style></head><body><div class="box"><h2>✅ Password Updated!</h2><a href="/login" class="btn">🔐 Login</a></div></body></html>`); } catch(e) { res.send(`<script>alert('Error');window.location.href='/login'</script>`); } });

// ============================================
// STUDENT PAGES
// ============================================
app.get('/student/dashboard', auth, checkDeviceSession, async (req, res) => { 
    if(req.session.userRole!=='student') return res.redirect('/admin/dashboard'); 
    let tImg = await teacherImg(50);
    
    // Get unread announcements count
    let annCount = 0;
    if (dbConnected) {
        try {
            const [count] = await db.query(`SELECT COUNT(*) as c FROM announcements`);
            annCount = count[0]?.c || 0;
        } catch(e) {}
    }
    
    res.send(`<!DOCTYPE html><html><head><title>Dashboard</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none}.container{max-width:700px;margin:30px auto;padding:20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}.teacher-card{background:white;padding:15px 20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px;display:flex;align-items:center;gap:12px}.id-badge{font-size:28px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:12px 25px;border-radius:10px;display:inline-block;margin:15px 0}.btn-courses{display:inline-block;padding:12px 25px;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:5px;background:#1a237e}.btn-pay{background:#25D366}.btn-profile{background:#ffc107;color:#333}.btn-ann{background:#ff9800}.ann-badge{background:#ff9800;color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:5px}</style></head><body><div class="header"><h1>👨‍🎓 Dashboard</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="teacher-card">${tImg}<div><strong style="color:#1a237e;font-size:15px;">${T.name}</strong><br><small style="color:#666;">Chemistry</small></div></div><div class="card"><h2 style="color:#1a237e">Welcome, ${req.session.userName}!</h2><div class="id-badge">🆔 ${req.session.studentId}</div><p><strong>📱</strong> ${req.session.userMobile||'N/A'}</p><div style="margin-top:20px"><a href="/student/courses" class="btn-courses">📚 Courses</a><a href="/student/payment" class="btn-courses btn-pay">💰 Payment</a><a href="/student/profile" class="btn-courses btn-profile">👤 Profile</a><a href="/student/announcements" class="btn-courses btn-ann">📢 Announcements ${annCount > 0 ? `<span class="ann-badge">${annCount}</span>` : ''}</a></div></div></div></body></html>`); 
});

app.get('/student/profile', auth, checkDeviceSession, async (req, res) => { 
    let user={}; 
    if(dbConnected){try{const [rows]=await db.query(`SELECT * FROM users WHERE id=$1`,{bind:[req.session.userId]}); if(rows.length>0) user=rows[0];}catch(e){}} 
    const distOpts = DISTRICTS.map(d=>`<option value="${d}" ${user.district===d?'selected':''}>${d}</option>`).join(''); 
    res.send(`<!DOCTYPE html><html><head><title>Profile</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none}.container{max-width:700px;margin:30px auto;padding:20px}.card{background:white;padding:30px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08)}h2{color:#1a237e}.id-badge{font-size:22px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:10px 20px;border-radius:10px;display:inline-block;margin-bottom:20px}.form-row{display:flex;gap:15px;flex-wrap:wrap}.form-group{flex:1;min-width:200px;margin-bottom:15px}.form-group label{display:block;font-weight:600;color:#333;margin-bottom:5px;font-size:13px}.form-group input,.form-group select,.form-group textarea{width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}.form-group textarea{resize:vertical;min-height:80px}.form-group input[readonly]{background:#f5f5f5;color:#666}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}.back-link{display:inline-block;margin-top:15px;color:#1a237e;text-decoration:none}.success-msg{background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;font-weight:bold}</style></head><body><div class="header"><h1>👤 Profile</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container">${req.query.saved?'<div class="success-msg">✅ Updated!</div>':''}<div class="card"><h2>Profile Details</h2><p style="color:#666;margin-bottom:20px;">👨‍🏫 ${T.name}</p><div class="id-badge">🆔 ${user.student_id||req.session.studentId}</div><form action="/student/profile/update" method="POST"><div class="form-row"><div class="form-group"><label>Full Name *</label><input type="text" name="fullName" value="${user.full_name||req.session.userName||''}" required></div><div class="form-group"><label>Email</label><input type="email" value="${user.email||''}" readonly></div></div><div class="form-row"><div class="form-group"><label>Mobile</label><input type="tel" value="${user.mobile_number||''}" readonly></div><div class="form-group"><label>NIC *</label><input type="text" name="nicNumber" value="${user.nic_number||''}" placeholder="200012345678" required></div></div><div class="form-row"><div class="form-group"><label>Birth Date</label><input type="date" name="birthdate" value="${user.birthdate?new Date(user.birthdate).toISOString().split('T')[0]:''}"></div><div class="form-group"><label>Gender</label><select name="gender"><option value="">Select</option><option value="male" ${user.gender==='male'?'selected':''}>Male</option><option value="female" ${user.gender==='female'?'selected':''}>Female</option></select></div></div><div class="form-row"><div class="form-group"><label>School *</label><input type="text" name="schoolName" value="${user.school_name||''}" required></div><div class="form-group"><label>District *</label><select name="district" required><option value="">Select District</option>${distOpts}</select></div></div><div class="form-row"><div class="form-group"><label>City *</label><input type="text" name="city" value="${user.city||''}" required></div><div class="form-group"><label>Address</label><textarea name="address">${user.address||''}</textarea></div></div><button type="submit">💾 Save</button></form><a href="/student/dashboard" class="back-link">← Dashboard</a></div></div></body></html>`); 
});

app.post('/student/profile/update', auth, async (req, res) => { try { const { fullName, nicNumber, birthdate, gender, schoolName, district, city, address } = req.body; if(!fullName||!nicNumber||!schoolName||!district||!city) return res.send(`<script>alert('Fill required fields!');window.location.href='/student/profile'</script>`); if(dbConnected){await db.query(`UPDATE users SET full_name=$1,nic_number=$2,birthdate=$3,gender=$4,school_name=$5,district=$6,city=$7,address=$8,profile_updated=true WHERE id=$9`,{bind:[fullName,nicNumber,birthdate||null,gender||null,schoolName,district,city,address||null,req.session.userId]});req.session.userName=fullName;} res.redirect('/student/profile?saved=1'); } catch(e) { res.send(`<script>alert('Error');window.location.href='/student/profile'</script>`); } });
app.get('/student/payment', auth, (req, res) => { res.send(`<!DOCTYPE html><html><head><title>Payment</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);max-width:500px;text-align:center}h2{color:#1a237e}.bank-details{background:#f9f9f9;padding:20px;border-radius:10px;margin:20px 0;text-align:left}.bank-details p{margin:8px 0}.highlight{background:#fff3cd;color:#856404;padding:15px;border-radius:8px;margin:20px 0}.btn-wa{display:inline-block;padding:14px 30px;background:#25D366;color:white;text-decoration:none;border-radius:10px;font-weight:bold;margin:10px}.btn-back{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold}</style></head><body><div class="card"><h2>💰 Payment</h2><p style="color:#666;">${T.name}</p><div class="bank-details"><h3>🏦 Bank</h3><p><strong>Bank:</strong> ${T.bankName}</p><p><strong>Account:</strong> ${T.bankAccountName}</p><p><strong>Number:</strong> ${T.bankAccountNumber}</p><p><strong>Branch:</strong> ${T.bankBranch}</p></div><div class="highlight"><strong>📱 After Payment:</strong><br>Send receipt with ID (${req.session.studentId})</div><a href="https://wa.me/${T.whatsapp}?text=Payment%20Receipt%20-%20ID:%20${req.session.studentId}%20-%20${encodeURIComponent(req.session.userName)}" target="_blank" class="btn-wa">📱 Send via WhatsApp</a><br><a href="/student/dashboard" class="btn-back">← Back</a></div></body></html>`); });

// ============================================
// STUDENT ANNOUNCEMENTS
// ============================================
app.get('/student/announcements', auth, checkDeviceSession, async (req, res) => {
    let announcements = [];
    if (dbConnected) {
        try {
            const [rows] = await db.query(`SELECT a.*, u.full_name as created_by_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC LIMIT 20`);
            announcements = rows;
        } catch(e) {}
    }
    
    let annHtml = '';
    announcements.forEach(a => {
        annHtml += `
        <div class="announcement-card">
            <div class="ann-header">
                <span class="ann-icon">📢</span>
                <span class="ann-date">${new Date(a.created_at).toLocaleDateString('si-LK', {year:'numeric', month:'long', day:'numeric'})}</span>
            </div>
            <h3>${a.title}</h3>
            <p>${a.content || ''}</p>
            <small>By: 👨‍🏫 ${T.name}</small>
        </div>`;
    });
    
    if (!annHtml) annHtml = '<p style="text-align:center;padding:30px;color:#666;">📢 No announcements yet</p>';
    
    res.send(`<!DOCTYPE html><html><head><title>Announcements</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}
    .header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}
    .header a{color:white;text-decoration:none}.container{max-width:800px;margin:25px auto;padding:0 20px}
    .announcement-card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:15px;border-left:4px solid #1a237e}
    .ann-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .ann-icon{font-size:24px}.ann-date{color:#666;font-size:13px}
    .announcement-card h3{color:#1a237e;margin-bottom:10px}.announcement-card p{color:#555;line-height:1.6}
    .announcement-card small{color:#999}</style></head><body>
    <div class="header"><h1>📢 Announcements</h1><a href="/student/dashboard">← Dashboard</a></div>
    <div class="container">${annHtml}</div></body></html>`);
});

// ============================================
// VIDEO PLAYER WITH TRACKING
// ============================================
app.get('/video/play/:lessonId', auth, checkDeviceSession, async (req, res) => {
    const lessonId = req.params.lessonId; 
    if (!dbConnected) return res.send('<h2>Error</h2>');
    const [lesson] = await db.query(`SELECT l.*, c.id as course_id FROM lessons l JOIN courses c ON l.course_id=c.id WHERE l.id=$1`, { bind: [lessonId] });
    if (lesson.length === 0) return res.send('<h2>Not found</h2>');
    const [enrollment] = await db.query(`SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2 AND status='active' AND payment_status='verified'`, { bind: [req.session.userId, lesson[0].course_id] });
    if (enrollment.length === 0) return res.send(`<h2>🔒 Access Denied</h2><a href="/student/payment">💰 Pay</a>`);
    const videoUrl = lesson[0].video_url; if (!videoUrl) return res.send('<h2>No video</h2>');
    
    res.send(`<!DOCTYPE html><html><head><title>${lesson[0].title}</title><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;font-family:'Segoe UI',Arial,sans-serif;overflow:hidden}.header{background:#1a237e;color:white;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}.header a{color:white;text-decoration:none}.badge{background:#dc3545;color:white;padding:4px 10px;border-radius:15px;font-size:10px}.progress{background:#28a745;color:white;padding:4px 10px;border-radius:15px;font-size:10px;margin:0 5px}.video-container{width:100%;height:calc(100vh - 46px);background:#000}.video-container iframe{width:100%;height:100%;border:none}.watermark{position:fixed;top:50px;right:10px;color:rgba(255,255,255,0.15);font-size:11px;pointer-events:none;z-index:999;transform:rotate(-90deg)}</style></head><body>
    <div class="header">
        <span>📺 ${lesson[0].title}</span>
        <div>
            <span class="progress" id="watchTime">⏱️ 0:00</span>
            <span class="badge">🔒 Protected</span> 
            <a href="/student/courses/${lesson[0].course_id}/lessons">← Back</a>
        </div>
    </div>
    <div class="video-container"><iframe src="${videoUrl}" allow="autoplay; fullscreen" allowfullscreen sandbox="allow-same-origin allow-scripts allow-presentation"></iframe></div>
    <div class="watermark">${req.session.studentId} | ${req.session.userName}</div>
    <script>
        document.addEventListener('contextmenu',e=>e.preventDefault());
        document.addEventListener('keydown',e=>{if(e.ctrlKey&&['s','S','u','U','p','P'].includes(e.key))e.preventDefault();if(e.key==='F12')e.preventDefault()});
        
        let watchSeconds = 0;
        let completed = false;
        
        fetch('/video/progress/${lessonId}')
            .then(r => r.json())
            .then(data => {
                watchSeconds = data.watched_seconds || 0;
                completed = data.completed || false;
                updateTimeDisplay();
            });
        
        function updateTimeDisplay() {
            const mins = Math.floor(watchSeconds / 60);
            const secs = watchSeconds % 60;
            document.getElementById('watchTime').textContent = '⏱️ ' + mins + ':' + secs.toString().padStart(2,'0');
        }
        
        setInterval(() => {
            if (document.hidden) return;
            watchSeconds += 30;
            updateTimeDisplay();
            
            fetch('/video/track', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    lessonId: ${lessonId},
                    watchedSeconds: watchSeconds,
                    completed: completed
                })
            });
        }, 30000);
        
        window.addEventListener('beforeunload', () => {
            if (watchSeconds > 300) {
                completed = true;
                fetch('/video/track', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        lessonId: ${lessonId},
                        watchedSeconds: watchSeconds,
                        completed: true
                    })
                });
            }
        });
        
        setInterval(()=>{
            if(window.outerWidth-window.innerWidth>100||window.outerHeight-window.innerHeight>100)
            document.body.innerHTML='<div style="color:white;text-align:center;padding:50px"><h1>⚠️ DevTools Detected!</h1></div>'
        },1000);
    </script></body></html>`);
});

// Video Tracking API
app.post('/video/track', auth, async (req, res) => {
    const { lessonId, watchedSeconds, completed } = req.body;
    if (!lessonId) return res.json({ error: 'Lesson ID required' });
    
    try {
        if (dbConnected) {
            const [existing] = await db.query(
                `SELECT * FROM video_tracking WHERE user_id=$1 AND lesson_id=$2 ORDER BY id DESC LIMIT 1`,
                { bind: [req.session.userId, lessonId] }
            );
            
            if (existing.length > 0) {
                await db.query(
                    `UPDATE video_tracking SET last_watched_at=NOW(), watched_seconds=$1, completed=$2, device_info=$3 WHERE id=$4`,
                    { bind: [watchedSeconds, completed, req.headers['user-agent']?.substring(0,500), existing[0].id] }
                );
            } else {
                await db.query(
                    `INSERT INTO video_tracking (user_id, lesson_id, watched_seconds, completed, device_info) VALUES ($1,$2,$3,$4,$5)`,
                    { bind: [req.session.userId, lessonId, watchedSeconds, completed, req.headers['user-agent']?.substring(0,500)] }
                );
            }
        }
        res.json({ success: true });
    } catch(e) {
        res.json({ error: e.message });
    }
});

// Get Video Progress
app.get('/video/progress/:lessonId', auth, async (req, res) => {
    try {
        if (dbConnected) {
            const [tracking] = await db.query(
                `SELECT watched_seconds, completed FROM video_tracking WHERE user_id=$1 AND lesson_id=$2 ORDER BY id DESC LIMIT 1`,
                { bind: [req.session.userId, req.params.lessonId] }
            );
            if (tracking.length > 0) {
                return res.json({ watched_seconds: tracking[0].watched_seconds, completed: tracking[0].completed });
            }
        }
        res.json({ watched_seconds: 0, completed: false });
    } catch(e) {
        res.json({ watched_seconds: 0, completed: false });
    }
});

// STUDENT COURSES
app.get('/student/courses', auth, checkDeviceSession, async (req, res) => { 
    let courses=[]; 
    if(dbConnected){try{const [rows]=await db.query(`SELECT * FROM courses WHERE status='published' ORDER BY is_paper,created_at DESC`); courses=rows;}catch(e){}} 
    let cc=''; 
    courses.forEach(c=>{cc+=`<div class="course-card"><h3>📚 ${c.title} ${c.is_paper?'📝':''}</h3><p>${c.description||''}</p>${c.paper_url?`<a href="/uploads/${c.paper_url}" class="btn" style="background:#ff9800;margin-right:5px">📄 Paper</a>`:''}${c.answer_url?`<a href="/uploads/${c.answer_url}" class="btn" style="background:#4caf50">✅ Answer</a>`:''}<a href="/student/courses/${c.id}/lessons" class="btn">📖 Lessons</a></div>`;}); 
    if(!cc) cc='<p style="text-align:center;padding:30px;">No courses.</p>'; 
    res.send(`<!DOCTYPE html><html><head><title>Courses</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none}.container{max-width:900px;margin:25px auto;padding:0 20px}h2{color:#1a237e}.course-card{background:white;padding:20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:15px}.btn{display:inline-block;padding:10px 22px;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:5px;background:#1a237e}</style></head><body><div class="header"><h1>👨‍🎓 ${req.session.userName}</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><h2>📚 Courses</h2>${cc}</div></body></html>`); 
});

app.get('/student/courses/:courseId/lessons', auth, checkDeviceSession, async (req, res) => { 
    const courseId=req.params.courseId; 
    let course={title:'Course'},lessons=[],hasAccess=false; 
    if(dbConnected){try{const [c]=await db.query(`SELECT * FROM courses WHERE id=$1`,{bind:[courseId]});if(c.length>0)course=c[0];const [e]=await db.query(`SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2 AND status='active' AND payment_status='verified'`,{bind:[req.session.userId,courseId]});hasAccess=e.length>0;if(hasAccess){const [l]=await db.query(`SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_number`,{bind:[courseId]});lessons=l;}}catch(e){}} 
    if(!hasAccess) return res.send(`<!DOCTYPE html><html><head><title>Access Denied</title><meta charset="UTF-8"><style>*{margin:0}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#dc3545,#c82333);display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;padding:40px;border-radius:20px;text-align:center}.icon{font-size:70px}h2{color:#dc3545}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}.btn-wa{background:#25D366}</style></head><body><div class="card"><div class="icon">🔒</div><h2>Payment Required!</h2><a href="/student/payment" class="btn btn-wa">💰 Pay Now</a><a href="/student/courses" class="btn">← Back</a></div></body></html>`); 
    let ll=''; 
    lessons.forEach(l=>{
        ll+=`<div class="lesson-card"><h3>📖 ${l.title}</h3><p>📚 ${l.topic_name||'Chemistry'}</p><div class="actions">${l.zoom_link?`<a href="${l.zoom_link}" target="_blank" class="ab live"><span>📡</span>Live</a>`:`<div class="ab inactive"><span>📡</span>N/A</div>`}${l.video_url?`<a href="/video/play/${l.id}" class="ab recording"><span>🎬</span>Recording</a>`:`<div class="ab inactive"><span>🎬</span>N/A</div>`}</div></div>`;
    }); 
    if(!ll) ll='<p style="text-align:center;padding:30px;">No lessons.</p>'; 
    res.send(`<!DOCTYPE html><html><head><title>${course.title}</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#28a745,#218838);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.badge{background:rgba(255,255,255,0.2);padding:5px 15px;border-radius:20px}.back{color:white;text-decoration:none}.container{max-width:800px;margin:25px auto;padding:0 20px}.lesson-card{background:white;padding:25px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08);margin-bottom:20px}.lesson-card h3{color:#1a237e}.actions{display:flex;gap:20px;flex-wrap:wrap}.ab{flex:1;min-width:200px;padding:25px 20px;border-radius:12px;text-align:center;text-decoration:none;color:white;display:flex;flex-direction:column;align-items:center;gap:8px}.live{background:linear-gradient(135deg,#dc3545,#c82333)}.recording{background:linear-gradient(135deg,#1a237e,#283593)}.inactive{opacity:0.5;pointer-events:none}</style></head><body><div class="header"><h1>📚 ${course.title}</h1><div><span class="badge">✅ Paid</span><a href="/student/courses" class="back">← Courses</a></div></div><div class="container"><h2>Lessons</h2><p style="color:#666;">👨‍🏫 ${T.name}</p>${ll}</div></body></html>`); 
});

// ============================================
// ADMIN DASHBOARD
// ============================================
app.get('/admin/dashboard', adminAuth, async (req, res) => {
    let total = 0, pendingDeletes = 0; let av = await teacherImg(55);
    const isMainAdmin = req.session.userRole === 'admin';
    let perms = { can_manage_lessons: true, can_send_reset_codes: true, can_delete_students: true };
    if (!isMainAdmin) { try { perms = await getPerms(req.session.userId); } catch(e) {} }
    if (dbConnected) { try { const [c] = await db.query(`SELECT COUNT(*) as count FROM users WHERE role='student'`); total = c[0]?.count || 0; const [d] = await db.query(`SELECT COUNT(*) as count FROM users WHERE delete_requested=true`); pendingDeletes = d[0]?.count || 0; } catch(e) {} }
    res.send(`<!DOCTYPE html><html><head><title>Admin</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none}.container{max-width:1100px;margin:25px auto;padding:0 20px}.teacher-card{background:white;padding:20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px;display:flex;align-items:center;gap:15px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:25px}.card{background:white;padding:20px;border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,0.08);text-align:center}.card h3{color:#666;font-size:13px}.card .num{font-size:32px;font-weight:bold;color:#1a237e}.menu{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:25px}.menu a{padding:12px 22px;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;background:#1a237e}.green{background:#28a745!important}.warning{background:#ffc107!important;color:#333}.red{background:#dc3545!important}.purple{background:#6f42c1!important}.orange{background:#ff9800!important}.teal{background:#17a2b8!important}.profile-link{font-size:12px;color:#2563eb;text-decoration:none}</style></head><body><div class="header"><h1>👨‍🏫 ${T.name} ${isMainAdmin?'(Main)':'(Sub)'}</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="teacher-card">${av}<div><h2 style="color:#1a237e">${T.name}</h2><p style="color:#666;">Chemistry</p><a href="/admin/profile" class="profile-link">📷 Photo</a></div></div><div class="cards"><div class="card"><h3>📊 Students</h3><div class="num">${total}</div></div><div class="card"><h3>🗑️ Pending</h3><div class="num">${pendingDeletes}</div></div></div><div class="menu">${perms.can_manage_lessons||isMainAdmin?`<a href="/admin/courses" class="green">📚 Courses</a>`:''}<a href="/admin/enrollments">✅ Enrollments</a>${perms.can_send_reset_codes||isMainAdmin?`<a href="/admin/password-requests" class="red">🔑 Reset</a>`:''}<a href="/admin/students">👥 Students</a><a href="/admin/announcements" class="orange">📢 Announcements</a><a href="/admin/video-analytics" class="teal">📊 Videos</a><a href="/admin/inactivity" class="warning">🚨 Inactive</a><a href="/admin/analytics">📊 Analytics</a>${isMainAdmin?`<a href="/admin/sub-admins" class="purple">👥 Sub Admins</a><a href="/admin/delete-requests" class="red">🗑️ Deletes</a>`:''}<a href="/">🏠 Home</a></div></div></body></html>`);
});

// ADMIN PROFILE (Same as before)
app.get('/admin/profile', adminAuth, async (req, res) => { let admin = { full_name: T.name, profile_image: '' }; if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM users WHERE username='Buddika' AND role='admin'`); if (rows.length > 0) admin = rows[0]; } catch(e) {} } const imgD = admin.profile_image ? `<img src="/uploads/${admin.profile_image}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid #1a237e;margin-bottom:15px;">` : '<div style="width:120px;height:120px;border-radius:50%;background:#1a237e;display:flex;align-items:center;justify-content:center;font-size:50px;color:white;margin:0 auto 15px;">👨‍🏫</div>'; res.send(`<!DOCTYPE html><html><head><title>Profile</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none}.container{max-width:600px;margin:30px auto;padding:0 20px}.card{background:white;padding:30px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.08);text-align:center}h2{color:#1a237e}.upload-area{background:#f9f9f9;border:3px dashed #ccc;border-radius:15px;padding:30px;margin:20px 0;cursor:pointer}.upload-area:hover{border-color:#1a237e}input[type="file"]{display:none}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}.back-link{display:inline-block;margin-top:15px;color:#1a237e;text-decoration:none}.success{background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin-bottom:20px;font-weight:bold}</style></head><body><div class="header"><h1>👨‍🏫 Profile</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container">${req.query.uploaded ? '<div class="success">✅ Updated!</div>' : ''}<div class="card"><h2>${T.name}</h2>${imgD}<form action="/admin/profile/upload" method="POST" enctype="multipart/form-data"><div class="upload-area" onclick="document.getElementById('photoFile').click()"><p style="font-size:40px;">📷</p><p>Click to Select</p></div><input type="file" id="photoFile" name="photo" accept="image/*" onchange="previewImage(this)" required><img id="preview" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid #1a237e;margin:15px auto;display:none;"><br><button type="submit">💾 Upload</button></form><a href="/admin/dashboard" class="back-link">← Dashboard</a></div></div><script>function previewImage(input){var p=document.getElementById('preview');if(input.files&&input.files[0]){var r=new FileReader();r.onload=function(e){p.src=e.target.result;p.style.display='block';document.querySelector('.upload-area').style.display='none'};r.readAsDataURL(input.files[0])}}</script></body></html>`); });
app.post('/admin/profile/upload', adminAuth, upload.single('photo'), async (req, res) => { try { if (!req.file) return res.send(`<script>alert('Select photo!');window.location.href='/admin/profile'</script>`); if (dbConnected) { await db.query(`UPDATE users SET profile_image=$1 WHERE username='Buddika' AND role='admin'`, { bind: [req.file.filename] }); } res.redirect('/admin/profile?uploaded=1'); } catch(e) { res.send(`<script>alert('Error');window.location.href='/admin/profile'</script>`); } });

// ADMIN ANNOUNCEMENTS
app.get('/admin/announcements', adminAuth, async (req, res) => {
    let announcements = [];
    if (dbConnected) {
        try {
            const [rows] = await db.query(`SELECT * FROM announcements ORDER BY created_at DESC`);
            announcements = rows;
        } catch(e) {}
    }
    
    let annList = '';
    announcements.forEach(a => {
        annList += `
        <div class="ann-item">
            <div>
                <strong>${a.title}</strong><br>
                <small>${new Date(a.created_at).toLocaleString('si-LK')}</small>
            </div>
            <a href="/admin/announcements/delete/${a.id}" class="btn-mini btn-danger" onclick="return confirm('Delete?')">🗑️</a>
        </div>`;
    });
    
    res.send(`<!DOCTYPE html><html><head><title>Manage Announcements</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json">
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}
    .header{background:linear-gradient(135deg,#ff9800,#f57c00);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}
    .header a{color:white;text-decoration:none}.container{max-width:800px;margin:25px auto;padding:0 20px}
    .card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}
    h2{color:#ff9800;margin-bottom:20px}input,textarea{width:100%;padding:12px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}
    button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:10px}
    .ann-item{display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid #eee}
    .btn-mini{padding:5px 10px;border-radius:5px;text-decoration:none;font-size:11px;font-weight:bold;background:#ff9800;color:white}
    .btn-danger{background:#dc3545}.checkbox-label{display:flex;align-items:center;gap:10px;margin:15px 0}</style></head><body>
    <div class="header"><h1>📢 Announcements</h1><a href="/admin/dashboard">← Dashboard</a></div>
    <div class="container">
        <div class="card">
            <h2>➕ New Announcement</h2>
            <form action="/admin/announcements/create" method="POST">
                <input type="text" name="title" placeholder="Title" required>
                <textarea name="content" placeholder="Content" rows="5" required></textarea>
                <div class="checkbox-label">
                    <input type="checkbox" name="sendEmail" id="sendEmail">
                    <label for="sendEmail">📧 Send email notification to all students</label>
                </div>
                <button type="submit">📢 Post Announcement</button>
            </form>
        </div>
        <div class="card">
            <h2>📋 Recent Announcements</h2>
            ${annList || '<p style="text-align:center;color:#666;">No announcements</p>'}
        </div>
    </div></body></html>`);
});

app.post('/admin/announcements/create', adminAuth, async (req, res) => {
    const { title, content, sendEmail } = req.body;
    if (!title || !content) return res.redirect('/admin/announcements');
    
    try {
        if (dbConnected) {
            await db.query(`INSERT INTO announcements (title, content, created_by) VALUES ($1,$2,$3)`, 
                { bind: [title, content, req.session.userId] });
            
            if (sendEmail === 'on') {
                const [students] = await db.query(`SELECT id, email, full_name, student_id FROM users WHERE role='student' AND is_active=true`);
                
                for (let student of students) {
                    const emailHtml = `
                    <div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:20px;">
                        <div style="background:white;padding:30px;border-radius:10px;border-left:5px solid #ff9800;">
                            <div style="font-size:30px;">📢</div>
                            <h2 style="color:#1a237e;">${title}</h2>
                            <p style="color:#666;font-size:16px;">Hello ${student.full_name},</p>
                            <div style="background:#f9f9f9;padding:20px;border-radius:8px;margin:20px 0;">
                                <p style="color:#333;line-height:1.6;">${content}</p>
                            </div>
                            <p style="color:#666;font-size:14px;">👨‍🏫 ${T.name} | Chemistry LMS</p>
                            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/login" style="display:inline-block;padding:10px 20px;background:#1a237e;color:white;text-decoration:none;border-radius:5px;font-size:14px;">View LMS</a>
                        </div>
                    </div>`;
                    
                    const result = await sendEmail(student.email, `📢 ${title} - Chemistry LMS`, emailHtml);
                    await logNotification(student.id, 'announcement', title, student.email, result.success ? 'sent' : 'failed');
                }
            }
        }
        res.redirect('/admin/announcements?success=1');
    } catch(e) {
        res.send(`<script>alert('Error creating announcement');window.location.href='/admin/announcements'</script>`);
    }
});

app.get('/admin/announcements/delete/:id', adminAuth, async (req, res) => {
    if (dbConnected) {
        await db.query(`DELETE FROM announcements WHERE id=$1`, { bind: [req.params.id] });
    }
    res.redirect('/admin/announcements');
});

// VIDEO ANALYTICS
app.get('/admin/video-analytics', adminAuth, async (req, res) => {
    let videoData = [];
    if (dbConnected) {
        try {
            const [rows] = await db.query(`
                SELECT 
                    l.title as lesson_title,
                    c.title as course_title,
                    u.student_id,
                    u.full_name,
                    vt.watched_seconds,
                    vt.completed,
                    vt.last_watched_at,
                    vt.started_at
                FROM video_tracking vt
                JOIN lessons l ON vt.lesson_id = l.id
                JOIN courses c ON l.course_id = c.id
                JOIN users u ON vt.user_id = u.id
                ORDER BY vt.last_watched_at DESC
                LIMIT 100
            `);
            videoData = rows;
        } catch(e) {}
    }
    
    let tableHtml = '';
    videoData.forEach(v => {
        const watchedMin = Math.floor((v.watched_seconds || 0) / 60);
        tableHtml += `
        <tr>
            <td>${v.student_id}</td>
            <td>${v.full_name}</td>
            <td>${v.course_title}</td>
            <td>${v.lesson_title}</td>
            <td>${watchedMin} min</td>
            <td>${v.completed ? '✅' : '⏳'}</td>
            <td>${new Date(v.last_watched_at).toLocaleDateString('si-LK')}</td>
        </tr>`;
    });
    
    if (!tableHtml) tableHtml = '<tr><td colspan="7" style="text-align:center;padding:30px;">No data</td></tr>';
    
    res.send(`<!DOCTYPE html><html><head><title>Video Analytics</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json">
    <style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}
    .header{background:linear-gradient(135deg,#17a2b8,#138496);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}
    .header a{color:white;text-decoration:none}.container{max-width:1200px;margin:25px auto;padding:0 20px}
    .card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}
    h2{color:#17a2b8}table{width:100%;border-collapse:collapse}
    th{background:#17a2b8;color:white;padding:12px;font-size:13px}
    td{padding:10px;border-bottom:1px solid #eee;font-size:13px}</style></head><body>
    <div class="header"><h1>📊 Video Analytics</h1><a href="/admin/dashboard">← Dashboard</a></div>
    <div class="container"><div class="card"><h2>Watch History</h2>
    <div style="overflow-x:auto"><table><thead><tr><th>Student ID</th><th>Name</th><th>Course</th><th>Lesson</th><th>Watched</th><th>Status</th><th>Last Active</th></tr></thead>
    <tbody>${tableHtml}</tbody></table></div></div></div></body></html>`);
});

// ADMIN PASSWORD REQUESTS (Keep same)
app.get('/admin/password-requests', adminAuth, async (req, res) => {
    if (req.session.userRole === 'sub_admin') { const p = await getPerms(req.session.userId); if (!p.can_send_reset_codes) return res.send(`<h2>⛔ Access Denied</h2>`); }
    let requests=[]; if(dbConnected){try{const [rows]=await db.query(`SELECT student_id,full_name,email,mobile_number,verification_code,reset_token_expires FROM users WHERE role='student' AND verification_code IS NOT NULL AND reset_token_expires > NOW() ORDER BY reset_token_expires DESC`);requests=rows;}catch(e){}} let tr=''; requests.forEach(r=>{tr+=`<tr><td><strong>${r.student_id}</strong></td><td>${r.full_name}</td><td>${r.email}</td><td>${r.mobile_number}</td><td><span style="background:#1a237e;color:white;padding:5px 15px;border-radius:5px;font-size:18px;font-weight:bold;letter-spacing:3px">${r.verification_code}</span></td><td><a href="/admin/send-code-email?email=${encodeURIComponent(r.email)}&name=${encodeURIComponent(r.full_name)}&code=${r.verification_code}" class="btn-mini" style="background:#2563eb;">📧 Send</a></td></tr>`;}); if(!tr) tr='<tr><td colspan="6" style="text-align:center;color:#28a745;padding:30px;">✅ No pending</td></tr>';
    res.send(`<!DOCTYPE html><html><head><title>Reset Requests</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1100px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e}table{width:100%;border-collapse:collapse}th{background:#1a237e;color:white;padding:12px;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:14px}.btn-mini{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:12px;font-weight:bold;display:inline-block;color:white}.count{background:#fff3cd;color:#856404;padding:10px 20px;border-radius:8px;display:inline-block;margin-bottom:15px;font-weight:bold}</style></head><body><div class="header"><h1>🔑 Reset Requests</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>Pending (${requests.length})</h2><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Code</th><th>Action</th></tr></thead><tbody>${tr}</tbody></table></div></div></body></html>`); });
app.get('/admin/send-code-email', adminAuth, async (req, res) => { const { email, name, code } = req.query; if(!email || !code) return res.redirect('/admin/password-requests'); let emailSent = false; try { const result = await sendEmail(email, 'Password Reset Code', `<div style="padding:30px;font-family:Arial;background:#f5f5f5;border-radius:10px;text-align:center"><h2 style="color:#1a237e">Password Reset Code</h2><p>Hello ${name||'Student'}!</p><div style="background:#1a237e;color:white;padding:20px;font-size:36px;font-weight:bold;letter-spacing:10px;margin:20px 0">${code}</div><p>⚠️ Expires in 1 hour.</p></div>`); emailSent = result.success; } catch(e) {} res.send(`<!DOCTYPE html><html><head><title>Email</title><style>*{margin:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;text-align:center}h2{color:${emailSent?'#28a745':'#dc3545'}}.btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}</style></head><body><div class="box"><h2>${emailSent ? '✅ Sent!' : '❌ Failed!'}</h2><p>${emailSent ? 'Code sent to '+email : 'Error sending email.'}</p><a href="/admin/password-requests" class="btn">← Back</a></div></body></html>`); });

// ADMIN SUB-ADMINS
app.get('/admin/sub-admins', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.send(`<h2>⛔ Only Main Admin</h2>`); let subAdmins = []; if (dbConnected) { try { const [rows] = await db.query(`SELECT * FROM users WHERE role='sub_admin' ORDER BY created_at DESC`); subAdmins = rows; } catch(e) {} } let tr = ''; subAdmins.forEach(s => { tr += `<tr><td>${s.full_name}</td><td>${s.email}</td><td>${s.mobile_number}</td><td><span class="badge ${s.is_active?'active':'inactive'}">${s.is_active?'Active':'Inactive'}</span></td><td>📧${s.can_send_reset_codes?'✅':'❌'} 📖${s.can_manage_lessons?'✅':'❌'} 🗑️${s.can_delete_students?'✅':'❌'}</td><td><a href="/admin/sub-admins/toggle/${s.id}" class="btn-mini">🔄</a><a href="/admin/sub-admins/delete/${s.id}" class="btn-mini btn-danger" onclick="return confirm('Delete?')">🗑️</a></td></tr>`; });
    res.send(`<!DOCTYPE html><html><head><title>Sub Admins</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#6f42c1,#553098);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1100px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#6f42c1}input,select{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#6f42c1;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:10px}table{width:100%;border-collapse:collapse}th{background:#6f42c1;color:white;padding:12px;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:13px}.badge{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}.active{background:#d4edda;color:#155724}.inactive{background:#f8d7da;color:#721c24}.btn-mini{padding:5px 12px;border-radius:5px;text-decoration:none;font-size:11px;font-weight:bold;display:inline-block;margin:2px;background:#6f42c1;color:white}.btn-danger{background:#dc3545}</style></head><body><div class="header"><h1>👥 Sub Admins</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>➕ Create Sub Admin</h2><form action="/admin/sub-admins/create" method="POST"><input type="text" name="fullName" placeholder="Full Name" required><input type="email" name="email" placeholder="Email" required><input type="text" name="mobile" placeholder="Mobile" required><input type="password" name="password" placeholder="Password" required><div style="margin:10px 0;display:flex;gap:15px"><label><input type="checkbox" name="canManageLessons"> Manage Lessons</label><label><input type="checkbox" name="canSendCodes"> Send Codes</label><label><input type="checkbox" name="canDeleteStudents"> Delete Students</label></div><button type="submit">➕ Create</button></form></div><div class="card"><h2>All Sub Admins</h2><table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Status</th><th>Permissions</th><th>Action</th></tr></thead><tbody>${tr||'<tr><td colspan="6" style="text-align:center;padding:30px;">No sub admins</td></tr>'}</tbody></table></div></div></body></html>`); });
app.post('/admin/sub-admins/create', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.redirect('/admin/dashboard'); const { fullName, email, mobile, password, canManageLessons, canSendCodes, canDeleteStudents } = req.body; if (!fullName || !email || !mobile || !password) return res.redirect('/admin/sub-admins'); const hash = await bcrypt.hash(password, 12); if (dbConnected) { await db.query(`INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, can_manage_lessons, can_send_reset_codes, can_delete_students, is_active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, { bind: ['SUB-' + Date.now(), email.split('@')[0], email, hash, fullName, mobile, 'sub_admin', !!canManageLessons, !!canSendCodes, !!canDeleteStudents, true, req.session.userId] }); } res.redirect('/admin/sub-admins'); });
app.get('/admin/sub-admins/toggle/:id', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.redirect('/admin/dashboard'); if (dbConnected) { await db.query(`UPDATE users SET is_active = NOT is_active WHERE id=$1 AND role='sub_admin'`, { bind: [req.params.id] }); } res.redirect('/admin/sub-admins'); });
app.get('/admin/sub-admins/delete/:id', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.redirect('/admin/dashboard'); if (dbConnected) { await db.query(`DELETE FROM users WHERE id=$1 AND role='sub_admin'`, { bind: [req.params.id] }); } res.redirect('/admin/sub-admins'); });

// ADMIN DELETE REQUESTS
app.get('/admin/delete-requests', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.send(`<h2>⛔ Only Main Admin</h2>`); let requests = []; if (dbConnected) { try { const [rows] = await db.query(`SELECT u.*, r.full_name as requester FROM users u LEFT JOIN users r ON u.delete_requested_by=r.id WHERE u.delete_requested=true AND u.role='student'`); requests = rows; } catch(e) {} } let tr = ''; requests.forEach(s => { tr += `<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.email}</td><td>${s.requester||'Auto'}</td><td><a href="/admin/delete-requests/approve/${s.id}" class="btn-mini btn-danger">✅ Delete</a><a href="/admin/delete-requests/reject/${s.id}" class="btn-mini">❌ Reject</a></td></tr>`; }); res.send(`<!DOCTYPE html><html><head><title>Delete Requests</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#dc3545,#c82333);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#dc3545}table{width:100%;border-collapse:collapse}th{background:#dc3545;color:white;padding:12px;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:13px}.btn-mini{padding:5px 12px;border-radius:5px;text-decoration:none;font-size:11px;font-weight:bold;display:inline-block;margin:2px;background:#1a237e;color:white}.btn-danger{background:#dc3545}.count{background:#f8d7da;color:#721c24;padding:10px 20px;border-radius:8px;display:inline-block;margin-bottom:15px;font-weight:bold}</style></head><body><div class="header"><h1>🗑️ Delete Requests</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>Pending (${requests.length})</h2><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Requested By</th><th>Action</th></tr></thead><tbody>${tr||'<tr><td colspan="5" style="text-align:center;padding:30px;">✅ No requests</td></tr>'}</tbody></table></div></div></body></html>`); });
app.get('/admin/delete-requests/approve/:id', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.redirect('/admin/dashboard'); if (dbConnected) { await db.query(`DELETE FROM enrollments WHERE user_id=$1`, { bind: [req.params.id] }); await db.query(`DELETE FROM users WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/delete-requests'); });
app.get('/admin/delete-requests/reject/:id', adminAuth, async (req, res) => { if (req.session.userRole !== 'admin') return res.redirect('/admin/dashboard'); if (dbConnected) { await db.query(`UPDATE users SET delete_requested=false,delete_requested_by=NULL WHERE id=$1`, { bind: [req.params.id] }); } res.redirect('/admin/delete-requests'); });
app.get('/admin/request-delete/:studentId', adminAuth, async (req, res) => { if (req.session.userRole !== 'sub_admin') return res.redirect('/admin/dashboard'); if (dbConnected) { await db.query(`UPDATE users SET delete_requested=true,delete_requested_by=$1 WHERE student_id=$2`, { bind: [req.session.userId, req.params.studentId] }); } res.redirect('/admin/students?msg=delete_requested'); });

// ADMIN COURSES
app.get('/admin/courses', adminAuth, async (req, res) => { if (req.session.userRole === 'sub_admin') { const p = await getPerms(req.session.userId); if (!p.can_manage_lessons) return res.send(`<h2>⛔ Access Denied</h2>`); } let courses=[]; if(dbConnected){try{const [rows]=await db.query(`SELECT * FROM courses ORDER BY created_at DESC`);courses=rows;}catch(e){}} let cc=''; courses.forEach(c=>{cc+=`<div class="course-card"><h3>📚 ${c.title} ${c.is_paper?'📝':''}</h3><p>${c.description||''}</p>${c.paper_url?`<a href="/uploads/${c.paper_url}" target="_blank">📄 Paper</a> `:''}${c.answer_url?`<a href="/uploads/${c.answer_url}" target="_blank">✅ Answer</a>`:''}<div><a href="/admin/courses/${c.id}/lessons" class="btn-small">📖 Lessons</a>${c.is_paper?`<a href="/admin/courses/${c.id}/paper-upload" class="btn-small" style="background:#ff9800">📝 Upload</a>`:''}<a href="/admin/courses/delete/${c.id}" class="btn-small btn-danger" onclick="return confirm('Delete?')">🗑️</a></div></div>`;}); if(!cc) cc='<p style="text-align:center;padding:30px;">No courses.</p>'; res.send(`<!DOCTYPE html><html><head><title>Courses</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1000px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e}input,textarea,select{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer}.course-card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:15px}.btn-small{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin:3px;background:#1a237e;color:white}.btn-danger{background:#dc3545}</style></head><body><div class="header"><h1>📚 Courses</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>➕ Create Course</h2><form action="/admin/courses/create" method="POST"><input type="text" name="title" placeholder="Title" required><textarea name="description" placeholder="Description" rows="3"></textarea><input type="number" name="price" placeholder="Price" value="0"><select name="status"><option value="published">Published</option><option value="draft">Draft</option></select><div style="margin:10px 0"><label><input type="checkbox" name="isPaper"> Paper Class</label></div><button type="submit">➕ Create</button></form></div><h2>📖 All Courses</h2>${cc}</div></body></html>`); });
app.post('/admin/courses/create', adminAuth, async (req, res) => { const { title, description, price, status, isPaper } = req.body; if(!title) return res.send(`<script>alert('Title required!');</script>`); if(dbConnected){await db.query(`INSERT INTO courses (title,description,price,status,is_paper) VALUES ($1,$2,$3,$4,$5)`,{bind:[title,description,price,status,!!isPaper]});} res.redirect('/admin/courses'); });
app.get('/admin/courses/delete/:id', adminAuth, async (req, res) => { if(dbConnected){await db.query(`DELETE FROM courses WHERE id=$1`,{bind:[req.params.id]});} res.redirect('/admin/courses'); });

// PAPER UPLOAD
app.get('/admin/courses/:id/paper-upload', adminAuth, async (req, res) => {
    const courseId = req.params.id; if (!courseId) return res.redirect('/admin/courses');
    let course = { title: '', paper_url: '', answer_url: '' };
    if (dbConnected) { try { const [c] = await db.query(`SELECT * FROM courses WHERE id=$1`, { bind: [courseId] }); if (c.length > 0) course = c[0]; } catch(e) {} }
    const uploaded = req.query.uploaded === '1' ? '<div style="background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin-bottom:15px;font-weight:bold">✅ Uploaded!</div>' : '';
    res.send(`<!DOCTYPE html><html><head><title>Upload Papers</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header a{color:white;text-decoration:none}.container{max-width:650px;margin:25px auto;padding:0 20px}.card{background:white;padding:30px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e;margin-bottom:20px}.form-group{margin-bottom:20px}.form-group label{display:block;font-weight:600;color:#333;margin-bottom:8px}.form-group input[type="file"]{display:block;width:100%;padding:12px;border:2px dashed #ccc;border-radius:8px}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:10px}.info{background:#e3f2fd;color:#1565c0;padding:12px;border-radius:8px;margin-bottom:20px}.existing{background:#f9f9f9;padding:10px;border-radius:8px;margin:10px 0}.existing a{color:#2563eb;font-weight:bold}.back-link{display:inline-block;margin-top:15px;color:#1a237e;text-decoration:none}</style></head><body><div class="header"><h1>📝 Upload Papers</h1><a href="/admin/courses" style="color:white">← Courses</a></div><div class="container">${uploaded}<div class="card"><h2>${course.title}</h2><div class="info">📄 Upload PDF files for Question Paper and Answer Sheet.</div><form action="/admin/courses/paper-upload/${courseId}" method="POST" enctype="multipart/form-data"><div class="form-group"><label>📄 Question Paper (PDF):</label><input type="file" name="paper" accept=".pdf">${course.paper_url?`<div class="existing">✅ <a href="/uploads/${course.paper_url}" target="_blank">View</a></div>`:'<div class="existing" style="color:#999">No paper</div>'}</div><div class="form-group"><label>✅ Answer Sheet (PDF):</label><input type="file" name="answer" accept=".pdf">${course.answer_url?`<div class="existing">✅ <a href="/uploads/${course.answer_url}" target="_blank">View</a></div>`:'<div class="existing" style="color:#999">No answer</div>'}</div><button type="submit">💾 Upload</button></form><a href="/admin/courses" class="back-link">← Back</a></div></div></body></html>`);
});
app.post('/admin/courses/paper-upload/:id', adminAuth, upload.fields([{name:'paper',maxCount:1},{name:'answer',maxCount:1}]), async (req, res) => {
    try { const courseId = req.params.id; if (!courseId) return res.redirect('/admin/courses'); const paperFile = req.files?.paper?.[0]; const answerFile = req.files?.answer?.[0]; if (!paperFile && !answerFile) return res.send(`<script>alert('Select a file!');window.location.href='/admin/courses/${courseId}/paper-upload'</script>`); if (dbConnected) { const updates = []; const binds = []; let idx = 1; if (paperFile) { updates.push(`paper_url=$${idx}`); binds.push(paperFile.filename); idx++; } if (answerFile) { updates.push(`answer_url=$${idx}`); binds.push(answerFile.filename); idx++; } binds.push(courseId); await db.query(`UPDATE courses SET ${updates.join(',')} WHERE id=$${idx}`, { bind: binds }); } res.redirect(`/admin/courses/${courseId}/paper-upload?uploaded=1`); } catch(e) { res.send(`<script>alert('Upload error!');window.location.href='/admin/courses'</script>`); } });

// LESSONS
app.get('/admin/courses/:courseId/lessons', adminAuth, async (req, res) => { const courseId=req.params.courseId; let course={title:'Unknown'},lessons=[]; if(dbConnected){try{const [c]=await db.query(`SELECT * FROM courses WHERE id=$1`,{bind:[courseId]});if(c.length>0)course=c[0];const [l]=await db.query(`SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_number`,{bind:[courseId]});lessons=l;}catch(e){}} let ll=''; lessons.forEach(l=>{ll+=`<div class="lesson-card"><div><strong>📖 ${l.title}</strong>${l.zoom_link?'<br><small>📡 Zoom</small>':''}${l.video_url?'<br><small>🎬 Video</small>':''}</div><a href="/admin/lessons/delete/${l.id}?courseId=${courseId}" class="btn-small btn-danger" onclick="return confirm('Delete?')">🗑️</a></div>`;}); if(!ll) ll='<p style="text-align:center;padding:20px;">No lessons.</p>'; res.send(`<!DOCTYPE html><html><head><title>Lessons</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:900px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e}input{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer}.lesson-card{background:white;padding:15px 20px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.05);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}.btn-small{padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:bold;display:inline-block;margin:3px;background:#1a237e;color:white}.btn-danger{background:#dc3545}</style></head><body><div class="header"><h1>📖 Lessons: ${course.title}</h1><a href="/admin/courses" class="back">← Courses</a></div><div class="container"><div class="card"><h2>➕ Add Lesson</h2><form action="/admin/lessons/create" method="POST"><input type="hidden" name="courseId" value="${courseId}"><input type="text" name="title" placeholder="Title" required><input type="text" name="topicName" placeholder="Topic"><input type="text" name="zoomLink" placeholder="Zoom Link"><input type="text" name="videoUrl" placeholder="Video URL"><input type="number" name="orderNumber" placeholder="Order" value="${lessons.length+1}"><button type="submit">➕ Add</button></form></div><h2>📚 Lessons</h2>${ll}</div></body></html>`); });
app.post('/admin/lessons/create', adminAuth, async (req, res) => { try { const { courseId, title, topicName, zoomLink, videoUrl, orderNumber } = req.body; if(!title) return res.send(`<script>alert('Title required!');</script>`); if(dbConnected){await db.query(`INSERT INTO lessons (course_id,title,topic_name,zoom_link,video_url,order_number) VALUES ($1,$2,$3,$4,$5,$6)`,{bind:[courseId,title,topicName,zoomLink,videoUrl,orderNumber||0]});} res.redirect(`/admin/courses/${courseId}/lessons`); } catch(e) { res.send(`<script>alert('Error');</script>`); } });
app.get('/admin/lessons/delete/:id', adminAuth, async (req, res) => { const courseId=req.query.courseId; if(dbConnected){await db.query(`DELETE FROM lessons WHERE id=$1`,{bind:[req.params.id]});} res.redirect(`/admin/courses/${courseId}/lessons`); });

// ENROLLMENTS
app.get('/admin/enrollments', adminAuth, async (req, res) => { 
    let students=[], courses=[], enrollments=[];
    if(dbConnected){try{const [sRows]=await db.query(`SELECT id,student_id,full_name,email,mobile_number FROM users WHERE role='student' ORDER BY full_name`);students=sRows;const [cRows]=await db.query(`SELECT * FROM courses WHERE status='published' ORDER BY title`);courses=cRows;const [eRows]=await db.query(`SELECT user_id,course_id FROM enrollments WHERE status='active'`);enrollments=eRows;}catch(e){}}
    let enrMap={}; enrollments.forEach(e=>{if(!enrMap[e.user_id])enrMap[e.user_id]=[];enrMap[e.user_id].push(e.course_id);});
    let tr=''; students.forEach(s=>{let cboxes=courses.map(c=>{const checked=enrMap[s.id]?.includes(c.id)?'checked':'';return`<label style="display:inline-block;margin:2px;font-size:10px"><input type="checkbox" ${checked} onchange="toggleEnroll(${s.id},${c.id},this.checked)">${c.title.substring(0,18)}</label>`;}).join('');tr+=`<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.email}</td><td>${s.mobile_number}</td><td style="max-width:350px">${cboxes}</td></tr>`;});
    res.send(`<!DOCTYPE html><html><head><title>Enrollments</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1200px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e}table{width:100%;border-collapse:collapse}th{background:#1a237e;color:white;padding:12px;font-size:13px}td{padding:10px;border-bottom:1px solid #eee;font-size:13px}.msg{background:#d4edda;color:#155724;padding:10px;border-radius:8px;margin-bottom:15px;display:none}</style></head><body><div class="header"><h1>✅ Enrollments</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="msg" id="msg">✅ Updated!</div><div class="card"><h2>Click Checkboxes to Toggle</h2><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Courses</th></tr></thead><tbody>${tr}</tbody></table></div></div><script>async function toggleEnroll(userId,courseId,checked){const res=await fetch('/admin/enrollments/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,courseId,active:checked})});const d=await res.json();document.getElementById('msg').style.display='block';document.getElementById('msg').textContent=d.message;setTimeout(()=>document.getElementById('msg').style.display='none',2000)}</script></body></html>`);
});
app.post('/admin/enrollments/toggle', adminAuth, async (req, res) => {
    const { userId, courseId, active } = req.body;
    if (!dbConnected) return res.json({ message: 'DB error' });
    try {
        if (active) { const [e] = await db.query(`SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2`, { bind: [userId, courseId] }); if (e.length === 0) await db.query(`INSERT INTO enrollments (user_id,course_id,status,payment_status) VALUES ($1,$2,'active','verified')`, { bind: [userId, courseId] }); else await db.query(`UPDATE enrollments SET status='active',payment_status='verified' WHERE user_id=$1 AND course_id=$2`, { bind: [userId, courseId] }); res.json({ message: '✅ Enrolled!' }); }
        else { await db.query(`UPDATE enrollments SET status='revoked',revoked_at=NOW() WHERE user_id=$1 AND course_id=$2`, { bind: [userId, courseId] }); res.json({ message: '❌ Revoked!' }); }
    } catch(e) { res.json({ message: 'Error' }); }
});

// INACTIVE
app.get('/admin/inactivity', adminAuth, async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    let inactive = [];
    if (dbConnected) { try { const [rows] = await db.query(`SELECT student_id,full_name,email,mobile_number,last_login_at FROM users WHERE role='student' AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '${days} days') ORDER BY last_login_at ASC NULLS FIRST LIMIT 200`); inactive = rows; } catch(e) {} }
    let tr = ''; inactive.forEach(s => { const d = s.last_login_at ? Math.floor((Date.now()-new Date(s.last_login_at))/86400000) : 'Never'; tr += `<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.email}</td><td>${s.mobile_number}</td><td>${s.last_login_at?new Date(s.last_login_at).toLocaleDateString():'Never'}</td><td><span class="badge">${d} days</span></td></tr>`; });
    if (!tr) tr = '<tr><td colspan="6" style="text-align:center;color:#28a745;padding:30px;">✅ All active!</td></tr>';
    res.send(`<!DOCTYPE html><html><head><title>Inactive</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#dc3545,#c82333);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1100px;margin:25px auto;padding:0 20px}.tabs{display:flex;gap:5px;margin-bottom:20px}.tabs a{padding:10px 20px;background:#ddd;color:#333;text-decoration:none;border-radius:8px;font-weight:bold}.tabs a.active{background:#dc3545;color:white}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#dc3545}table{width:100%;border-collapse:collapse}th{background:#dc3545;color:white;padding:12px;font-size:13px}td{padding:12px;border-bottom:1px solid #eee;font-size:13px}.badge{background:#f8d7da;color:#721c24;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold}</style></head><body><div class="header"><h1>🚨 Inactive Students</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="tabs"><a href="?days=7" class="${days===7?'active':''}">7 Days</a><a href="?days=14" class="${days===14?'active':''}">14 Days</a><a href="?days=30" class="${days===30?'active':''}">30 Days</a></div><div class="card"><h2>${days}+ Days (${inactive.length})</h2><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Last Login</th><th>Status</th></tr></thead><tbody>${tr}</tbody></table></div></div></body></html>`);
});

// ADMIN STUDENTS
app.get('/admin/students', adminAuth, async (req, res) => { let students=[]; if(dbConnected){try{const [rows]=await db.query(`SELECT id,student_id,full_name,email,mobile_number,school_name,district,nic_number,is_active,last_login_at,delete_requested FROM users WHERE role='student' ORDER BY created_at DESC`);students=rows;}catch(e){}} const isMainAdmin=req.session.userRole==='admin'; let tr=''; students.forEach(s=>{const delBtn=isMainAdmin?`<a href="/admin/students/delete/${s.id}" class="btn-mini btn-danger" onclick="return confirm('Delete?')">🗑️</a>`:(s.delete_requested?'<span class="badge inactive">Requested</span>':`<a href="/admin/request-delete/${s.student_id}" class="btn-mini" style="background:#dc3545">📩 Request</a>`);tr+=`<tr><td><strong>${s.student_id}</strong></td><td>${s.full_name}</td><td>${s.email}</td><td>${s.mobile_number}</td><td>${s.school_name||'N/A'}</td><td>${s.district||'N/A'}</td><td>${s.nic_number||'N/A'}</td><td><span class="badge ${s.is_active?'active':'inactive'}">${s.is_active?'Active':'Inactive'}</span></td><td>${s.last_login_at?new Date(s.last_login_at).toLocaleDateString():'Never'}</td><td>${delBtn}</td></tr>`;}); if(!tr) tr='<tr><td colspan="10" style="text-align:center;padding:30px;">No students.</td></tr>'; res.send(`<!DOCTYPE html><html><head><title>Students</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:1200px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08)}h2{color:#1a237e}table{width:100%;border-collapse:collapse}th{background:#1a237e;color:white;padding:10px;font-size:12px}td{padding:10px;border-bottom:1px solid #eee;font-size:12px}.badge{padding:5px 10px;border-radius:15px;font-size:11px;font-weight:bold}.active{background:#d4edda;color:#155724}.inactive{background:#f8d7da;color:#721c24}.btn-mini{padding:5px 10px;border-radius:5px;text-decoration:none;font-size:11px;font-weight:bold;display:inline-block;margin:2px;background:#1a237e;color:white}.btn-danger{background:#dc3545}</style></head><body><div class="header"><h1>👥 Students</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="card"><h2>All (${students.length})</h2><div style="margin-bottom:20px"><input type="text" id="si" placeholder="🔍 Search" onkeyup="searchTable()" style="padding:12px;border:2px solid #e0e0e0;border-radius:8px;width:300px"></div><div style="overflow-x:auto"><table id="st"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>School</th><th>District</th><th>NIC</th><th>Status</th><th>Login</th><th>Action</th></tr></thead><tbody>${tr}</tbody></table></div></div></div><script>function searchTable(){var i=document.getElementById('si'),f=i.value.toUpperCase(),t=document.getElementById('st'),r=t.getElementsByTagName('tr');for(var j=1;j<r.length;j++){var d=r[j].getElementsByTagName('td'),o=false;for(var k=0;k<d.length;k++){if(d[k]&&d[k].textContent.toUpperCase().indexOf(f)>-1){o=true;break}}r[j].style.display=o?'':'none'}}</script></body></html>`); });
app.get('/admin/students/delete/:id', adminAuth, async (req, res) => { if(req.session.userRole!=='admin') return res.redirect('/admin/students'); if(dbConnected){await db.query(`DELETE FROM enrollments WHERE user_id=$1`,{bind:[req.params.id]});await db.query(`DELETE FROM users WHERE id=$1`,{bind:[req.params.id]});} res.redirect('/admin/students'); });

// ANALYTICS
app.get('/admin/analytics', adminAuth, async (req, res) => { let t=0,a=0,i=0; if(dbConnected){try{const [r1]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student'`);t=r1[0]?.c||0;const [r2]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student' AND last_login_at > NOW() - INTERVAL '1 day'`);a=r2[0]?.c||0;const [r3]=await db.query(`SELECT COUNT(*) as c FROM users WHERE role='student' AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '7 days')`);i=r3[0]?.c||0;}catch(e){}} res.send(`<!DOCTYPE html><html><head><title>Analytics</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.back{color:white;text-decoration:none}.container{max-width:900px;margin:25px auto;padding:0 20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}.card{background:white;padding:30px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);text-align:center}.card .icon{font-size:40px;margin-bottom:10px}.card .num{font-size:42px;font-weight:bold;color:#1a237e}.card .label{color:#666;font-size:14px}.green{border-top:4px solid #28a745}.blue{border-top:4px solid #1a237e}.red{border-top:4px solid #dc3545}</style></head><body><div class="header"><h1>📊 Analytics</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="cards"><div class="card blue"><div class="icon">👥</div><div class="num">${t}</div><div class="label">Total</div></div><div class="card green"><div class="icon">✅</div><div class="num">${a}</div><div class="label">Today</div></div><div class="card red"><div class="icon">🚨</div><div class="num">${i}</div><div class="label">Inactive</div></div></div></div></body></html>`); });

// LOGOUT
app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// HEALTH
app.get('/health', (req, res) => { res.status(200).json({ status: 'ok', db: dbConnected?'connected':'disconnected', uptime: process.uptime() }); });

// START
const server = app.listen(PORT, '0.0.0.0', () => { console.log(`⚗️ ${T.name} LMS | Port: ${PORT} | DB: ${dbConnected?'✅':'❌'}`); });
server.keepAliveTimeout = 120000; server.headersTimeout = 120000;
