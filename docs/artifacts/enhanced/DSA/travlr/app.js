// app.js (root)

// -----------------------------------------------------------------------------
// Core dependencies and environment bootstrap
// -----------------------------------------------------------------------------
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const passport = require('passport');
require('dotenv').config(); // Loads variables from .env into process.env at startup

// Minimal runtime config presence check (non-fatal).
['JWT_SECRET', 'MONGODB_URI'].forEach((k) => {
    if (!process.env[k]) console.warn(`[config] Warning: ${k} is not set`);
});

// -----------------------------------------------------------------------------
// Infrastructure initialization (order-sensitive)
// -----------------------------------------------------------------------------
require('./app_api/models/db'); // Establishes Mongoose connection and sets event handlers
require('./app_api/config/passport'); // Registers Passport LocalStrategy for authentication

const app = express();

// -----------------------------------------------------------------------------
// Process-wide middleware
// -----------------------------------------------------------------------------

// HTTP request logging; 'dev' format is concise and readable for local usage
app.use(logger('dev'));

// Parses JSON request bodies and URL-encoded forms into req.body
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Parses Cookie header and populates req.cookies; neutral with JWT-in-header flow
app.use(cookieParser());

// Serves static assets from /public (e.g., images, styles, client bundles)
app.use(express.static(path.join(__dirname, 'public')));

// Initializes Passport; enables req.user population when strategies authenticate
app.use(passport.initialize());

// Cross-Origin Resource Sharing for the Angular dev client
// - Scope is limited to /api
// - Preflight (OPTIONS) requests return 200 to unblock browser requests
app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:4200');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// -----------------------------------------------------------------------------
// Route mounting
// -----------------------------------------------------------------------------

// Primary API router containing auth, trip endpoints, and health checks
const apiRouter = require('./app_api/routes/index');
app.use('/api', apiRouter);

// Fallback for unmatched /api/* routes with a JSON 404 payload
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'API route not found', path: req.originalUrl });
});

// -----------------------------------------------------------------------------
// Error handling
// -----------------------------------------------------------------------------

// Maps UnauthorizedError (e.g., from JWT verification) to a 401 JSON response
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: `${err.name}: ${err.message}` });
    }
    return next(err);
});

// 404 handler for non-API routes (minimal text response)
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Final error handler; returns JSON and avoids leaking stack traces in production
app.use((err, req, res, _next) => {
    const status = err.status || 500;
    const payload = {
        message: err.message || 'Internal Server Error',
        ...(req.app.get('env') === 'development' && { stack: err.stack }),
    };
    res.status(status).json(payload);
});

// -----------------------------------------------------------------------------
// Server startup
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.set('port', PORT);
app.listen(PORT, () => {
    console.log(`Travlr API listening on http://localhost:${PORT}`);
});

module.exports = app;
