const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { sendEmail } = require('./mailer');
const { buildWelcomeEmail, buildCtaEmail } = require('./email-template');

const db = admin.firestore();

const T = {
  es: {
    social_click: { s: 'Alguien visitó tu red social', b: 'Un usuario ha pulsado uno de tus enlaces sociales en Ximvid.' },
    action_click: { s: 'Alguien pulsó tu botón', b: 'Un usuario ha pulsado tu botón de acción en Ximvid.' },
    new_follower: { s: 'Tienes un nuevo seguidor', b: 'Alguien ha empezado a seguirte en Ximvid.' },
    premium_activated: { s: 'Tu Premium está activo', b: 'Tu suscripción Premium se ha activado correctamente.' },
    payment_failed: { s: 'Problema con tu pago', b: 'No hemos podido procesar tu pago de Premium. Revisa tu método de pago.' }
  },
  en: {
    social_click: { s: 'Someone visited your social link', b: 'A user clicked one of your social links on Ximvid.' },
    action_click: { s: 'Someone tapped your button', b: 'A user tapped your action button on Ximvid.' },
    new_follower: { s: 'You have a new follower', b: 'Someone started following you on Ximvid.' },
    premium_activated: { s: 'Your Premium is active', b: 'Your Premium subscription is now active.' },
    payment_failed: { s: 'Payment issue', b: 'We could not process your Premium payment. Please check your payment method.' }
  }
};

function buildHtml(title, body) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a1628;color:#fff;border-radius:14px">
    <h2 style="color:#f0b429;font-weight:500;margin:0 0 16px">Ximvid</h2>
    <h3 style="font-weight:500;margin:0 0 12px">${title}</h3>
    <p style="color:#c9d4e3;line-height:1.6;margin:0 0 20px">${body}</p>
    <a href="${process.env.APP_URL || 'https://app.ximvid.com'}" style="display:inline-block;background:#2258a8;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px">Abrir Ximvid</a>
  </div>`;
}

exports.onNotificationCreated = functions.region('europe-west1').firestore
  .document('notifications/{notifId}')
  .onCreate(async (snap) => {
    try {
      const n = snap.data();
      if (!n || !n.userId || !n.type) return null;

      const userSnap = await db.collection('users').doc(n.userId).get();
      if (!userSnap.exists) return null;
      const user = userSnap.data();

      if (!user.email) return null;

      // Los clics en redes sociales NO envian email inmediato:
      // se acumulan para el resumen semanal del viernes.
      if (n.type === 'social_click') return null;

      const lang = (user.language === 'es') ? 'es' : 'en';
      const pack = T[lang][n.type];
      if (!pack) return null;

      let emailHtml;
      if (n.type === 'action_click') {
        emailHtml = buildCtaEmail({ userName: user.name || user.username, videoDesc: n.videoDesc || '', ctaType: n.ctaType || 'product', lang });
      } else {
        emailHtml = buildWelcomeEmail(user.name || user.username);
      }
      await sendEmail(user.email, pack.s, emailHtml);
      return null;
    } catch (e) {
      console.error('Error enviando email de notificacion:', e);
      return null;
    }
  });
