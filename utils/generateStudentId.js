const User = require('../models/User');

/**
 * Generate Unique Student ID
 * Format: BC-1001, BC-1002, BC-1003...
 */
async function generateStudentId() {
    try {
        // Find the last student ID
        const lastStudent = await User.findOne({
            where: {
                role: 'student',
                studentId: {
                    [require('sequelize').Op.ne]: null
                }
            },
            order: [['createdAt', 'DESC']],
            attributes: ['studentId']
        });

        let nextNumber = 1001; // Starting number

        if (lastStudent && lastStudent.studentId) {
            // Extract number from last ID (BC-1001 -> 1001)
            const lastNumber = parseInt(lastStudent.studentId.replace('BC-', ''));
            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }

        // Ensure uniqueness (in case of race conditions)
        let studentId = `BC-${nextNumber}`;
        let exists = await User.findOne({ where: { studentId } });
        
        while (exists) {
            nextNumber++;
            studentId = `BC-${nextNumber}`;
            exists = await User.findOne({ where: { studentId } });
        }

        return studentId;
    } catch (error) {
        console.error('Generate Student ID error:', error);
        // Fallback: timestamp-based ID
        return `BC-${Date.now().toString().slice(-6)}`;
    }
}

module.exports = generateStudentId;
