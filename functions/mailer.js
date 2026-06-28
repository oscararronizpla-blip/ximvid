const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `Ximvid <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html
  });
};

module.exports = { sendEmail };
