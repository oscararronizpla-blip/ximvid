/**
 * XIMVID — functions/admin-functions.js
 * Funciones exclusivas del panel de administración.
 * TODAS verifican que el llamante es admin antes de ejecutar.
 *
 * Funciones:
 *  - getAdminStats:      estadísticas globales de la plataforma
 *  - banUser:            banear/desbanear un usuario
 *  - suspendVideo:       suspender/restaurar un video
 *  - updatePremiumPrice: actualizar el precio Premium en Firestore
 *  - reviewReport:       revisar un reporte de contenido
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

const db = admin.firestore();

// ─── Helper: verificar que es admin ──────────────────────────────
async function requireAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || !userDoc.data().isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
}

// ─── Helper: sanitizar texto básico (seguridad en server) ────────
function sanitizeInput(str, maxLen = 500) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

// ══════════════════════════════════════════════════════════════════
// getAdminStats — estadísticas globales de la plataforma
// ══════════════════════════════════════════════════════════════════
exports.getAdminStats = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const now       = new Date();
  const last7days = new Date(now.getTime() - 7 * 86400000);
  const last30days = new Date(now.getTime() - 30 * 86400000);

  const ts7  = admin.firestore.Timestamp.fromDate(last7days);
  const ts30 = admin.firestore.Timestamp.fromDate(last30days);

  const [
    totalUsersSnap, newUsersWeekSnap, newUsersMonthSnap,
    totalVideosSnap, newVideosWeekSnap,
    premiumUsersSnap,
    pendingReportsSnap,
    totalActionClicksSnap,
  ] = await Promise.all([
    db.collection('users').where('isBanned','==',false).count().get(),
    db.collection('users').where('createdAt','>=',ts7).count().get(),
    db.collection('users').where('createdAt','>=',ts30).count().get(),
    db.collection('videos').where('isActive','==',true).count().get(),
    db.collection('videos').where('createdAt','>=',ts7).count().get(),
    db.collection('users').where('isPremium','==',true).count().get(),
    db.collection('videoReports').where('status','==','pending').count().get(),
    db.collection('actionClicks').where('clickedAt','>=',ts7).count().get(),
  ]);

  return {
    totalUsers:         totalUsersSnap.data().count,
    newUsersThisWeek:   newUsersWeekSnap.data().count,
    newUsersThisMonth:  newUsersMonthSnap.data().count,
    totalVideos:        totalVideosSnap.data().count,
    newVideosThisWeek:  newVideosWeekSnap.data().count,
    premiumUsers:       premiumUsersSnap.data().count,
    pendingReports:     pendingReportsSnap.data().count,
    actionClicksWeek:   totalActionClicksSnap.data().count,
    generatedAt:        new Date().toISOString(),
  };
});

// ══════════════════════════════════════════════════════════════════
// banUser — banear o desbanear un usuario
// ══════════════════════════════════════════════════════════════════
exports.banUser = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { userId, ban, reason } = data;

  if (!userId || typeof ban !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'userId y ban son requeridos');
  }

  const sanitizedReason = sanitizeInput(reason || '', 200);

  await db.collection('users').doc(userId).update({
    isBanned:  ban,
    banReason: ban ? sanitizedReason : '',
    bannedAt:  ban ? admin.firestore.FieldValue.serverTimestamp() : null,
    bannedBy:  ban ? context.auth.uid : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Si se banea, suspender todos sus videos
  if (ban) {
    const videosSnap = await db.collection('videos')
      .where('userId', '==', userId)
      .get();

    const batch = db.batch();
    videosSnap.docs.forEach(v => batch.update(v.ref, { isSuspended:true, isActive:false }));
    if (!videosSnap.empty) await batch.commit();
  } else {
    // Al desbanear, restaurar sus videos
    const videosSnap = await db.collection('videos')
      .where('userId', '==', userId)
      .get();

    const batch = db.batch();
    videosSnap.docs.forEach(v => batch.update(v.ref, { isSuspended:false, isActive:true }));
    if (!videosSnap.empty) await batch.commit();
  }

  console.log(`Admin ${context.auth.uid} ${ban ? 'baneó' : 'desbaneó'} a userId: ${userId}`);
  return { success: true, userId, banned: ban };
});

// ══════════════════════════════════════════════════════════════════
// suspendVideo — suspender o restaurar un video
// ══════════════════════════════════════════════════════════════════
exports.suspendVideo = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { videoId, suspend, reason } = data;

  if (!videoId || typeof suspend !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'videoId y suspend son requeridos');
  }

  const sanitizedReason = sanitizeInput(reason || '', 200);

  await db.collection('videos').doc(videoId).update({
    isSuspended:     suspend,
    isActive:        !suspend,
    suspendReason:   suspend ? sanitizedReason : '',
    suspendedAt:     suspend ? admin.firestore.FieldValue.serverTimestamp() : null,
    suspendedBy:     suspend ? context.auth.uid : null,
    updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Admin ${context.auth.uid} ${suspend ? 'suspendió' : 'restauró'} video: ${videoId}`);
  return { success: true, videoId, suspended: suspend };
});

// ══════════════════════════════════════════════════════════════════
// updatePremiumPrice — actualizar precio desde el panel admin
// Sin necesidad de redesplegar la app
// ══════════════════════════════════════════════════════════════════
exports.updatePremiumPrice = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { stripePriceId, amount, currency, label } = data;

  // Validaciones básicas
  if (!stripePriceId || typeof stripePriceId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'stripePriceId requerido');
  }
  if (!amount || typeof amount !== 'number' || amount < 99) {
    throw new functions.https.HttpsError('invalid-argument', 'amount mínimo: 99 (céntimos)');
  }

  // Verificar que el Price ID existe en Stripe
  try {
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.prices.retrieve(sanitizeInput(stripePriceId, 50));
  } catch (err) {
    throw new functions.https.HttpsError('invalid-argument', 'Price ID de Stripe no válido');
  }

  await db.collection('config').doc('premium').update({
    stripePriceId:      sanitizeInput(stripePriceId, 50),
    monthlyPriceAmount: Math.round(amount),
    monthlyCurrency:    sanitizeInput(currency || 'eur', 3).toLowerCase(),
    monthlyLabel:       sanitizeInput(label || `${(amount/100).toFixed(2)}€/mes`, 30),
    updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
    updatedBy:          context.auth.uid,
  });

  console.log(`Admin ${context.auth.uid} actualizó precio Premium: ${amount} ${currency}`);
  return { success: true, amount, currency, label };
});

// ══════════════════════════════════════════════════════════════════
// reviewReport — revisar un reporte de contenido
// ══════════════════════════════════════════════════════════════════
exports.reviewReport = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { reportId, resolution, action } = data;
  // action: 'dismiss' | 'suspend_video' | 'ban_user'

  if (!reportId) {
    throw new functions.https.HttpsError('invalid-argument', 'reportId requerido');
  }

  const reportDoc = await db.collection('videoReports').doc(reportId).get();
  if (!reportDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Reporte no encontrado');
  }

  const report = reportDoc.data();

  // Actualizar el reporte
  await reportDoc.ref.update({
    status:       'resolved',
    resolution:   sanitizeInput(resolution || '', 200),
    reviewedBy:   context.auth.uid,
    reviewedAt:   admin.firestore.FieldValue.serverTimestamp(),
  });

  // Ejecutar la acción correspondiente
  if (action === 'suspend_video' && report.videoId) {
    await db.collection('videos').doc(report.videoId).update({
      isSuspended: true,
      isActive:    false,
      suspendedBy: context.auth.uid,
      suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else if (action === 'ban_user' && report.reportedUserId) {
    await db.collection('users').doc(report.reportedUserId).update({
      isBanned:  true,
      banReason: `Reporte: ${report.reason}`,
      bannedBy:  context.auth.uid,
      bannedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: true, reportId, action };
});
