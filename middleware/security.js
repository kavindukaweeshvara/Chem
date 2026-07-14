/**
 * Security Middleware - AI Bot Blocking & Security Headers
 */

// List of known AI scraper bots
const AI_BOTS = [
    'GPTBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Google-Extended',
    'anthropic-ai',
    'CCBot',
    'Diffbot',
    'FacebookBot',
    'Bytespider',
    'PetalBot',
    'Amazonbot',
    'YouBot',
    'PerplexityBot',
    'cohere-ai'
];

// Block AI Bots
const blockAIBots = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    
    const isAIBot = AI_BOTS.some(bot => 
        userAgent.toLowerCase().includes(bot.toLowerCase())
    );
    
    if (isAIBot) {
        console.warn(`🚫 Blocked AI Bot: ${userAgent}`);
        return res.status(403).json({
            error: 'Access Denied',
            message: 'Automated AI scraping is not permitted on this private LMS platform.'
        });
    }
    
    next();
};

// Additional Security Headers
const addSecurityHeaders = (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', 
        'accelerometer=(), camera=(), geolocation=(), microphone=(), payment=()'
    );
    
    // Cache control for sensitive pages
    if (req.path.includes('/admin') || req.path.includes('/student')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
};

// Anti-scraping for course content
const protectCourseContent = (req, res, next) => {
    // Add noindex header for course pages
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    
    // Check for excessive requests (basic rate limiting)
    if (!req.session.requestCount) {
        req.session.requestCount = 1;
        req.session.firstRequest = Date.now();
    } else {
        req.session.requestCount++;
        
        const timeElapsed = (Date.now() - req.session.firstRequest) / 1000;
        const requestsPerSecond = req.session.requestCount / timeElapsed;
        
        if (requestsPerSecond > 5) {
            console.warn(`⚠️ High request rate from user: ${req.user?.id}`);
            return res.status(429).json({
                error: 'Too Many Requests',
                message: 'Please slow down. Unusual activity detected.'
            });
        }
    }
    
    next();
};

module.exports = {
    blockAIBots,
    addSecurityHeaders,
    protectCourseContent
};
