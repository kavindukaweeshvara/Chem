require('dotenv').config();
const User = require('../models/User');
const { sequelize } = require('../config/database');

async function createAdminUser() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        const adminData = {
            studentId: 'BC-ADMIN-001',
            username: process.env.ADMIN_USERNAME || 'buddika_w',
            email: 'kaweeshvarak@gmail.com',
            password: process.env.ADMIN_PASSWORD || 'Buddika@2024',
            fullName: process.env.ADMIN_DISPLAY_NAME || 'Buddika Wijesundara',
            mobileNumber: process.env.WHATSAPP_NUMBER || '94740231163',
            role: 'admin',
            isActive: true
        };

        // Check if admin exists
        const existingAdmin = await User.findOne({ 
            where: { username: adminData.username } 
        });

        if (existingAdmin) {
            console.log('⚠️ Admin user already exists');
            console.log(`   Username: ${adminData.username}`);
            process.exit(0);
        }

        // Create admin
        const admin = await User.create(adminData);
        console.log('✅ Admin user created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Username: ${adminData.username}`);
        console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Buddhika@2024'}`);
        console.log(`   Role: ${admin.role}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️ Please change the password after first login!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
}

createAdminUser();
