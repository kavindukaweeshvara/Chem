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
    fs.writeFileSync(swPath, `const CACHE_NAME='chemistry-lms-v1';const ASSETS=['/','/login','/register','/manifest.json','/offline.html'];self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)))});self.addEventListener('fetch',(e)=>{e.respondWith(caches.match(e.request).then(response=>{return response||fetch(e.request).then(fetchResponse=>{return caches.open(CACHE_NAME).then(cache=>{cache.put(e.request,fetchResponse.clone());return fetchResponse})})}).catch(()=>{if(e.request.mode==='navigate'){return caches.match('/offline.html')}}))});self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then(keys=>{return Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))}))});`);
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
            dbConnected = true; console.log('✅ DB Connected');
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
            } catch (e) { console.error('Table creation error:', e.message); }
        }).catch((err) => { console.log('DB Error:', err.message); dbConnected = false; });
    }
} catch (e) { console.log('DB Setup Error:', e.message); }

// Middleware
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' })); 
app.use(express.static('public')); 
app.use('/uploads', express.static(uploadDir));
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

// Shared Helpers
const BSI = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">';

async function teacherImg(size = 55) { 
    if (!dbConnected) return `<div style="width:${size}px;height:${size}px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size/2.5}px;color:white;">👨‍🏫</div>`; 
    try { 
        const [a] = await db.query(`SELECT profile_image FROM users WHERE username='Buddika' AND role='admin'`); 
        if (a.length > 0 && a[0].profile_image) return `<img src="/uploads/${a[0].profile_image}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`; 
    } catch(e) {} 
    return `<div style="width:${size}px;height:${size}px;background:#1a237e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size/2.5}px;color:white;">👨‍🏫</div>`; 
}

async function getPerms(uid) { 
    if (!dbConnected) return {}; 
    try { 
        const [r] = await db.query(`SELECT can_delete_students, can_manage_lessons, can_send_reset_codes FROM users WHERE id=$1`, { bind: [uid] }); 
        return r[0] || {}; 
    } catch(e) { return {}; } 
}

// ============================================
// EMAIL FUNCTIONS (FIXED)
// ============================================
async function sendEmail(to, subject, htmlContent) {
    console.log('📧 SENDING EMAIL...');
    console.log('To:', to);
    console.log('Subject:', subject);
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('❌ SMTP not configured');
        return { success: false, error: 'SMTP not configured' };
    }
    
    try {
        // Method 1: Try with service: 'gmail'
        console.log('🔍 Method 1: Using Gmail service...');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: to,
            subject: subject,
            html: htmlContent
        });
        
        console.log('✅ Email sent! ID:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error1) {
        console.log('❌ Method 1 failed:', error1.message);
        
        try {
            // Method 2: Try with host/port
            console.log('🔍 Method 2: Using SMTP host/port...');
            const transporter2 = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            
            const info2 = await transporter2.sendMail({
                from: process.env.SMTP_USER,
                to: to,
                subject: subject,
                html: htmlContent
            });
            
            console.log('✅ Email sent! ID:', info2.messageId);
            return { success: true, messageId: info2.messageId };
            
        } catch (error2) {
            console.log('❌ Method 2 failed:', error2.message);
            return { success: false, error: error2.message };
        }
    }
}

async function logNotification(userId, type, subject, sentTo, status) {
    if (!dbConnected) return;
    try {
        await db.query(`INSERT INTO notification_logs (user_id, type, subject, sent_to, status) VALUES ($1,$2,$3,$4,$5)`, 
            { bind: [userId, type, subject, sentTo, status] });
    } catch(e) {
        console.log('Notification log error:', e.message);
    }
}

