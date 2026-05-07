/**
 * XIMVID — functions/stripe-payment-flow.js
 * ─────────────────────────────────────────────────────────────────
 * Cloud Functions de Firebase para el flujo de pagos de Stripe.
 * El precio Premium se lee desde Firestore (config/premium)
 * para que el admin pueda cambiarlo sin redesplegar.
 * Importado en functions/index.js
 * ─────────────────────────────────────────────────────────────────
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const Stripe    = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const db     = admin.firestore();

// ══════════════════════════════════════════════════════════════════
// createStripePaymentIntent — inicia el pago Premium desde la app
// ══════════════════════════════════════════════════════════════════
exports.createStripePaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userId = context.auth.uid;

  // Leer precio desde Firestore — el admin lo actualiza sin redesplegar
  const premiumConfig = await db.collection('config').doc('premium').get();
  const config = premiumConfig.data();

  if (!config?.stripePriceId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El precio Premium no está configurado. Contacta con soporte.'
    );
  }

  // Obtener o crear cliente de Stripe
  const userDoc  = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  let stripeCustomerId = userData.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email:    userData.email,
      name:     userData.name,
      metadata: { userId, username: userData.username },
    });
    stripeCustomerId = customer.id;
    await db.collection('users').doc(userId).update({ stripeCustomerId });
  }

  // Crear suscripción con pago pendiente
  const subscription = await stripe.subscriptions.create({
    customer:         stripeCustomerId,
    items:            [{ price: config.stripePriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand:           ['latest_invoice.payment_intent'],
    metadata:         { userId, username: userData.username },
  });

  return {
    subscriptionId: subscription.id,
    clientSecret:   subscription.latest_invoice.payment_intent.client_secret,
    amount:         config.monthlyPriceAmount,
    currency:       config.monthlyCurrency,
    label:          config.monthlyLabel,
  };
});

// ══════════════════════════════════════════════════════════════════
// cancelStripeSubscription — cancela al final del período pagado
// ══════════════════════════════════════════════════════════════════
exports.cancelStripeSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const { stripeCustomerId } = userDoc.data();

  if (!stripeCustomerId) throw new functions.https.HttpsError('not-found', 'Sin suscripción');

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status:   'active',
    limit:    1,
  });

  if (subscriptions.data.length === 0) {
    throw new functions.https.HttpsError('not-found', 'No hay suscripción activa');
  }

  const subscription = await stripe.subscriptions.update(
    subscriptions.data[0].id,
    { cancel_at_period_end: true }
  );

  return {
    cancelAt: new Date(subscription.cancel_at * 1000).toISOString(),
    message:  'Tu Plan Premium seguirá activo hasta el final del período pagado.',
  };
});

// ══════════════════════════════════════════════════════════════════
// getStripeBillingPortal — portal de gestión de facturación
// ══════════════════════════════════════════════════════════════════
exports.getStripeBillingPortal = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const { stripeCustomerId } = userDoc.data();

  if (!stripeCustomerId) throw new functions.https.HttpsError('not-found', 'Sin cliente');

  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: 'ximvid://settings/premium',
  });

  return { url: session.url };
});

// ══════════════════════════════════════════════════════════════════
// stripeWebhook — recibe eventos de Stripe y actualiza Firestore
// ══════════════════════════════════════════════════════════════════
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  // ─── Helper: buscar usuario por stripeCustomerId ──────────────
  async function getUserByCustomer(customerId) {
    const snap = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    return snap.empty ? null : snap.docs[0];
  }

  // ─── Helper: actualizar isPremiumUser en todos los videos ─────
  async function updateVideosPremium(userId, isPremium) {
    const videosSnap = await db.collection('videos')
      .where('userId', '==', userId).get();
    const batch = db.batch();
    videosSnap.docs.forEach(v => batch.update(v.ref, { isPremiumUser: isPremium }));
    await batch.commit();
  }

  switch (event.type) {

    // ── Pago exitoso → activar Premium ───────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice    = event.data.object;
      const userDoc    = await getUserByCustomer(invoice.customer);
      if (!userDoc) break;

      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const premiumUntil = admin.firestore.Timestamp.fromMillis(
        subscription.current_period_end * 1000
      );

      await userDoc.ref.update({
        isPremium:    true,
        premiumSince: admin.firestore.FieldValue.serverTimestamp(),
        premiumUntil,
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
      });

      await updateVideosPremium(userDoc.id, true);

      // Notificación in-app
      await db.collection('notifications').add({
        userId:    userDoc.id,
        type:      'premium_activated',
        title:     'Tu Plan Premium está activo ⭐',
        message:   `Premium activo hasta ${premiumUntil.toDate().toLocaleDateString()}`,
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Premium activado: ${userDoc.id}`);
      break;
    }

    // ── Suscripción eliminada → desactivar Premium ────────────────
    case 'customer.subscription.deleted': {
      const sub     = event.data.object;
      const userDoc = await getUserByCustomer(sub.customer);
      if (!userDoc) break;

      await userDoc.ref.update({
        isPremium:    false,
        premiumUntil: null,
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
      });

      await updateVideosPremium(userDoc.id, false);

      await db.collection('notifications').add({
        userId:    userDoc.id,
        type:      'premium_cancelled',
        title:     'Plan Premium cancelado',
        message:   'Tu plan ha expirado. Puedes renovarlo cuando quieras.',
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Premium desactivado: ${userDoc.id}`);
      break;
    }

    // ── Fallo de pago → notificación ─────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const userDoc = await getUserByCustomer(invoice.customer);
      if (!userDoc) break;

      await db.collection('notifications').add({
        userId:    userDoc.id,
        type:      'payment_failed',
        title:     'Error en el pago de tu Plan Premium',
        message:   'No pudimos procesar tu pago. Actualiza tu método de pago.',
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      break;
    }

    default:
      break;
  }

  res.json({ received: true });
});
