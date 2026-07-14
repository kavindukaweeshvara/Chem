const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Activity = sequelize.define('Activity', {
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
    lessonId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'login, video_watch, lesson_complete, etc.'
    },
    details: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    watchPercentage: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'Video watch percentage'
    },
    watchDuration: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Watch duration in seconds'
    }
}, {
    tableName: 'activities',
    timestamps: true,
    indexes: [
        {
            fields: ['userId', 'createdAt']
        },
        {
            fields: ['action']
        }
    ]
});

module.exports = Activity;
