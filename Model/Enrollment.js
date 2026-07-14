const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Enrollment = sequelize.define('Enrollment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'courses',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'active', 'revoked', 'expired'),
        defaultValue: 'pending'
    },
    paymentStatus: {
        type: DataTypes.ENUM('unpaid', 'pending_verification', 'verified', 'refunded'),
        defaultValue: 'unpaid'
    },
    paymentProof: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'WhatsApp screenshot or receipt'
    },
    enrolledAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'End of month expiry'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    revokedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'enrollments',
    timestamps: true
});

module.exports = Enrollment;
