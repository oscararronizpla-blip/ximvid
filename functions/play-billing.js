const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

const db = admin.firestore();
const PACKAGE_NAME = 'com.ximvid.app';
const PRODUCT_ID = 'premium_mensual';

// Cliente autenticado con la identidad de la function (service account del proyecto)
async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const authClient = await auth.getClient();
  return google.androidpublisher({ version: 'v3', auth: authClient });
}

// Marca todos los videos del usuario como premium (o no)
async function updateVideosPremium(userId, isPremium) {
  const snap = await db.collection('videos').where('userId', '==', userId).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(v => batch.update(v.ref, { isPremiumUser: isPremium }));
  await batch.commit();
}

exports.verifyPlayPurchase = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login requerido');
  }
  const uid = context.auth.uid;
  const purchaseToken = data && data.purchaseToken;
  const productId = (data && data.productId) || PRODUCT_ID;

  if (!purchaseToken || typeof purchaseToken !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'purchaseToken requerido');
  }
  if (productId !== PRODUCT_ID) {
    throw new functions.https.HttpsError('invalid-argument', 'Producto no valido');
  }

  // ANTI-FRAUDE: el token no puede estar ya asignado a otro usuario
  const tokenRef = db.collection('play_purchases').doc(purchaseToken);
  const tokenSnap = await tokenRef.get();
  if (tokenSnap.exists && tokenSnap.data().userId !== uid) {
    console.error('Token ya usado por otro usuario:', purchaseToken);
    throw new functions.https.HttpsError('permission-denied', 'Compra no valida');
  }

  // VALIDACION CONTRA GOOGLE
  let sub;
  try {
    const publisher = await getAndroidPublisher();
    const res = await publisher.purchases.subscriptionsv2.get({
      packageName: PACKAGE_NAME,
      token: purchaseToken,
    });
    sub = res.data;
  } catch (err) {
    console.error('Error validando con Google:', err.message);
    throw new functions.https.HttpsError('internal', 'No se pudo validar la compra');
  }

  const state = sub.subscriptionState;
  const activos = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'];
  if (!activos.includes(state)) {
    console.warn('Suscripcion no activa:', state);
    throw new functions.https.HttpsError('failed-precondition', 'La suscripcion no esta activa');
  }

  const line = (sub.lineItems && sub.lineItems[0]) || {};
  const expiryStr = line.expiryTime;
  if (!expiryStr) {
    throw new functions.https.HttpsError('internal', 'Sin fecha de expiracion');
  }
  const premiumUntil = admin.firestore.Timestamp.fromDate(new Date(expiryStr));

  // ESCRITURA EN FIRESTORE
  await db.collection('users').doc(uid).update({
    isPremium: true,
    premiumUntil: premiumUntil,
    premiumSince: admin.firestore.FieldValue.serverTimestamp(),
    playPurchaseToken: purchaseToken,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await tokenRef.set({
    userId: uid,
    productId: productId,
    state: state,
    premiumUntil: premiumUntil,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await updateVideosPremium(uid, true);

  await db.collection('notifications').add({
    userId: uid,
    type: 'premium_activated',
    title: 'Tu Plan Premium esta activo',
    message: 'Premium activo hasta ' + premiumUntil.toDate().toLocaleDateString('es-ES'),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('Premium activado para', uid, 'hasta', expiryStr);
  return { ok: true, premiumUntil: expiryStr };
});

exports.updateVideosPremium = updateVideosPremium;
