// DROP-IN REPLACEMENT
// Nodemailer transport + simple sendMail helper
const nodemailer = require('nodemailer');
const { smtp } = require('./config');

const transporter = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.secure,
  auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
});

async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error('Email "to" is required');
  return transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendMail };
