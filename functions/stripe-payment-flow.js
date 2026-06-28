const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const Stripe    = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const db     = admin.firestore();

exports.createStripePaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const userId = context.auth.uid;
  const premiumConfig = await db.collection('config').doc('premium').get();
  const config = premiumConfig.data();
  if (!config?.stripePriceId) throw new functions.https.HttpsError('failed-precondition', 'Precio no configurado');
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  let stripeCustomerId = userData.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email: userData.email, name: userData.name, metadata: { userId } });
    stripeCustomerId = customer.id;
    await db.collection('users').doc(userId).update({ stripeCustomerId });
  }
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: config.stripePriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId },
  });
  return {
    subscriptionId: subscription.id,
    clientSecret: subscription.latest_invoice.payment_intent.client_secret,
  };
});

exports.cancelStripeSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const { stripeCustomerId } = userDoc.data();
  if (!stripeCustomerId) throw new functions.https.HttpsError('not-found', 'Sin suscripción');
  const subscriptions = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 });
  if (subscriptions.data.length === 0) throw new functions.https.HttpsError('not-found', 'No hay suscripción activa');
  const subscription = await stripe.subscriptions.update(subscriptions.data[0].id, { cancel_at_period_end: true });
  return { cancelAt: new Date(subscription.cancel_at * 1000).toISOString(), message: 'Tu Plan Premium seguirá activo hasta el final del período pagado.' };
});

exports.getStripeBillingPortal = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const { stripeCustomerId } = userDoc.data();
  if (!stripeCustomerId) throw new functions.https.HttpsError('not-found', 'Sin cliente');
  const session = await stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: 'https://ximvid-c8627.web.app/premium.html' });
  return { url: session.url };
});

exports.stripeWebhook = functions.https.onRequest((req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  console.log('Evento recibido:', event.type);

  const handleEvent = async () => {
    async function getUserByCustomer(customerId) {
      const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      return snap.empty ? null : snap.docs[0];
    }
    async function updateVideosPremium(userId, isPremium) {
      const snap = await db.collection('videos').where('userId', '==', userId).get();
      const batch = db.batch();
      snap.docs.forEach(v => batch.update(v.ref, { isPremiumUser: isPremium }));
      await batch.commit();
    }

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const userDoc = await getUserByCustomer(invoice.customer);
        if (!userDoc) { console.log('Usuario no encontrado:', invoice.customer); break; }
        const updateData = { isPremium: true, premiumSince: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          updateData.premiumUntil = admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000);
        }
        await userDoc.ref.update(updateData);
        await db.collection('notifications').add({ userId: userDoc.id, type: 'premium_activated', title: 'Tu Plan Premium está activo ⭐', message: `Premium activo hasta ${premiumUntil.toDate().toLocaleDateString()}`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        await db.collection('notifications').add({ userId: userDoc.id, type: 'premium_activated', title: 'Tu Plan Premium está activo ⭐', message: 'Premium activado correctamente', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userDoc = await getUserByCustomer(sub.customer);
        if (!userDoc) break;
        await userDoc.ref.update({ isPremium: false, premiumUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await updateVideosPremium(userDoc.id, false);
        console.log('✅ Premium desactivado para usuario:', userDoc.id);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const userDoc = await getUserByCustomer(invoice.customer);
        if (!userDoc) break;
        await db.collection('notifications').add({ userId: userDoc.id, type: 'payment_failed', title: 'Error en el pago', message: 'No pudimos procesar tu pago. Actualiza tu método de pago.', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        break;
      }
    }
  };

  handleEvent().then(() => res.json({ received: true })).catch(err => {
    console.error('Error procesando evento:', err);
    res.status(500).send('Error interno');
  });
});
