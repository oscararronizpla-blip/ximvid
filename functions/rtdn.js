const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

const db = admin.firestore();
const PACKAGE_NAME = 'com.ximvid.app';

async function getPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const authClient = await auth.getClient();
  return google.androidpublisher({ version: 'v3', auth: authClient });
}

async function updateVideosPremium(userId, isPremium) {
  const snap = await db.collection('videos').where('userId', '==', userId).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(v => batch.update(v.ref, { isPremiumUser: isPremium }));
  await batch.commit();
}

async function quitarPremium(uid, motivo) {
  await db.collection('users').doc(uid).update({
    isPremium: false,
    premiumUntil: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await updateVideosPremium(uid, false);
  console.log('Premium RETIRADO a', uid, '| motivo:', motivo);
}

exports.playBillingRTDN = functions
  .region('us-central1')
  .pubsub.topic('play-billing-rtdn')
  .onPublish(async (message) => {
    let payload;
    try {
      payload = message.json;
    } catch (e) {
      console.error('Mensaje no parseable');
      return null;
    }

    // Notificacion de prueba de Play Console
    if (payload.testNotification) {
      console.log('TEST NOTIFICATION recibida OK:', JSON.stringify(payload.testNotification));
      return null;
    }

    const sn = payload.subscriptionNotification;
    if (!sn || !sn.purchaseToken) {
      console.log('Notificacion sin subscriptionNotification, ignorada:', JSON.stringify(payload).slice(0, 300));
      return null;
    }

    const token = sn.purchaseToken;
    const tipo = sn.notificationType;
    console.log('RTDN tipo:', tipo, '| token:', token.slice(0, 12) + '...');

    // Buscar a quien pertenece el token
    const tokenSnap = await db.collection('play_purchases').doc(token).get();
    if (!tokenSnap.exists) {
      console.warn('Token desconocido (compra no registrada aun):', token.slice(0, 12));
      return null;
    }
    const uid = tokenSnap.data().userId;
    if (!uid) return null;

    // Consultar el estado REAL en Google (nunca fiarse solo del tipo)
    let sub;
    try {
      const publisher = await getPublisher();
      const res = await publisher.purchases.subscriptionsv2.get({
        packageName: PACKAGE_NAME,
        token: token,
      });
      sub = res.data;
    } catch (err) {
      console.error('Error consultando Google:', err.message);
      return null;
    }

    const state = sub.subscriptionState;
    const activos = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'];
    const line = (sub.lineItems && sub.lineItems[0]) || {};

    await db.collection('play_purchases').doc(token).set({
      state: state,
      notificationType: tipo,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (activos.includes(state) && line.expiryTime) {
      const premiumUntil = admin.firestore.Timestamp.fromDate(new Date(line.expiryTime));
      await db.collection('users').doc(uid).update({
        isPremium: true,
        premiumUntil: premiumUntil,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await updateVideosPremium(uid, true);
      console.log('Premium RENOVADO/ACTIVO para', uid, 'hasta', line.expiryTime);
    } else {
      await quitarPremium(uid, state);
      let titulo = 'Tu Plan Premium ha finalizado';
      let msg = 'Tu suscripcion ya no esta activa.';
      if (state === 'SUBSCRIPTION_STATE_ON_HOLD' || tipo === 5) {
        titulo = 'Problema con tu pago';
        msg = 'No pudimos cobrar tu suscripcion. Actualiza tu metodo de pago en Google Play.';
      }
      await db.collection('notifications').add({
        userId: uid,
        type: 'premium_ended',
        title: titulo,
        message: msg,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return null;
  });
