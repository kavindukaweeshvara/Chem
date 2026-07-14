const Activity = require('../models/Activity');

/**
 * Log Student Activity
 */
async function logActivity(userId, action, details = {}, req = null) {
    try {
        const activityData = {
            userId,
            action,
            details: typeof details === 'object' ? details : { message: details },
            ipAddress: req?.ip || req?.connection?.remoteAddress || 'system',
            userAgent: req?.get('User-Agent') || 'system'
        };

        const activity = await Activity.create(activityData);
        return activity;
    } catch (error) {
        console.error('Activity logger error:', error);
        // Don't throw - logging should not break the main flow
        return null;
    }
}

/**
 * Log Video Watch Activity
 */
async function logVideoWatch(userId, lessonId, watchPercentage, watchDuration, req = null) {
    return await logActivity(userId, 'video_watch', {
        lessonId,
        watchPercentage,
        watchDuration,
        timestamp: new Date().toISOString()
    }, req);
}

/**
 * Get Student Activity Summary
 */
async function getStudentActivitySummary(userId) {
    try {
        const activities = await Activity.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        const summary = {
            totalLogins: activities.filter(a => a.action === 'login').length,
            totalVideoWatches: activities.filter(a => a.action === 'video_watch').length,
            averageWatchPercentage: 0,
            lastActivity: activities[0]?.createdAt || null,
            recentActivities: activities.slice(0, 10)
        };

        // Calculate average watch percentage
        const videoActivities = activities.filter(a => a.action === 'video_watch');
        if (videoActivities.length > 0) {
            const totalPercentage = videoActivities.reduce((sum, a) => sum + (a.watchPercentage || 0), 0);
            summary.averageWatchPercentage = (totalPercentage / videoActivities.length).toFixed(2);
        }

        return summary;
    } catch (error) {
        console.error('Get activity summary error:', error);
        return null;
    }
}

module.exports = {
    logActivity,
    logVideoWatch,
    getStudentActivitySummary
};
