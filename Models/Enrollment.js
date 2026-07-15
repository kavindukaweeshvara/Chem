// ============================================
// ADMIN - ENROLLMENTS PAGE (Payment Management)
// ============================================
app.get('/admin/enrollments', adminAuth, async (req, res) => {
    let enrollments = [];
    let courses = [];
    let students = [];
    
    if (dbConnected) {
        try {
            const [rows] = await db.query(`SELECT e.*, u.student_id, u.full_name, u.mobile_number, c.title as course_title FROM enrollments e JOIN users u ON e.user_id = u.id JOIN courses c ON e.course_id = c.id ORDER BY e.created_at DESC`);
            enrollments = rows;
            const [cRows] = await db.query(`SELECT * FROM courses WHERE status='published' ORDER BY title`);
            courses = cRows;
            const [sRows] = await db.query(`SELECT id, student_id, full_name, mobile_number FROM users WHERE role='student' ORDER BY full_name`);
            students = sRows;
        } catch(e) { console.error(e.message); }
    }
    
    let tableRows = '';
    if (enrollments.length > 0) {
        enrollments.forEach(e => {
            const statusColor = e.status === 'active' ? '#28a745' : e.status === 'revoked' ? '#dc3545' : '#ffc107';
            const payColor = e.payment_status === 'verified' ? '#28a745' : e.payment_status === 'pending_verification' ? '#17a2b8' : '#dc3545';
            tableRows += `<tr>
                <td><strong>${e.student_id}</strong></td>
                <td>${e.full_name}</td>
                <td>${e.mobile_number}</td>
                <td>${e.course_title}</td>
                <td><span style="background:${statusColor};color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${e.status}</span></td>
                <td><span style="background:${payColor};color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${e.payment_status}</span></td>
                <td>${e.payment_proof ? '<a href="'+e.payment_proof+'" target="_blank" style="color:#2563eb;">📎 View</a>' : 'N/A'}</td>
                <td>
                    ${e.payment_status === 'pending_verification' ? `<a href="/admin/enrollments/verify/${e.id}" class="btn-mini btn-approve" onclick="return confirm('Approve payment?')">✅ Approve</a>` : ''}
                    ${e.status === 'active' ? `<a href="/admin/enrollments/revoke/${e.id}" class="btn-mini btn-revoke" onclick="return confirm('Revoke access?')">❌ Revoke</a>` : e.status === 'revoked' ? `<a href="/admin/enrollments/activate/${e.id}" class="btn-mini btn-approve">🔄 Reactivate</a>` : ''}
                    <a href="/admin/enrollments/delete/${e.id}" class="btn-mini btn-delete" onclick="return confirm('Delete?')">🗑️</a>
                </td>
            </tr>`;
        });
    } else {
        tableRows = '<tr><td colspan="8" style="text-align:center;padding:30px;">No enrollments yet.</td></tr>';
    }
    
    let courseOptions = courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    let studentOptions = students.map(s => `<option value="${s.id}">${s.student_id} - ${s.full_name} (${s.mobile_number})</option>`).join('');
    
    res.send(`<!DOCTYPE html><html><head><title>Enrollments - Buddika Wijesundara</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f2f5}.header{background:linear-gradient(135deg,#1a237e,#283593);color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:18px}.back{color:white;text-decoration:none;font-size:14px}.container{max-width:1200px;margin:25px auto;padding:0 20px}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.08);margin-bottom:20px}h2{color:#1a237e;margin-bottom:20px}input,select{width:100%;padding:12px;margin:8px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:14px}button{padding:12px 25px;background:#28a745;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;margin-top:10px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1a237e;color:white;padding:10px;text-align:left;font-size:12px}td{padding:10px;border-bottom:1px solid #eee}tr:hover{background:#f5f5f5}.btn-mini{padding:5px 12px;border-radius:5px;text-decoration:none;font-size:11px;font-weight:bold;display:inline-block;margin:2px;color:white}.btn-approve{background:#28a745}.btn-revoke{background:#dc3545}.btn-delete{background:#6c757d}.info-box{background:#e8f5e9;color:#2e7d32;padding:15px;border-radius:8px;margin-bottom:20px;font-size:13px}</style></head><body><div class="header"><h1>📋 Payment & Enrollment Management</h1><a href="/admin/dashboard" class="back">← Dashboard</a></div><div class="container"><div class="info-box">💡 <strong>Payment Process:</strong> Student pays → Sends receipt via WhatsApp → Admin verifies → Approve → Student gets access</div><div class="card"><h2>➕ Manual Enroll Student</h2><form action="/admin/enrollments/create" method="POST"><select name="studentId" required><option value="">Select Student...</option>${studentOptions}</select><select name="courseId" required><option value="">Select Course...</option>${courseOptions}</select><select name="status"><option value="active">Active (Approve Now)</option><option value="pending">Pending</option></select><button type="submit">➕ Enroll Student</button></form></div><div class="card"><h2>All Enrollments</h2><div style="overflow-x:auto"><table><thead><tr><th>Student ID</th><th>Name</th><th>Mobile</th><th>Course</th><th>Status</th><th>Payment</th><th>Proof</th><th>Action</th></tr></thead><tbody>${tableRows}</tbody></table></div></div></div></body></html>`);
});

// CREATE ENROLLMENT (Manual by Admin)
app.post('/admin/enrollments/create', adminAuth, async (req, res) => {
    try {
        const { studentId, courseId, status } = req.body;
        if (dbConnected) {
            await db.query(`INSERT INTO enrollments (user_id, course_id, status, payment_status, enrolled_at) VALUES ($1,$2,$3,$4,NOW())`, { bind: [studentId, courseId, status || 'active', status === 'active' ? 'verified' : 'unpaid'] });
        }
        res.redirect('/admin/enrollments');
    } catch(e) { res.send(`<script>alert('Error: ${e.message}');window.location.href='/admin/enrollments'</script>`); }
});

// VERIFY PAYMENT
app.get('/admin/enrollments/verify/:id', adminAuth, async (req, res) => {
    if (dbConnected) { await db.query(`UPDATE enrollments SET payment_status='verified', status='active', enrolled_at=NOW() WHERE id=$1`, { bind: [req.params.id] }); }
    res.redirect('/admin/enrollments');
});

// REVOKE ACCESS
app.get('/admin/enrollments/revoke/:id', adminAuth, async (req, res) => {
    if (dbConnected) { await db.query(`UPDATE enrollments SET status='revoked', revoked_at=NOW() WHERE id=$1`, { bind: [req.params.id] }); }
    res.redirect('/admin/enrollments');
});

// REACTIVATE
app.get('/admin/enrollments/activate/:id', adminAuth, async (req, res) => {
    if (dbConnected) { await db.query(`UPDATE enrollments SET status='active' WHERE id=$1`, { bind: [req.params.id] }); }
    res.redirect('/admin/enrollments');
});

// DELETE ENROLLMENT
app.get('/admin/enrollments/delete/:id', adminAuth, async (req, res) => {
    if (dbConnected) { await db.query(`DELETE FROM enrollments WHERE id=$1`, { bind: [req.params.id] }); }
    res.redirect('/admin/enrollments');
});
