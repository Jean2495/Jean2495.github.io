/* MongoDB connection bootstrap for Travlr API.
 * Responsibilities:
 *   - Establish resilient Mongoose connection with automatic retry
 *   - Handle graceful shutdowns for nodemon and process terminations
 *   - Toggle autoIndex behavior depending on environment
 */

const mongoose = require('mongoose');
const readline = require('readline');

// -----------------------------------------------------------------------------
// Build connection URI and configuration options
// -----------------------------------------------------------------------------
const host = process.env.DB_HOST || '127.0.0.1';
const dbName = process.env.DB_NAME || 'travlr';
const dbURI = process.env.DB_URI || `mongodb://${host}/${dbName}`;

// Enable autoIndex only in development; disable in production for performance
const isProd = process.env.NODE_ENV === 'production';
const mongooseOpts = {
    serverSelectionTimeoutMS: 10_000, // fail fast on unreachable hosts
    socketTimeoutMS: 45_000, // idle timeout before socket closes
    autoIndex: !isProd, // true in dev, false in production
};

let connecting = null; // shared promise used by the module for reuse

// -----------------------------------------------------------------------------
// Retry strategy
// Implements exponential backoff for connection attempts (1s, 2s, 4s... capped)
// -----------------------------------------------------------------------------
async function connectWithRetry(retry = 0) {
    const delay = Math.min(30_000, 1000 * 2 ** retry);
    try {
        await mongoose.connect(dbURI, mongooseOpts);
        return mongoose.connection;
    } catch (err) {
        console.error(`Mongo connect error (attempt ${retry + 1}):`, err.message);
        await new Promise((r) => setTimeout(r, delay));
        return connectWithRetry(retry + 1);
    }
}

// -----------------------------------------------------------------------------
// Connection event diagnostics
// -----------------------------------------------------------------------------
mongoose.connection.on('connected', () => {
    console.log(`Mongoose connected to ${dbURI}`);
});

mongoose.connection.on('error', (err) => {
    console.log('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// -----------------------------------------------------------------------------
// Windows SIGINT patch
// Ensures CTRL+C triggers the same graceful shutdown behavior on Windows shells
// -----------------------------------------------------------------------------
if (process.platform === 'win32') {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => process.emit('SIGINT'));
}

// -----------------------------------------------------------------------------
// Graceful shutdown handler
// Ensures connections close cleanly across restart/termination scenarios
// -----------------------------------------------------------------------------
async function gracefulShutdown(reason) {
    try {
        await mongoose.connection.close();
        console.log(`Mongoose disconnected through ${reason}`);
    } catch (e) {
        console.error('Error closing mongoose connection:', e);
    }
}

// -----------------------------------------------------------------------------
// Process signals
// Hooks into system-level termination signals to trigger cleanup
// -----------------------------------------------------------------------------
process.once('SIGUSR2', async () => {
    // nodemon restart signal
    await gracefulShutdown('nodemon restart');
    process.kill(process.pid, 'SIGUSR2');
});

process.on('SIGINT', async () => {
    await gracefulShutdown('app termination');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await gracefulShutdown('app shutdown');
    process.exit(0);
});

// -----------------------------------------------------------------------------
// Initial connection bootstrap
// -----------------------------------------------------------------------------
if (!connecting) {
    connecting = connectWithRetry();
}

// Preload all models to ensure schema registration
require('./travlr');

// Export Mongoose instance and readiness promise for external usage
module.exports = {
    mongoose,
    ready: connecting,
};
