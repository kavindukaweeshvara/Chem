const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    studentId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
        comment: 'Format: BC-1001, BC-1002...'
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mobileNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            is: /^[0-9]{10,12}$/
        }
    },
    nicNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'National Identity Card Number'
    },
    schoolName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    role: {
        type: DataTypes.ENUM('admin', 'student'),
        defaultValue: 'student'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastActivityAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    profileImage: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Instance Methods
User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

User.prototype.toPublicProfile = function() {
    return {
        id: this.id,
        studentId: this.studentId,
        fullName: this.fullName,
        email: this.email,
        mobileNumber: this.mobileNumber,
        schoolName: this.schoolName,
        role: this.role,
        lastLoginAt: this.lastLoginAt
    };
};

module.exports = User;
