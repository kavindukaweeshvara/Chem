// SIMPLE WORKING SERVER - NO CRASH
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static('public'));

// Home
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Buddhika LMS</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea, #764ba2);
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
                h1 { color: #1a237e; font-size: 28px; margin-bottom: 10px; }
                .status { 
                    background: #d4edda; 
                    color: #155724; 
                    padding: 10px; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                }
                .btn {
                    display: block;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 10px;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 16px;
                    transition: 0.3s;
                }
                .btn-primary { background: #1a237e; color: white; }
                .btn-success { background: #28a745; color: white; }
                .btn-info { background: #17a2b8; color: white; }
                .btn:hover { transform: translateY(-2px); opacity: 0.9; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>📚 Buddhika Wijayasundara</h1>
                <p style="color:#666; margin-bottom:10px;">Advanced Level Chemistry LMS</p>
                
                <div class="status">
                    ✅ Server Running Successfully
                </div>
                
                <p style="margin:15px 0; color:#666;">
                    🟢 System Online | Port: ${PORT}
                </p>
                
                <a href="/login" class="btn btn-primary">🔐 Login</a>
                <a href="/register" class="btn btn-success">📝 Student Registration</a>
                <a href="/admin" class="btn btn-info">👨‍🏫 Admin Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// Login
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login - Buddhika LMS</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .login-box {
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    width: 100%;
                    max-width: 400px;
                }
                h2 { text-align: center; color: #1a237e; margin-bottom: 30px; }
                input {
                    width: 100%;
                    padding: 14px;
                    margin: 10px 0;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 16px;
                }
                input:focus { border-color: #1a237e; outline: none; }
                button {
                    width: 100%;
                    padding: 14px;
                    background: #1a237e;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 10px;
                }
                button:hover { background: #0d1457; }
                .link { text-align: center; margin-top: 20px; }
                .link a { color: #1a237e; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <h2>🔐 Login</h2>
                <form>
                    <input type="text" placeholder="Username or Email" required>
                    <input type="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                <div class="link">
                    <a href="/register">Create New Account</a>
                </div>
                <div class="link">
                    <a href="/">← Back to Home</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Register
app.get('/register', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Register - Buddhika LMS</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .register-box {
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    width: 100%;
                    max-width: 450px;
                }
                h2 { text-align: center; color: #1a237e; margin-bottom: 30px; }
                input {
                    width: 100%;
                    padding: 14px;
                    margin: 8px 0;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 16px;
                }
                input:focus { border-color: #1a237e; outline: none; }
                .warning {
                    background: #fff3cd;
                    color: #856404;
                    padding: 10px;
                    border-radius: 5px;
                    font-size: 13px;
                    margin: 10px 0;
                    text-align: center;
                }
                button {
                    width: 100%;
                    padding: 14px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 10px;
                }
                button:hover { background: #218838; }
                .link { text-align: center; margin-top: 20px; }
                .link a { color: #1a237e; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="register-box">
                <h2>📝 Student Registration</h2>
                <form>
                    <input type="text" placeholder="Full Name" required>
                    <input type="email" placeholder="Email" required>
                    <input type="tel" placeholder="Mobile Number (e.g., 0771234567)" pattern="[0-9]{10,12}" required>
                    <div class="warning">
                        ⚠️ One mobile number = One Student ID only
                    </div>
                    <input type="password" placeholder="Password (min 6 characters)" minlength="6" required>
                    <button type="submit">Register</button>
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

// Admin
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin - Buddhika LMS</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family: Arial, sans-serif; background: #f0f2f5; }
                .header {
                    background: linear-gradient(135deg, #1a237e, #283593);
                    color: white;
                    padding: 25px;
                    text-align: center;
                }
                .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                .cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .card {
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                }
                .card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
                .card .number { font-size: 36px; font-weight: bold; color: #1a237e; }
                .menu { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 30px; }
                .menu a {
                    padding: 12px 25px;
                    background: #1a237e;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
                }
                .menu a:hover { background: #0d1457; }
                table {
                    width: 100%;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                }
                th { background: #1a237e; color: white; padding: 15px; text-align: left; }
                td { padding: 15px; border-bottom: 1px solid #eee; }
                .badge {
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .active { background: #d4edda; color: #155724; }
                .inactive { background: #f8d7da; color: #721c24; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>👨‍🏫 Admin Dashboard</h1>
                <p>Buddhika Wijayasundara - Chemistry LMS</p>
            </div>
            
            <div class="container">
                <div class="cards">
                    <div class="card">
                        <h3>📊 Total Students</h3>
                        <div class="number">0</div>
                        <small>System Initializing...</small>
                    </div>
                    <div class="card">
                        <h3>✅ Active Students</h3>
                        <div class="number">0</div>
                        <small>System Initializing...</small>
                    </div>
                    <div class="card">
                        <h3>⏳ Pending Payments</h3>
                        <div class="number">0</div>
                        <small>System Initializing...</small>
                    </div>
                    <div class="card">
                        <h3>🚨 Inactive (7+ days)</h3>
                        <div class="number">0</div>
                        <small>System Initializing...</small>
                    </div>
                </div>
                
                <div class="menu">
                    <a href="/admin/students">👥 Students</a>
                    <a href="/admin/enrollments">📋 Enrollments</a>
                    <a href="/admin/inactivity">🚨 Inactivity Alerts</a>
                    <a href="/">🏠 Home</a>
                </div>
                
                <h3 style="margin-bottom:15px;">📋 Recent Activity</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Action</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="5" style="text-align:center; padding:30px; color:#666;">
                                ⚠️ Database Connection Required<br>
                                <small>Add PostgreSQL database in Railway to enable full features</small>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start
app.listen(PORT, () => {
    console.log('=================================');
    console.log(`✅ LMS Server Running`);
    console.log(`📚 URL: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log('=================================');
});
