/**
 * Mail Transport Configuration (Nodemailer)
 * -----------------------------------------
 * Centralizes email transport setup for password-reset and notification features.
 * Uses environment variables for security and portability.
 */

// Ensure .env is loaded even when this module is required directly
require('dotenv').config();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

if (process.env.NODE_ENV !== 'production') {
    transporter.verify((error, success) => {
        if (error) {
            console.error('[MAIL] Transport verification failed:', error.message);
        } else {
            console.log('[MAIL] Transport ready to send messages:', success);
        }
    });
}

module.exports = transporter;