async function sendRegistrationEmail(userEmail, fullName, studentId) {
    console.log('📧 Sending welcome email to:', userEmail);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1a237e, #283593); color: white; padding: 30px; text-align: center;">
                <div style="font-size: 50px;">⚗️</div>
                <h1 style="margin: 10px 0 0 0; font-size: 24px;">Welcome to Chemistry LMS!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Advanced Level Chemistry</p>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #1a237e; margin: 0 0 20px 0;">Hello ${fullName}! 🎉</h2>
                <p style="color: #666; line-height: 1.6;">Your registration is complete. Here are your login details:</p>
                
                <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your Student ID:</p>
                    <p style="font-size: 36px; font-weight: bold; color: #1a237e; margin: 0; letter-spacing: 3px;">${studentId}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.BASE_URL || 'http://localhost:3000'}/login" 
                       style="background: #1a237e; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                        🔐 Login Now
                    </a>
                </div>
                
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <p style="margin: 5px 0; color: #1565c0; font-size: 14px;">
                        <strong>👨‍🏫 Teacher:</strong> ${T.name}<br>
                        <strong>📞 Phone:</strong> ${T.phone}<br>
                        <strong>📧 Email:</strong> ${T.email}
                    </p>
                </div>
            </div>
            <div style="background: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px; margin: 0;">© 2026 ${T.name} | Chemistry LMS</p>
            </div>
        </div>
    </body>
    </html>`;
    
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
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
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
app.get('/register', (req, res) => { 
    res.send(`<!DOCTYPE html><html><head><title>Register</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json">${BSI}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:35px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:100%;max-width:450px}h2{text-align:center;color:#1a237e;font-size:22px}.sub{text-align:center;color:#666;margin-bottom:20px}.input-group{position:relative;margin:8px 0}.input-group input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}.input-group input[type="password"]{padding-right:45px}.toggle-password{position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;padding:8px;z-index:10;color:#666;font-size:18px}.toggle-password:hover{color:#1a237e}.warn{background:#fff3cd;color:#856404;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}.info{background:#e3f2fd;color:#1565c0;padding:10px;border-radius:5px;font-size:13px;margin:10px 0;text-align:center}button{width:100%;padding:14px;background:#28a745;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:10px}.link{text-align:center;margin-top:15px}.link a{color:#1a237e;text-decoration:none;font-size:14px}</style></head><body><div class="box"><h2>📝 Student Registration</h2><p class="sub">👨‍🏫 ${T.name}</p><form action="/register" method="POST"><div class="input-group"><input type="text" name="fullName" placeholder="Full Name" required></div><div class="input-group"><input type="email" name="email" placeholder="Email" required></div><div class="input-group"><input type="tel" name="mobile" placeholder="Mobile" pattern="[0-9]{10,12}" required></div><div class="warn">⚠️ One Mobile = One ID</div><div class="info">🆔 Auto ID: BC-1001</div><div class="input-group"><input type="password" name="password" id="rp" placeholder="Password (min 6)" minlength="6" required><span class="toggle-password" onclick="togglePass('rp',this)"><i class="bi bi-eye"></i></span></div><button type="submit">📝 Register</button></form><div class="link"><a href="/login">Login</a> | <a href="/">Home</a></div></div><script>function togglePass(id,el){var i=document.getElementById(id);var icon=el.querySelector('i');if(i.type==='password'){i.type='text';icon.className='bi bi-eye-slash';el.style.color='#dc3545'}else{i.type='password';icon.className='bi bi-eye';el.style.color='#666'}}</script></body></html>`); 
});

