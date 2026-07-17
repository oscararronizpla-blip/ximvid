const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

const DIAS_GRACIA = 30;

// Borra archivos de un video en Storage (misma logica que admin-delete)
async function deleteVideoFiles(userId, videoId) {
  const bucket = admin.storage().bucket();
  try { await bucket.deleteFiles({ prefix: `videos/${userId}/${videoId}/` }); } catch (e) {}
  try { await bucket.deleteFiles({ prefix: `thumbnails/${userId}/${videoId}/` }); } catch (e) {}
}

// Borrado completo de un usuario: identico a adminDeleteUser + colecciones nuevas
async function borrarUsuarioCompleto(userId) {
  const bucket = admin.storage().bucket();

  // 1. Videos (Firestore + Storage)
  const vids = await db.collection('videos').where('userId', '==', userId).get();
  for (const doc of vids.docs) {
    await deleteVideoFiles(userId, doc.id);
    await doc.ref.delete();
  }

  // 2. Archivos de perfil
  for (const p of [`profilePhotos/${userId}/`, `bannerPhotos/${userId}/`, `galleryPhotos/${userId}/`]) {
    try { await bucket.deleteFiles({ prefix: p }); } catch (e) {}
  }

  // 3. Follows
  const f1 = await db.collection('follows').where('followerId', '==', userId).get();
  const f2 = await db.collection('follows').where('followingId', '==', userId).get();
  for (const doc of [...f1.docs, ...f2.docs]) { await doc.ref.delete(); }

  // 4. Notificaciones
  const notifs = await db.collection('notifications').where('userId', '==', userId).get();
  for (const doc of notifs.docs) { await doc.ref.delete(); }

  // 5. Interacciones e impresiones (algoritmo)
  const inter = await db.collection('interactions').where('userId', '==', userId).get();
  for (const doc of inter.docs) { await doc.ref.delete(); }
  const impr = await db.collection('impressions').where('userId', '==', userId).get();
  for (const doc of impr.docs) { await doc.ref.delete(); }

  // 6. Compras de Play (registro interno; la suscripcion en si se cancela en Google Play)
  const compras = await db.collection('play_purchases').where('userId', '==', userId).get();
  for (const doc of compras.docs) { await doc.ref.delete(); }

  // 7. Doc del usuario
  await db.collection('users').doc(userId).delete();

  // 8. Firebase Auth
  try { await admin.auth().deleteUser(userId); }
  catch (e) { console.error('Auth delete (puede no existir):', e.message); }

  console.log('Usuario purgado:', userId, '| videos:', vids.size);
  return vids.size;
}

// Scheduler diario: purga cuentas cuya ventana de 30 dias ha vencido
exports.purgarCuentas = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 4 * * *')
  .timeZone('Europe/Madrid')
  .onRun(async () => {
    const limite = admin.firestore.Timestamp.fromMillis(Date.now() - DIAS_GRACIA * 86400000);
    const snap = await db.collection('users')
      .where('accountStatus', '==', 'pending_deletion')
      .where('deletionRequestedAt', '<=', limite)
      .get();
    if (snap.empty) { console.log('Sin cuentas que purgar'); return null; }
    console.log('Cuentas a purgar:', snap.size);
    for (const doc of snap.docs) {
      try { await borrarUsuarioCompleto(doc.id); }
      catch (e) { console.error('Error purgando', doc.id, e.message); }
    }
    return null;
  });

exports.borrarUsuarioCompleto = borrarUsuarioCompleto;
