/**
 * Passport Local Authentication Strategy
 * --------------------------------------
 * This configuration enables local (email/password) authentication
 * using Passport.js for the Travlr API.
 *
 * Responsibilities:
 * - Defines a LocalStrategy that verifies credentials against MongoDB.
 * - Returns a valid user document on success for JWT generation.
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');

// Import the registered User model
const Users = require('../models/user');
const User = mongoose.model('users');

// -----------------------------------------------------------------------------
// Configure the LocalStrategy
// -----------------------------------------------------------------------------
passport.use(
    new LocalStrategy(
        {
            usernameField: 'email',
        },
        async (username, password, done) => {
            try {
                // Query MongoDB for a user document with the given email
                const q = await User.findOne({ email: username }).exec();

                // If no user is found, authentication fails
                if (!q) {
                    return done(null, false, { message: 'Incorrect username.' });
                }

                // Validate the provided password using model helper (hashed comparison)
                if (!q.validPassword(password)) {
                    return done(null, false, { message: 'Incorrect Password.' });
                }

                // Successful authentication returns the user document
                return done(null, q);
            } catch (err) {
                // Handle unexpected errors during DB lookup
                return done(err);
            }
        }
    )
);