app.post('/register', async (req, res) => { 
    console.log('📝 Registration request received');
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
        
        console.log('✅ User created:', sid);
        
        // Send welcome email
        sendRegistrationEmail(email, fullName, sid).then(result => {
            console.log('Welcome email result:', result);
            if (newUser.length > 0 && dbConnected) {
                logNotification(newUser[0].id, 'registration', 'Welcome Email', email, result.success ? 'sent' : 'failed');
            }
        }).catch(err => console.log('Email error:', err));
        
        res.send(`<!DOCTYPE html><html><head><title>Success!</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#1a237e,#4a148c);display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;padding:40px;border-radius:20px;text-align:center;max-width:450px}.icon{font-size:70px}h1{color:#28a745;margin:15px 0}.id-box{font-size:36px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:15px;border-radius:10px;margin:20px 0}.btn{display:inline-block;padding:14px 30px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}.info-box{background:#fff3cd;color:#856404;padding:12px;border-radius:8px;margin:15px 0;font-size:13px}</style></head><body><div class="card"><div class="icon">🎉</div><h1>Registration Successful!</h1><div class="id-box">🆔 ${sid}</div><p>✅ ${fullName}<br>✅ ${email}<br>✅ ${mobile}</p><div class="info-box">📧 Welcome email will be sent shortly.<br>Check spam folder if not received.</div><a href="/login" class="btn">🔐 Login Now</a></div></body></html>`); 
    } catch (e) { 
        console.error('Registration error:', e);
        res.send(`<script>alert('Registration failed!');window.location.href='/register'</script>`); 
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
        .toggle-password{position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;padding:8px;z-index:10;color:#666;font-size:18px}.toggle-password:hover{color:#1a237e}
        button{width:100%;padding:15px;background:#1a237e;color:white;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:20px}
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
// STUDENT DASHBOARD
// ============================================
app.get('/student/dashboard', auth, checkDeviceSession, async (req, res) => { 
    if(req.session.userRole!=='student') return res.redirect('/admin/dashboard'); 
    let tImg = await teacherImg(50);
    let annCount = 0;
    if (dbConnected) { try { const [count] = await db.query(`SELECT COUNT(*) as c FROM announcements`); annCount = count[0]?.c || 0; } catch(e) {} }
    
    res.send(`<!DOCTYPE html><html><head><title>Dashboard</title><meta charset="UTF-8"><link rel="manifest" href="/manifest.json"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.logout{background:#dc3545;color:white;padding:8px 18px;border-radius:5px;text-decoration:none}.container{max-width:700px;margin:30px auto;padding:20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}.teacher-card{background:white;padding:15px 20px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px;display:flex;align-items:center;gap:12px}.id-badge{font-size:28px;font-weight:bold;color:#1a237e;background:#f0f0f0;padding:12px 25px;border-radius:10px;display:inline-block;margin:15px 0}.btn-courses{display:inline-block;padding:12px 25px;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:5px;background:#1a237e}.btn-pay{background:#25D366}.btn-profile{background:#ffc107;color:#333}.btn-ann{background:#ff9800}.ann-badge{background:#ff9800;color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:5px}</style></head><body><div class="header"><h1>👨‍🎓 Dashboard</h1><a href="/logout" class="logout">🚪 Logout</a></div><div class="container"><div class="teacher-card">${tImg}<div><strong style="color:#1a237e;font-size:15px;">${T.name}</strong><br><small style="color:#666;">Chemistry</small></div></div><div class="card"><h2 style="color:#1a237e">Welcome, ${req.session.userName}!</h2><div class="id-badge">🆔 ${req.session.studentId}</div><p><strong>📱</strong> ${req.session.userMobile||'N/A'}</p><div style="margin-top:20px"><a href="/student/courses" class="btn-courses">📚 Courses</a><a href="/student/payment" class="btn-courses btn-pay">💰 Payment</a><a href="/student/profile" class="btn-courses btn-profile">👤 Profile</a><a href="/student/announcements" class="btn-courses btn-ann">📢 Announcements ${annCount > 0 ? `<span class="ann-badge">${annCount}</span>` : ''}</a></div></div></div></body></html>`); 
});

// Other student routes (profile, payment, courses, lessons, announcements, video) remain same as previous full code
// ... (Include all remaining routes from previous full code)

// ============================================
// ADMIN DASHBOARD & ALL ADMIN ROUTES
// ============================================
// ... (Include all admin routes from previous full code)

// ============================================
// LOGOUT & HEALTH
// ============================================
app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });
app.get('/health', (req, res) => { res.status(200).json({ status: 'ok', db: dbConnected?'connected':'disconnected', smtp: process.env.SMTP_USER ? 'configured' : 'not configured', uptime: process.uptime() }); });

// ============================================
// TEST EMAIL ROUTE
// ============================================
app.get('/admin/test-email', adminAuth, async (req, res) => {
    const testEmail = req.query.email || T.email;
    console.log('🧪 Testing email to:', testEmail);
    
    const result = await sendEmail(
        testEmail,
        '🧪 Chemistry LMS - Email Test',
        `<div style="padding:30px;font-family:Arial;text-align:center;background:#f5f5f5;">
            <div style="background:white;padding:30px;border-radius:10px;max-width:500px;margin:0 auto;">
                <h2 style="color:#28a745;">✅ Email Working!</h2>
                <p>SMTP configuration is correct.</p>
                <p>👨‍🏫 ${T.name} | Chemistry LMS</p>
                <p style="color:#666;">Time: ${new Date().toLocaleString('si-LK')}</p>
            </div>
        </div>`
    );
    
    res.send(`<!DOCTYPE html><html><head><title>Email Test</title>
    <style>*{margin:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh}
    .box{background:white;padding:35px;border-radius:15px;text-align:center;max-width:500px;box-shadow:0 10px 30px rgba(0,0,0,0.1)}
    h2{color:${result.success?'#28a745':'#dc3545'};margin-bottom:20px}
    .details{background:#f9f9f9;padding:15px;border-radius:8px;margin:15px 0;text-align:left;font-size:13px}
    .btn{display:inline-block;padding:12px 25px;background:#1a237e;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin:10px}
    .success{color:#28a745}.error{color:#dc3545}</style></head><body>
    <div class="box">
        <h2>${result.success ? '✅ Email Working!' : '❌ Email Failed!'}</h2>
        <div class="details">
            <p><strong>To:</strong> ${testEmail}</p>
            <p><strong>Status:</strong> <span class="${result.success?'success':'error'}">${result.success ? 'Sent Successfully' : 'Failed'}</span></p>
            ${result.error ? `<p><strong>Error:</strong> <span class="error">${result.error}</span></p>` : ''}
            ${result.messageId ? `<p><strong>Message ID:</strong> ${result.messageId}</p>` : ''}
            <p><strong>SMTP User:</strong> ${process.env.SMTP_USER || 'Not configured'}</p>
            <p><strong>SMTP Pass:</strong> ${process.env.SMTP_PASS ? '***Configured***' : 'Not configured'}</p>
        </div>
        <a href="/admin/dashboard" class="btn">← Dashboard</a>
    </div></body></html>`);
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => { 
    console.log('═'.repeat(50));
    console.log(`⚗️ ${T.name} LMS Started`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`💾 Database: ${dbConnected ? '✅ Connected' : '❌ Not Connected'}`);
    console.log(`📧 SMTP: ${process.env.SMTP_USER ? '✅ Configured (' + process.env.SMTP_USER + ')' : '❌ Not Configured'}`);
    console.log(`🔗 URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
    console.log('═'.repeat(50));
    
    // Test SMTP after 3 seconds
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        setTimeout(async () => {
            console.log('📧 Testing SMTP connection...');
            const testResult = await sendEmail(
                process.env.SMTP_USER,
                '🧪 SMTP Startup Test',
                '<h2>✅ SMTP Working!</h2>'
            );
            console.log(testResult.success ? '✅ SMTP test passed!' : '❌ SMTP test failed:', testResult.error);
        }, 3000);
    }
});

server.keepAliveTimeout = 120000; 
server.headersTimeout = 120000;
