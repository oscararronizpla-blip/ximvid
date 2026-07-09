const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { sendEmail } = require('./mailer');
const { buildWeeklyEmail } = require('./email-template');

const db = admin.firestore();

// Nombres bonitos de redes
const NET_NAMES = {
  instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube', facebook:'Facebook',
  twitter:'X', linkedin:'LinkedIn', pinterest:'Pinterest', snapchat:'Snapchat',
  twitch:'Twitch', whatsapp:'WhatsApp', telegram:'Telegram', spotify:'Spotify',
  web:'Web', shop:'Tienda', threads:'Threads'
};

// Genera barras HTML para el grafico (estetica dorada)
function buildChart(counts) {
  const entries = Object.entries(counts).filter(([k,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  if (!entries.length) return '';
  const max = Math.max(...entries.map(e => e[1]));
  const rows = entries.map(([net, val]) => {
    const pct = Math.round((val / max) * 100);
    const name = NET_NAMES[net] || net;
    return `
      <tr><td style="padding:5px 0">
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#c9d4e3;margin:0 0 4px">${name} <span style="color:#f0b429;font-weight:bold">${val}</span></div>
        <div style="background:rgba(255,255,255,.08);border-radius:8px;height:14px;width:100%">
          <div style="background:linear-gradient(115deg,#7a5200,#c8860a,#f0b429,#c8860a,#7a5200);height:14px;border-radius:8px;width:${pct}%"></div>
        </div>
      </td></tr>`;
  }).join('');
  return `<tr><td style="padding:6px 0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

// Resumen semanal: cada viernes 11h Madrid
// (cron en UTC: en invierno Madrid=UTC+1 -> 10:00 UTC; en verano UTC+2 -> 09:00 UTC)
// Usamos timeZone para que Firebase calcule la hora local correctamente.
exports.weeklySocialSummary = functions.pubsub
  .schedule('0 11 * * 5')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    try {
      const usersSnap = await db.collection('users').get();
      for (const uDoc of usersSnap.docs) {
        const user = uDoc.data();
        if (!user.email || user.notifEmail === false) continue;

        // Leer contadores semanales de los videos del usuario
        const vidsSnap = await db.collection('videos').where('userId','==',uDoc.id).get();
        const counts = {};
        let total = 0;
        for (const vDoc of vidsSnap.docs) {
          const v = vDoc.data();
          for (const [key, val] of Object.entries(v)) {
            if (key.startsWith('week_net_') && typeof val === 'number' && val > 0) {
              const net = key.replace('week_net_','');
              counts[net] = (counts[net] || 0) + val;
              total += val;
            }
          }
        }

        if (total === 0) continue; // sin actividad esta semana, no enviar

        const lang = (user.language === 'es') ? 'es' : 'en';
        const title = (lang === 'es') ? 'Tu resumen semanal' : 'Your weekly summary';
        const intro = (lang === 'es')
          ? `Esta semana tus redes sociales recibieron <strong style="color:#f0b429">${total}</strong> clics en Ximvid. Aquí tienes el desglose:`
          : `This week your social links received <strong style="color:#f0b429">${total}</strong> clicks on Ximvid. Here's the breakdown:`;

        const chart = buildChart(counts);
        const html = buildWeeklyEmail({
          userName: user.name || user.username,
          total,
          counts,
          lang
        });
        await sendEmail(user.email, title, html, 'weekly_summary');

        // Resetear contadores semanales de sus videos
        const batch = db.batch();
        for (const vDoc of vidsSnap.docs) {
          const updates = {};
          for (const key of Object.keys(vDoc.data())) {
            if (key.startsWith('week_net_')) updates[key] = 0;
          }
          if (Object.keys(updates).length) batch.update(vDoc.ref, updates);
        }
        await batch.commit();
      }
      console.log('Resumen semanal enviado');
      return null;
    } catch (e) {
      console.error('Error en resumen semanal:', e);
      return null;
    }
  });
