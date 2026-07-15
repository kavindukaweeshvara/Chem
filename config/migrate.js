require('dotenv').config();
const { Sequelize } = require('sequelize');

async function runMigrations() {
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

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                mobile_number VARCHAR(20) UNIQUE NOT NULL,
                nic_number VARCHAR(30),
                school_name VARCHAR(255),
                role VARCHAR(20) DEFAULT 'student',
                is_active BOOLEAN DEFAULT true,
                last_login_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('✅ Users table created');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

runMigrations();
