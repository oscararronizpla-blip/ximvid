/**
 * XIMVID — functions/manychat-triggers.js
 * ─────────────────────────────────────────────────────────────────
 * Cloud Functions que llaman a la API de ManyChat para enviar
 * notificaciones por WhatsApp a los usuarios que lo tienen activado.
 * Importado en functions/index.js
 * ─────────────────────────────────────────────────────────────────
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

const db = admin.firestore();

const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY;
const FLOW_IDS = {
  welcome:     process.env.MANYCHAT_FLOW_WELCOME,
  socialClick: process.env.MANYCHAT_FLOW_SOCIAL_CLICK,
  actionClick: process.env.MANYCHAT_FLOW_ACTION_CLICK,
  newFollower: process.env.MANYCHAT_FLOW_NEW_FOLLOWER,
  weeklyStats: process.env.MANYCHAT_FLOW_WEEKLY_STATS,
};

// ─── Helper: enviar mensaje vía ManyChat API ──────────────────────
async function sendWhatsApp(phoneNumber, flowId, customFields = {}) {
  if (!MANYCHAT_API_KEY || !flowId) {
    console.warn('ManyChat: API key o Flow ID no configurado — saltando');
    return;
  }
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const res = await fetch('https://api.manychat.com/fb/sending/sendFlow', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriber_id: null,
      phone:         cleanPhone,
      flow_ns:       flowId,
      custom_fields: customFields,
    }),
  });
  const data = await res.json();
  if (data.status !== 'success') {
    console.warn(`ManyChat sendFlow falló para ${cleanPhone}:`, JSON.stringify(data));
  }
}

// ─── Helper: verificar si el usuario tiene WhatsApp activado ──────
async function getUserWhatsApp(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  const user = userDoc.data();
  if (!user.whatsappNotifications || !user.whatsappPhone) return null;
  return { phone: user.whatsappPhone, name: user.name, username: user.username };
}

// ══════════════════════════════════════════════════════════════════
// Activar notificaciones WhatsApp — callable desde la app
// ══════════════════════════════════════════════════════════════════
exports.activateWhatsAppNotifications = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const { phoneNumber } = data;
  const userId = context.auth.uid;
  if (!phoneNumber) throw new functions.https.HttpsError('invalid-argument', 'Número requerido');

  await db.collection('users').doc(userId).update({
    whatsappNotifications: true,
    whatsappPhone:         phoneNumber,
    updatedAt:             admin.firestore.FieldValue.serverTimestamp(),
  });

  const userDoc = await db.collection('users').doc(userId).get();
  const user    = userDoc.data();

  await sendWhatsApp(phoneNumber, FLOW_IDS.welcome, {
    first_name: user.name || 'Creador',
    username:   user.username,
  });

  return { success: true };
});

// ══════════════════════════════════════════════════════════════════
// Desactivar notificaciones WhatsApp
// ══════════════════════════════════════════════════════════════════
exports.deactivateWhatsAppNotifications = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  await db.collection('users').doc(context.auth.uid).update({
    whatsappNotifications: false,
    updatedAt:             admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// ══════════════════════════════════════════════════════════════════
// Notificaciones exportadas para llamar desde sendgrid-triggers.js
// ══════════════════════════════════════════════════════════════════
exports.notifySocialClickWhatsApp = async (videoOwnerId, networkLabel, clickedAt) => {
  const wa = await getUserWhatsApp(videoOwnerId);
  if (!wa) return;
  await sendWhatsApp(wa.phone, FLOW_IDS.socialClick, {
    network_label: networkLabel,
    clicked_at:    clickedAt,
    username:      wa.username,
  });
};

exports.notifyActionClickWhatsApp = async (videoOwnerId, actionButtonText, totalClicksToday) => {
  const wa = await getUserWhatsApp(videoOwnerId);
  if (!wa) return;
  await sendWhatsApp(wa.phone, FLOW_IDS.actionClick, {
    action_button_text: actionButtonText,
    total_clicks_today: String(totalClicksToday),
  });
};

exports.notifyNewFollowerWhatsApp = async (followingId, followerName, followerUsername, totalFollowers) => {
  const wa = await getUserWhatsApp(followingId);
  if (!wa) return;
  await sendWhatsApp(wa.phone, FLOW_IDS.newFollower, {
    follower_name:     followerName,
    follower_username: followerUsername,
    total_followers:   String(totalFollowers),
  });
};

exports.notifyWeeklyStatsWhatsApp = async (userId, stats) => {
  const wa = await getUserWhatsApp(userId);
  if (!wa) return;
  await sendWhatsApp(wa.phone, FLOW_IDS.weeklyStats, {
    total_views:         String(stats.totalViews || 0),
    total_action_clicks: String(stats.totalActionClicks || 0),
    total_social_clicks: String(stats.totalSocialClicks || 0),
    new_followers:       String(stats.newFollowers || 0),
  });
};
