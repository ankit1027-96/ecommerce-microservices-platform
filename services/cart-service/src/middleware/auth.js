const { http } = require('winston')
const logger = require('../config/logger')
const {v4: uuidv4} = require('uuid')

// Extract User info from API gateway headers
// Also handle session for guest user

const extractUserOrSession = (req, res, next) => {
    try {
        // Check if user is Authenticated (from API gateway)
        const userId = req.headers('x-user-id')
        const userEmail = req.headers('x-user-email')
        const userRole = req.header('x-user-role')

        if(userId) {
req.user = {
    userId,
    email: userEmail,
    role: userRole || 'user'
}
req.isAuthenticated = true;
logger.debug('Authenticated user:', {userId, email: user.email, })
        } else {
            // Guest user - check for session ID in cookie or create one
            let sessionId = req.cookies?.sessionId || req.headers['x-session-id']

            if(!sessionId) {
                sessionId = uuidv4()
                // Set cookie for browser clients
                res.cookie('sessionId', sessionId, {
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    sameSite: 'lax'
                })
                logger.debug('Created new session:', {sessionId})
            }

            req.sessionId = sessionId
            req.isAuthenticated = false;
            req.user = null
        }

        next()
    } catch (error) {
        logger.error('Auth middleware error:', error)
        return res.status(500).json({
            success: false,
            message: 'Authencation processing failed'
        })
    }
}

// Require authentication
const requireAuth = (req, res, next) => {
    if(!req.isAuthenticated || !req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authenticaton required',
            error: 'AUTHENTICATON_REQUIRED'
        })
    }
    next()
}

module.exports = {extractUserOrSession, requireAuth}