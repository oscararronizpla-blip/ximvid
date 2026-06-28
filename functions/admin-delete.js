const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Verifica que quien llama es administrador
async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login requerido');
  }
  const snap = await db.collection('users').doc(context.auth.uid).get();
  if (!snap.exists || snap.data().isAdmin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores');
  }
}

// Borra todos los archivos de un video en Storage
async function deleteVideoFiles(userId, videoId) {
  const bucket = admin.storage().bucket();
  const prefix = `videos/${userId}/${videoId}/`;
  try {
    await bucket.deleteFiles({ prefix });
  } catch (e) {
    console.error('Error borrando archivos del video', videoId, e);
  }
  // Tambien thumbnails si estan en carpeta aparte
  try {
    await bucket.deleteFiles({ prefix: `thumbnails/${userId}/${videoId}/` });
  } catch (e) {}
}

// ── adminDeleteVideo ──────────────────────────────────────────────
exports.adminDeleteVideo = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const { videoId } = data;
  if (!videoId) throw new functions.https.HttpsError('invalid-argument', 'Falta videoId');

  const ref = db.collection('videos').doc(videoId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Video no existe');

  const v = snap.data();
  await deleteVideoFiles(v.userId, videoId);
  await ref.delete();

  return { ok: true, deleted: videoId };
});

// ── adminDeleteUser ───────────────────────────────────────────────
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const { userId } = data;
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'Falta userId');

  // 1. Borrar todos sus videos (Firestore + Storage)
  const vids = await db.collection('videos').where('userId', '==', userId).get();
  const bucket = admin.storage().bucket();
  for (const doc of vids.docs) {
    await deleteVideoFiles(userId, doc.id);
    await doc.ref.delete();
  }

  // 2. Borrar archivos de perfil/banner/galeria
  for (const p of [`profilePhotos/${userId}/`, `bannerPhotos/${userId}/`, `galleryPhotos/${userId}/`]) {
    try { await bucket.deleteFiles({ prefix: p }); } catch (e) {}
  }

  // 3. Borrar follows relacionados
  const f1 = await db.collection('follows').where('followerId', '==', userId).get();
  const f2 = await db.collection('follows').where('followingId', '==', userId).get();
  for (const doc of [...f1.docs, ...f2.docs]) { await doc.ref.delete(); }

  // 4. Borrar notificaciones
  const notifs = await db.collection('notifications').where('userId', '==', userId).get();
  for (const doc of notifs.docs) { await doc.ref.delete(); }

  // 5. Borrar documento del usuario
  await db.collection('users').doc(userId).delete();

  // 6. Borrar de Firebase Auth
  try {
    await admin.auth().deleteUser(userId);
  } catch (e) {
    console.error('Error borrando de Auth (puede que ya no exista):', e.message);
  }

  return { ok: true, deletedUser: userId, videosDeleted: vids.size };
});

// ── adminSetUserStatus ────────────────────────────────────────────
// Cambiar estado: active | self_paused | admin_banned
exports.adminSetUserStatus = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const { userId, status, reason } = data;
  const valid = ['active', 'self_paused', 'admin_banned'];
  if (!userId || !valid.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos invalidos');
  }
  await db.collection('users').doc(userId).update({
    accountStatus: status,
    statusReason: reason || '',
    statusChangedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, userId, status };
});
