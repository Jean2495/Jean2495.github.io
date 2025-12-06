/*  Central API router.
 * Responsibilities:
 *  - Expose health, authentication, and trip endpoints
 *  - Apply authentication/authorization middleware for protected routes
 *  - Keep route wiring thin; delegate logic to controllers
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Controllers encapsulate domain logic; routes only dispatch to them.
const authController = require('../controllers/authentication');
const tripsController = require('../controllers/trips');

// ---------------------------------------------------------------------------
// Health check
// GET /api/health -> { ok: true }
// Lightweight liveness probe used by smoke tests and uptime monitors.
// ---------------------------------------------------------------------------
router.get('/health', (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Authentication endpoints
// - /register issues a JWT on successful account creation
// - /login issues a JWT on valid credentials
// - /auth/forgot initiates password reset flow (email token)
// - /auth/reset completes password reset with a valid token
// Controllers are responsible for validation and response shaping.
// ---------------------------------------------------------------------------
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/auth/forgot', authController.forgot);
router.post('/auth/reset', authController.reset);

// ---------------------------------------------------------------------------
// Auth/Role middleware
// - authenticateJWT: extracts and verifies a Bearer token, attaches payload to req.auth
// - requireAdmin: enforces role-based access control for write operations
// These middlewares are composed on protected routes only.
// ---------------------------------------------------------------------------
function authenticateJWT(req, res, next) {
    // Accept standard Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    // Token verification; on success, persist claims on req.auth for downstream handlers
    const token = authHeader.split(' ')[1];
    try {
        req.auth = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ message: 'Token validation error' });
    }
}

function requireAdmin(req, res, next) {
    // Requires prior authenticateJWT; rejects if absent or non-admin
    if (!req.auth) return res.status(401).json({ message: 'Unauthorized' });
    if (req.auth.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    return next();
}

// ---------------------------------------------------------------------------
// Trips endpoints
// - Public reads (list/findByCode/search)
// - Admin-only writes (create/update) with body validation
// Route layer remains declarative; controllers handle I/O and persistence.
// ---------------------------------------------------------------------------
router.get('/trips', tripsController.tripsList);
router.get('/trips/search', tripsController.tripsSearchPaginated);
router.get('/trips/:tripCode', tripsController.tripsFindByCode);

// Request-body validation middleware for trip mutations
const { requireTripBody } = require('../middleware/validate');

// Create a new trip (admin only)
router.post('/trips', authenticateJWT, requireAdmin, requireTripBody, tripsController.tripsAddTrip);

// Update an existing trip by business key (admin only)
router.put(
    '/trips/:tripCode',
    authenticateJWT,
    requireAdmin,
    requireTripBody,
    tripsController.tripsUpdateTrip
);

module.exports = router;
