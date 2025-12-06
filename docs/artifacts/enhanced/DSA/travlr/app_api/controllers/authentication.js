/**
 *Authentication + Account Recovery Controller
 * --------------------------------------------
 * Handles user registration, login, and password reset flows.
 * Uses Passport (local strategy) for authentication and issues JWTs for API access.
 */

const passport = require('passport');
const mongoose = require('mongoose'); // kept for parity with other controllers
const crypto = require('crypto');
const transporter = require('../config/mail');
const User = require('../models/user');

/**
 * POST /register
 * Creates a new user account and returns a signed JWT as a raw string.
 * Expects: { name, email, password }
 * 400 when required fields are missing or persistence fails.
 */
const register = async (req, res) => {
    if (!req.body.name || !req.body.email || !req.body.password) {
        return res.status(400).json({ message: 'All fields required' });
    }

    // Instantiate with explicit properties; password hash set via model helper.
    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: '',
    });
    user.setPassword(req.body.password);

    try {
        const q = await user.save();
        if (!q) return res.status(400).json({ message: 'User not saved' });

        // JWT is generated from the persisted user document.
        const token = user.generateJWT();
        return res.status(200).json(token);
    } catch (e) {
        return res.status(400).json({ message: 'Registration error', error: String(e) });
    }
};

/**
 * POST /login
 * Authenticates credentials using Passport local strategy.
 * On success returns a signed JWT as a raw string.
 * Expects: { email, password }
 * 401 when credentials are invalid.
 */
const login = (req, res) => {
    if (!req.body.email || !req.body.password) {
        return res.status(400).json({ message: 'All fields required' });
    }

    // Passport handles user lookup + password verification.
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(404).json(err);
        if (user) {
            const token = user.generateJWT();
            return res.status(200).json(token);
        } else {
            return res.status(401).json(info);
        }
    })(req, res);
};

/**
 * POST /auth/forgot
 * Initiates password reset flow by generating a short-lived token
 * and emailing a one-time reset link. Response is generic by design.
 * Expects: { email }
 * Always returns 200 with a neutral message to avoid user enumeration.
 */
const forgot = async (req, res) => {
    const { email } = req.body || {};
    console.log('[FORGOT] request body email =', email);

    if (!email) return res.status(400).json({ message: 'Email required' });

    // Generic OK response; avoids leaking existence of an account.
    const genericOk = {
        message: "If that email exists, we'll send instructions to reset your password.",
    };

    try {
        const user = await User.findOne({ email }).exec();
        if (!user) {
            console.log('[FORGOT] no user for email (expected in prod):', email);
            return res.status(200).json(genericOk);
        }

        // Model helper sets a hashed token + expiry on the user document.
        const plainToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        // Reset URL points at the client; token presented as a query param.
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${plainToken}`;
        console.log('[FORGOT] reset URL =', resetUrl);

        // Minimal HTML content; mail transport configured in ../config/mail.
        const html = `
      <p>You requested a password reset for your Travlr account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
    `;

        await transporter.sendMail({
            to: email,
            from: process.env.FROM_EMAIL,
            subject: 'Reset your Travlr password',
            html,
        });

        // In non-production, include the reset URL to simplify local testing.
        const resp = { ...genericOk };
        if (process.env.NODE_ENV !== 'production') resp.devResetUrl = resetUrl;
        return res.status(200).json(resp);
    } catch (e) {
        console.log('[FORGOT] error:', e);

        // Roll back token fields on failure to keep account state consistent.
        try {
            const u = await User.findOne({ email }).exec();
            if (u) {
                u.resetPasswordToken = undefined;
                u.resetPasswordExpires = undefined;
                await u.save({ validateBeforeSave: false });
            }
        } catch {}

        // Neutral response to the client.
        return res.status(200).json(genericOk);
    }
};

/**
 * POST /auth/reset
 * POST /auth/reset/:token (fallback)
 * Completes the password reset using a previously issued token.
 * Expects: { token?, password } or :token path param.
 * 400 when token is invalid/expired or password is missing.
 */
const reset = async (req, res) => {
    // Accept body token (preferred) or path param for compatibility.
    const rawToken = (req.body && req.body.token) || req.params.token || '';
    console.log('[RESET] raw token =', rawToken, 'len=', rawToken.length);

    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: 'New password required' });

    // Quick token sanity check before hashing and querying.
    if (!rawToken || rawToken.length < 64) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash the presented token to match the stored digest.
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token must exist and not be expired.
    const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: Date.now() },
    }).exec();

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    // Persist the new password and clear token fields.
    user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password updated. You can now log in.' });
};

module.exports = { register, login, forgot, reset };
