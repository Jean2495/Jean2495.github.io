const passport = require("passport");
const mongoose = require("mongoose");
const crypto = require("crypto");
const transporter = require("../config/mail");
const User = require("../models/user");

const register = async (req, res) => {
  if (!req.body.name || !req.body.email || !req.body.password) {
    return res.status(400).json({ message: "All fields required" });
  }

  const user = new User({
    name: req.body.name,
    email: req.body.email,
    password: "",
  });
  user.setPassword(req.body.password);

  try {
    const q = await user.save();
    if (!q) return res.status(400).json({ message: "User not saved" });
    const token = user.generateJWT();
    return res.status(200).json(token);
  } catch (e) {
    return res
      .status(400)
      .json({ message: "Registration error", error: String(e) });
  }
};

const login = (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({ message: "All fields required" });
  }
  passport.authenticate("local", (err, user, info) => {
    if (err) return res.status(404).json(err);
    if (user) {
      const token = user.generateJWT();
      return res.status(200).json(token);
    } else {
      return res.status(401).json(info);
    }
  })(req, res);
};

//POST /auth/forgot
const forgot = async (req, res) => {
  const { email } = req.body || {};
  console.log("[FORGOT] request body email =", email);

  if (!email) return res.status(400).json({ message: "Email required" });

  const genericOk = {
    message:
      "If that email exists, we'll send instructions to reset your password.",
  };

  try {
    const user = await User.findOne({ email }).exec();
    if (!user) {
      console.log("[FORGOT] no user for email (expected in prod):", email);
      return res.status(200).json(genericOk);
    }

    const plainToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${plainToken}`;
    console.log("[FORGOT] reset URL =", resetUrl);

    const html = `
      <p>You requested a password reset for your Travlr account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
    `;

    await transporter.sendMail({
      to: email,
      from: process.env.FROM_EMAIL,
      subject: "Reset your Travlr password",
      html,
    });

    const resp = { ...genericOk };
    if (process.env.NODE_ENV !== "production") resp.devResetUrl = resetUrl;
    return res.status(200).json(resp);
  } catch (e) {
    console.log("[FORGOT] error:", e);
    try {
      const u = await User.findOne({ email }).exec();
      if (u) {
        u.resetPasswordToken = undefined;
        u.resetPasswordExpires = undefined;
        await u.save({ validateBeforeSave: false });
      }
    } catch {}
    return res.status(200).json(genericOk);
  }
};

/** POST /auth/reset/:token */
/** POST /auth/reset  (preferred)
 *    also supports /auth/reset/:token (fallback)
 */
const reset = async (req, res) => {
  const rawToken = (req.body && req.body.token) || req.params.token || "";
  console.log("[RESET] raw token =", rawToken, "len=", rawToken.length);

  const { password } = req.body || {};
  if (!password)
    return res.status(400).json({ message: "New password required" });
  if (!rawToken || rawToken.length < 64) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: tokenHash,
    resetPasswordExpires: { $gt: Date.now() },
  }).exec();

  if (!user)
    return res.status(400).json({ message: "Invalid or expired reset token" });

  user.setPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return res
    .status(200)
    .json({ message: "Password updated. You can now log in." });
};

module.exports = { register, login, forgot, reset };
