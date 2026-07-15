require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    try {
        const sequelize = new Sequelize(process.env.DATABASE_URL, {
            dialect: 'postgres',
            logging: false,
            dialectOptions: {
                ssl: { require: true, rejectUnauthorized: false }
            }
        });

        await sequelize.authenticate();
        console.log('✅ Database connected');

        const [existing] = await sequelize.query(
            `SELECT * FROM users WHERE username = 'Buddika'`
        );

        if (existing.length > 0) {
            console.log('⚠️ Admin already exists');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('Buddika@2024', 12);

        await sequelize.query(
            `INSERT INTO users (student_id, username, email, password, full_name, mobile_number, role, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            {
                bind: ['BC-ADMIN-001', 'Buddika', 'buddika@chemistry.lk', hashedPassword, 'Buddika Wijesundara', '94771234567', 'admin', true]
            }
        );

        console.log('✅ Admin Created Successfully!');
        console.log('   Username: Buddika');
        console.log('   Password: Buddika@2024');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAdmin();
