const nodemailer = require('nodemailer');

const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE,
  SMTP_USER, SMTP_PASS, MAIL_FROM
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: String(SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
});

async function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to, subject, text, html
  });
}
module.exports = { sendMail };
