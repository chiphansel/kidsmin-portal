const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE, // true if 465
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

async function sendMail({ to, subject, text, html }) {
  const info = await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
  return info;
}

async function sendTwofaCode(toEmail, toName, code, ttlMin = 5) {
  const subject = 'Your KidsMin 2FA code';
  const text = [
    `Hi ${toName || ''}`.trim() + ',',
    '',
    `Your verification code is: ${code}`,
    '',
    `It expires in ${ttlMin} minute(s).`,
    '',
    'If you did not request this code, you can ignore this email.',
  ].join('\n');

  const html = `
    <p>Hi ${toName || ''},</p>
    <p>Your verification code is:
      <strong style="font-size:18px;letter-spacing:2px">${code}</strong>
    </p>
    <p>It expires in <strong>${ttlMin}</strong> minute(s).</p>
    <p>If you did not request this code, you can ignore this email.</p>
  `;

  return sendMail({ to: toEmail, subject, text, html });
}

module.exports = { sendMail, sendTwofaCode };
