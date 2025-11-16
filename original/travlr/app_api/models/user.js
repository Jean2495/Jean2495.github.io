// app_api/models/user.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); 

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, 
  hash: String,
  salt: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

// Password setup
userSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
};

// Validate password
userSchema.methods.validPassword = function (password) {
  const hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
  return this.hash === hash;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordToken = tokenHash;
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return token;
};


userSchema.methods.generateJWT = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, name: this.name, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};


module.exports = mongoose.model('users', userSchema);
