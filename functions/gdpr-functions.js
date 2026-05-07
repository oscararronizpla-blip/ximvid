/**
 * XIMVID — functions/gdpr-functions.js
 * Funciones de GDPR/CCPA:
 *  - requestAccountDeletion: crea la solicitud (ya en SettingsScreen)
 *  - processDeleteQueue: procesa las solicitudes pendientes (cron cada hora)
 *
 * La eliminación es en dos fases:
 *  1. El usuario solicita desde la app → crea deletionRequest
 *  2. Esta Function procesa la cola y borra TODO irreversiblemente
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

const db      = admin.firestore();
const storage = admin.storage();
const auth    = admin.auth();

// ══════════════════════════════════════════════════════════════════
// processDeleteQueue — cron cada hora
// Procesa solicitudes de eliminación pendientes
// ══════════════════════════════════════════════════════════════════
exports.processDeleteQueue = functions.pubsub
  .schedule('0 * * * *') // Cada hora
  .timeZone('UTC')
  .onRun(async () => {
    console.log('processDeleteQueue iniciado');

    const pendingSnap = await db.collection('deletionRequests')
      .where('status', '==', 'pending')
      .limit(10) // Procesar de 10 en 10 para no agotar el tiempo
      .get();

    if (pendingSnap.empty) {
      console.log('No hay solicitudes de eliminación pendientes');
      return;
    }

    for (const requestDoc of pendingSnap.docs) {
      const request = requestDoc.data();
      const userId  = request.userId;

      console.log(`Procesando eliminación para userId: ${userId}`);

      try {
        // Marcar como "en proceso"
        await requestDoc.ref.update({ status: 'processing' });

        const deletedData = {
          firestoreUser:   false,
          firestoreVideos: false,
          storageFiles:    false,
          authAccount:     false,
          stripeCustomer:  false,
        };

        // ── 1. Borrar videos de Firestore ─────────────────────────
        const videosSnap = await db.collection('videos')
          .where('userId', '==', userId)
          .get();

        const batch1 = db.batch();
        videosSnap.docs.forEach(v => batch1.delete(v.ref));
        await batch1.commit();
        deletedData.firestoreVideos = true;
        console.log(`  ✅ Videos borrados (${videosSnap.size})`);

        // ── 2. Borrar clicks y estadísticas relacionadas ───────────
        const collectionsToClean = [
          'actionClicks', 'socialClicks', 'landingVisits',
          'notifications', 'weeklyStats',
        ];

        for (const col of collectionsToClean) {
          const snap = await db.collection(col)
            .where('userId', '==', userId)
            .get();
          const b = db.batch();
          snap.docs.forEach(d => b.delete(d.ref));
          if (!snap.empty) await b.commit();
        }

        // Borrar clicks donde el usuario es el propietario del video
        const ownerClicks = await db.collection('actionClicks')
          .where('videoOwnerId', '==', userId)
          .get();
        const b2 = db.batch();
        ownerClicks.docs.forEach(d => b2.delete(d.ref));
        if (!ownerClicks.empty) await b2.commit();

        // ── 3. Borrar relaciones de followers ─────────────────────
        const [followingSnap, followersSnap] = await Promise.all([
          db.collection('followers').where('followerId',  '==', userId).get(),
          db.collection('followers').where('followingId', '==', userId).get(),
        ]);
        const b3 = db.batch();
        [...followingSnap.docs, ...followersSnap.docs].forEach(d => b3.delete(d.ref));
        if (!followingSnap.empty || !followersSnap.empty) await b3.commit();

        // ── 4. Borrar archivos de Storage ─────────────────────────
        const bucket = storage.bucket();
        const foldersToDelete = [
          `profilePhotos/${userId}/`,
          `bannerPhotos/${userId}/`,
          `videos/${userId}/`,
          `thumbnails/${userId}/`,
        ];

        for (const folder of foldersToDelete) {
          try {
            await bucket.deleteFiles({ prefix: folder });
          } catch (err) {
            console.warn(`  ⚠️  Error borrando ${folder}:`, err.message);
          }
        }
        deletedData.storageFiles = true;
        console.log('  ✅ Archivos de Storage borrados');

        // ── 5. Borrar Stripe customer (si existe) ─────────────────
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const { stripeCustomerId } = userDoc.data();
          if (stripeCustomerId) {
            try {
              const Stripe = require('stripe');
              const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
              await stripe.customers.del(stripeCustomerId);
              deletedData.stripeCustomer = true;
              console.log('  ✅ Cliente Stripe borrado');
            } catch (err) {
              console.warn('  ⚠️  Error borrando Stripe customer:', err.message);
            }
          }
        }

        // ── 6. Borrar documento del usuario de Firestore ──────────
        await db.collection('users').doc(userId).delete();
        deletedData.firestoreUser = true;
        console.log('  ✅ Documento de usuario borrado');

        // ── 7. Borrar cuenta de Firebase Auth ─────────────────────
        try {
          await auth.deleteUser(userId);
          deletedData.authAccount = true;
          console.log('  ✅ Cuenta de Auth borrada');
        } catch (err) {
          // El usuario puede haber borrado su cuenta desde el cliente ya
          if (err.code !== 'auth/user-not-found') {
            console.warn('  ⚠️  Error borrando Auth user:', err.message);
          }
        }

        // ── 8. Marcar solicitud como completada ───────────────────
        await requestDoc.ref.update({
          status:      'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          deletedData,
        });

        console.log(`✅ Eliminación completada para userId: ${userId}`);

      } catch (err) {
        console.error(`❌ Error procesando eliminación para ${userId}:`, err);
        await requestDoc.ref.update({
          status: 'error',
          error:  err.message,
        });
      }
    }

    console.log('processDeleteQueue finalizado');
  });

// ══════════════════════════════════════════════════════════════════
// requestAccountDeletion — callable desde la app (backup)
// La solicitud principal se crea en SettingsScreen directamente en Firestore
// Esta Function es un backup por si el cliente falla
// ══════════════════════════════════════════════════════════════════
exports.requestAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const userId = context.auth.uid;

  // Verificar que no hay ya una solicitud pendiente
  const existing = await db.collection('deletionRequests')
    .where('userId', '==', userId)
    .where('status', 'in', ['pending', 'processing'])
    .limit(1)
    .get();

  if (!existing.empty) {
    return { success: true, message: 'Ya existe una solicitud de eliminación en proceso.' };
  }

  const userDoc = await db.collection('users').doc(userId).get();
  const email   = userDoc.exists ? userDoc.data().email : context.auth.token?.email || '';

  await db.collection('deletionRequests').add({
    userId,
    email,
    reason:      data.reason || '',
    status:      'pending',
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    completedAt: null,
    deletedData: {
      firestoreUser:   false,
      firestoreVideos: false,
      storageFiles:    false,
      authAccount:     false,
      stripeCustomer:  false,
    },
  });

  return {
    success: true,
    message: 'Solicitud de eliminación registrada. Tus datos serán eliminados en las próximas horas.',
  };
});
