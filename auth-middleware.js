// auth-middleware.js - Server-side authentication middleware
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create a Supabase admin client (uses service_role key if available)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// JWT secret - in production, use a strong secret from .env
const JWT_SECRET = process.env.JWT_SECRET || 'your-strong-secret-key-change-this';

// List of admin emails (hardcoded for now - you can store these in a database)
const ADMIN_EMAILS = [
    'raniatayfoor006@gmail.com',
    'panayiotis.siakka@gmail.com'
];

/**
 * Middleware to verify JWT token from Authorization header
 */
async function verifyJWT(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'No token provided',
                message: 'Please log in to access this resource'
            });
        }

        const token = authHeader.split(' ')[1];
        
        // Verify the token using Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'Your session has expired. Please log in again.'
            });
        }

        // Attach user to request
        req.user = user;
        req.userEmail = user.email;
        
        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        return res.status(401).json({ 
            error: 'Authentication failed',
            message: 'Please log in again'
        });
    }
}

/**
 * Middleware to check if user is an admin
 * Uses Supabase to check admin status
 */
async function isAdmin(req, res, next) {
    try {
        // First verify JWT
        await verifyJWT(req, res, async (err) => {
            if (err) return res.status(401).json({ error: 'Authentication required' });
            
            // Check if user email is in admin list
            const userEmail = req.userEmail;
            
            if (!userEmail) {
                return res.status(403).json({ 
                    error: 'Access denied',
                    message: 'Admin access required'
                });
            }
            
            // Check if user is in admin list
            const isAdmin = ADMIN_EMAILS.includes(userEmail);
            
            if (!isAdmin) {
                return res.status(403).json({ 
                    error: 'Access denied',
                    message: 'You do not have admin privileges'
                });
            }
            
            // Check if user exists in the database
            const { data: userRecord, error: userError } = await supabase
                .from('users')
                .select('id, name, email, is_admin')
                .eq('email', userEmail)
                .single();
            
            if (userError && userError.code !== 'PGRST116') {
                console.error('Error checking user:', userError);
                // Allow the request but log the error
            }
            
            // If user record exists and has is_admin = true, they're an admin
            if (userRecord && userRecord.is_admin === true) {
                req.user = userRecord;
                req.userEmail = userEmail;
                return next();
            }
            
            // Also check the hardcoded admin list
            if (ADMIN_EMAILS.includes(userEmail)) {
                req.user = userRecord || { email: userEmail };
                req.userEmail = userEmail;
                return next();
            }
            
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You do not have admin privileges'
            });
        });
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to verify admin status'
        });
    }
}

/**
 * Simple session-based auth (for cookie-based sessions)
 * Use this if you want to use express-session
 */
async function isAuthenticated(req, res, next) {
    // Check if user is logged in via session
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    
    // Check for token in authorization header
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (!error && user) {
                req.user = user;
                req.userEmail = user.email;
                return next();
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
    
    return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Please log in to access this resource'
    });
}

/**
 * Combined middleware: check auth + admin status
 * Use this for admin-only routes
 */
async function requireAdmin(req, res, next) {
    try {
        // Check for session first
        if (req.session && req.session.user) {
            const userEmail = req.session.user.email;
            if (ADMIN_EMAILS.includes(userEmail)) {
                req.user = req.session.user;
                return next();
            }
        }
        
        // Then check for token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (!error && user && ADMIN_EMAILS.includes(user.email)) {
                req.user = user;
                req.userEmail = user.email;
                return next();
            }
        }
        
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Admin login required'
        });
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Authentication failed'
        });
    }
}
// auth-middleware.js - Server-side authentication middleware
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create a Supabase admin client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-strong-secret-key-change-this';

// ==========================================
// ADMIN CREDENTIALS - HARDCODED FOR NOW
// ==========================================
const ADMIN_CREDENTIALS = {
    username: 'ormidiadatabaseaccess',
    password: 'accessdb1234Ormidia!'
};

// List of admin emails (Supabase users)
const ADMIN_EMAILS = [
    'raniatayfoor006@gmail.com',
    'panayiotis.siakka@gmail.com'
];

/**
 * Verify admin credentials (username/password)
 */
function verifyAdminCredentials(username, password) {
    return username === ADMIN_CREDENTIALS.username && 
           password === ADMIN_CREDENTIALS.password;
}

/**
 * Generate a JWT token for admin session
 */
function generateAdminToken(username) {
    return jwt.sign(
        { 
            username: username, 
            role: 'admin',
            type: 'admin_credentials'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Verify admin JWT token
 */
function verifyAdminToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded && decoded.role === 'admin';
    } catch (error) {
        return false;
    }
}

/**
 * Middleware to check if user is admin (token or credentials)
 */
async function requireAdmin(req, res, next) {
    try {
        // Check for admin token in Authorization header
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            
            // Check if it's an admin token
            if (verifyAdminToken(token)) {
                req.user = { username: 'admin', role: 'admin' };
                return next();
            }
            
            // Check if it's a Supabase token
            try {
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (!error && user && ADMIN_EMAILS.includes(user.email)) {
                    req.user = user;
                    req.userEmail = user.email;
                    return next();
                }
            } catch (e) {
                // Supabase token verification failed
            }
        }
        
        // Check for session (cookie-based)
        if (req.session && req.session.admin) {
            req.user = { username: 'admin', role: 'admin' };
            return next();
        }
        
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Admin login required'
        });
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'Authentication failed'
        });
    }
}

// Export middleware functions
module.exports = {
    verifyJWT,
    isAdmin,
    isAuthenticated,
    requireAdmin,
    ADMIN_EMAILS,
    ADMIN_CREDENTIALS,
    verifyAdminCredentials,
    generateAdminToken,
    verifyAdminToken,
    supabase
};
// Export middleware functions
module.exports = {
    verifyJWT,
    isAdmin,
    isAuthenticated,
    requireAdmin,
    ADMIN_EMAILS,
    supabase
};