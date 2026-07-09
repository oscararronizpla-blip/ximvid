const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

const admin = require('firebase-admin');

const sendEmail = async (to, subject, html, type) => {
  let ok = true, err = null;
  try {
    await transporter.sendMail({
      from: `Ximvid <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html
    });
  } catch (e) {
    ok = false; err = (e.message || String(e)).slice(0, 300);
    throw e;
  } finally {
    // Registro en email_log — nunca debe bloquear el envio
    try {
      await admin.firestore().collection('email_log').add({
        to: to || '',
        subject: subject || '',
        type: type || 'other',
        html: (html || '').slice(0, 200000),
        ok,
        error: err,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logErr) {
      console.error('email_log:', logErr);
    }
  }
};

module.exports = { sendEmail };
