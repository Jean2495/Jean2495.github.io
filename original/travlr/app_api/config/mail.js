const nodemailer = require('nodemailer');

let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
} else {
  transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true, // prints the message to console
  });
}

module.exports = transporter;
