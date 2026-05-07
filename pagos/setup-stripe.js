/**
 * XIMVID — setup-stripe.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 5: Configura Stripe con el producto Premium y los webhooks.
 * El precio se lee desde Firestore (configurado por el admin)
 * en lugar de estar hardcodeado aquí.
 *
 * Ejecutar desde terminal:
 *   node setup-stripe.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error(`
❌ STRIPE_SECRET_KEY no encontrada en .env
   Obtén tu clave secreta en: dashboard.stripe.com → Developers → API keys
`);
  process.exit(1);
}

const Stripe = require('stripe');
const stripe = Stripe(STRIPE_SECRET_KEY);

// ─── PASO 5.1 — Crear producto Premium en Stripe ─────────────────
async function createPremiumProduct() {
  console.log('\n💳 Creando producto Premium en Stripe...');

  // Buscar si ya existe
  const existingProducts = await stripe.products.list({ limit: 100 });
  const existing = existingProducts.data.find(p => p.name === 'Ximvid Premium');

  if (existing) {
    console.log(`  ⏭  Producto "Ximvid Premium" ya existe: ${existing.id}`);
    return existing;
  }

  const product = await stripe.products.create({
    name: 'Ximvid Premium',
    description: 'Mayor visibilidad en el feed de Ximvid. Tu contenido llega a más personas.',
    metadata: {
      app: 'ximvid',
      type: 'premium_subscription',
    },
    // El icono del producto se puede añadir desde el dashboard de Stripe
  });

  console.log(`  ✅ Producto creado: ${product.id}`);
  return product;
}

// ─── PASO 5.2 — Crear precio INICIAL (el admin lo puede cambiar) ──
// El precio se guarda en Firestore para que el admin pueda actualizarlo
// sin necesidad de redesplegar. Este es el precio por defecto.
async function createInitialPrice(productId) {
  console.log('\n💰 Creando precio inicial de suscripción...');

  // Verificar si ya hay precios activos
  const existingPrices = await stripe.prices.list({
    product: productId,
    active: true,
  });

  if (existingPrices.data.length > 0) {
    console.log(`  ⏭  Ya existe un precio activo: ${existingPrices.data[0].id}`);
    return existingPrices.data[0];
  }

  // Precio por defecto: 9.99€/mes
  // El admin puede crear nuevos precios desde el dashboard de Stripe
  // y actualizar el Price ID en Firestore → config/premium.stripePriceId
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: 999,      // 9.99€ en céntimos
    currency: 'eur',
    recurring: {
      interval: 'month',
    },
    metadata: {
      app: 'ximvid',
      label: '9.99€/mes',
    },
  });

  console.log(`  ✅ Precio creado: ${price.id}`);
  console.log(`     → Guarda este ID en Firestore: config/premium.stripePriceId`);
  console.log(`     → Y en .env: STRIPE_PRICE_ID_INITIAL=${price.id}`);

  return price;
}

// ─── PASO 5.3 — Crear webhook endpoint ───────────────────────────
async function createWebhook() {
  console.log('\n🔔 Configurando webhook de Stripe...');

  // El webhook endpoint es la Firebase Function
  const webhookUrl = 'https://us-central1-ximvid.cloudfunctions.net/stripeWebhook';

  // Verificar si ya existe
  const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = existingWebhooks.data.find(w => w.url === webhookUrl);

  if (existing) {
    console.log(`  ⏭  Webhook ya existe: ${existing.id}`);
    return existing;
  }

  const webhook = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      // Suscripciones
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end',
      // Pagos
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      // Invoices
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'invoice.upcoming',
    ],
    metadata: {
      app: 'ximvid',
    },
  });

  console.log(`  ✅ Webhook creado: ${webhook.id}`);
  console.log(`     → Signing secret: ${webhook.secret}`);
  console.log(`     → Guarda en .env: STRIPE_WEBHOOK_SECRET=${webhook.secret}`);

  return webhook;
}

// ─── GENERAR src/services/stripe.js (cliente React Native) ───────
function generateStripeService() {
  const code = `/**
 * XIMVID — src/services/stripe.js
 * ─────────────────────────────────────────────────────────────────
 * Servicio de Stripe para la app React Native.
 * Gestiona el flujo de suscripción Premium.
 * ─────────────────────────────────────────────────────────────────
 */

import { initStripe, presentPaymentSheet, createPaymentMethod } from '@stripe/stripe-react-native';
import { db, functions }   from './firebase';
import { doc, getDoc }     from 'firebase/firestore';
import { httpsCallable }   from 'firebase/functions';

// ── Inicializar Stripe con la clave pública ───────────────────────
export async function initializeStripe() {
  await initStripe({
    publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    merchantIdentifier: 'merchant.com.ximvid.app', // Para Apple Pay
    urlScheme: 'ximvid', // Para redirecciones tras 3DS
  });
}

// ── Obtener el precio Premium actual desde Firestore ──────────────
// El admin puede actualizarlo sin necesidad de redesplegar la app
export async function getPremiumPriceConfig() {
  const configDoc = await getDoc(doc(db, 'config', 'premium'));
  if (!configDoc.exists()) {
    throw new Error('Configuración de precio Premium no encontrada');
  }
  return configDoc.data();
}

// ── Iniciar el flujo de pago Premium ─────────────────────────────
export async function startPremiumSubscription(userId) {
  // 1. Llamar a Firebase Function para crear el PaymentIntent
  //    La Function obtiene el precio de Firestore, no lo pasamos desde el cliente
  const createPaymentIntentFn = httpsCallable(functions, 'createStripePaymentIntent');
  const { data } = await createPaymentIntentFn({ userId });

  if (!data.clientSecret) {
    throw new Error('No se pudo iniciar el pago. Inténtalo de nuevo.');
  }

  // 2. Presentar el Payment Sheet nativo de Stripe
  const { error } = await presentPaymentSheet({
    clientSecret: data.clientSecret,
    confirmPayment: true,
  });

  if (error) {
    if (error.code === 'Canceled') {
      // El usuario canceló — no es un error real
      return { success: false, canceled: true };
    }
    throw new Error(error.message);
  }

  // 3. El webhook de Stripe actualiza Firestore automáticamente
  //    No necesitamos actualizar el estado aquí — el listener de Firestore
  //    en el hook useAuth lo detectará y actualizará la UI
  return { success: true };
}

// ── Cancelar suscripción Premium ──────────────────────────────────
export async function cancelPremiumSubscription(userId) {
  const cancelSubscriptionFn = httpsCallable(functions, 'cancelStripeSubscription');
  const { data } = await cancelSubscriptionFn({ userId });
  return data;
}

// ── Obtener portal de facturación de Stripe ───────────────────────
// Permite al usuario gestionar su método de pago, ver facturas, etc.
export async function openBillingPortal(userId) {
  const getBillingPortalFn = httpsCallable(functions, 'getStripeBillingPortal');
  const { data } = await getBillingPortalFn({ userId });
  return data.url; // URL del portal — abrir con Linking.openURL()
}
`;

  fs.mkdirSync(path.join(process.cwd(), 'src/services'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'src/services/stripe.js'), code);
  console.log('✅ src/services/stripe.js generado');
}

// ─── GENERAR la Firebase Function de Stripe ───────────────────────
function generateStripeFunction() {
  const code = `/**
 * XIMVID — functions/stripe-payment-flow.js
 * ─────────────────────────────────────────────────────────────────
 * Cloud Functions de Firebase para el flujo de pagos de Stripe.
 * Importado en functions/index.js
 * ─────────────────────────────────────────────────────────────────
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const Stripe    = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const db     = admin.firestore();

// ── createStripePaymentIntent ──────────────────────────────────────
// Llamada desde la app para iniciar el pago Premium.
// Lee el precio de Firestore (configurable por el admin).
exports.createStripePaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userId = context.auth.uid;

  // Obtener el precio Premium actual desde Firestore
  const premiumConfig = await db.collection('config').doc('premium').get();
  const config = premiumConfig.data();

  if (!config.stripePriceId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'El precio Premium aún no está configurado. Contacta con soporte.'
    );
  }

  // Obtener o crear el cliente de Stripe para este usuario
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  let stripeCustomerId = userData.stripeCustomerId;

  if (!stripeCustomerId) {
    // Primera vez: crear cliente en Stripe
    const customer = await stripe.customers.create({
      email: userData.email,
      name:  userData.name,
      metadata: { userId, username: userData.username },
    });
    stripeCustomerId = customer.id;

    // Guardar el ID del cliente en Firestore
    await db.collection('users').doc(userId).update({
      stripeCustomerId,
    });
  }

  // Crear la suscripción con un PaymentIntent
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: config.stripePriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId, username: userData.username },
  });

  return {
    subscriptionId: subscription.id,
    clientSecret:   subscription.latest_invoice.payment_intent.client_secret,
    amount:         config.monthlyPriceAmount,
    currency:       config.monthlyCurrency,
    label:          config.monthlyLabel,
  };
});

// ── cancelStripeSubscription ───────────────────────────────────────
exports.cancelStripeSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userId = context.auth.uid;
  const userDoc = await db.collection('users').doc(userId).get();
  const { stripeCustomerId } = userDoc.data();

  if (!stripeCustomerId) {
    throw new functions.https.HttpsError('not-found', 'No se encontró la suscripción');
  }

  // Obtener la suscripción activa
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    throw new functions.https.HttpsError('not-found', 'No hay suscripción activa');
  }

  // Cancelar al final del período pagado (no inmediatamente)
  const subscription = await stripe.subscriptions.update(
    subscriptions.data[0].id,
    { cancel_at_period_end: true }
  );

  return {
    cancelAt: new Date(subscription.cancel_at * 1000).toISOString(),
    message: 'Tu Plan Premium seguirá activo hasta el final del período pagado.',
  };
});

// ── getStripeBillingPortal ─────────────────────────────────────────
exports.getStripeBillingPortal = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userId = context.auth.uid;
  const userDoc = await db.collection('users').doc(userId).get();
  const { stripeCustomerId } = userDoc.data();

  if (!stripeCustomerId) {
    throw new functions.https.HttpsError('not-found', 'No se encontró el cliente');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: 'ximvid://settings/premium', // Deep link de vuelta a la app
  });

  return { url: session.url };
});

// ── stripeWebhook ──────────────────────────────────────────────────
// Endpoint HTTP que Stripe llama para notificar eventos de pago.
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, // ⚠️ Necesita rawBody — ver configuración en index.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  const db = admin.firestore();

  switch (event.type) {

    // ── Pago de suscripción exitoso ──────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice    = event.data.object;
      const customerId = invoice.customer;

      // Buscar el usuario por stripeCustomerId
      const usersSnap = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();

      if (usersSnap.empty) break;

      const userDoc  = usersSnap.docs[0];
      const userId   = userDoc.id;
      const userData = userDoc.data();

      // Calcular la fecha de fin del período
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription
      );
      const premiumUntil = admin.firestore.Timestamp.fromMillis(
        subscription.current_period_end * 1000
      );

      // Activar Premium en Firestore
      await userDoc.ref.update({
        isPremium:    true,
        premiumSince: admin.firestore.FieldValue.serverTimestamp(),
        premiumUntil,
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
      });

      // Actualizar isPremiumUser en todos sus videos (para el algoritmo del feed)
      const videosSnap = await db.collection('videos')
        .where('userId', '==', userId)
        .get();
      const batch = db.batch();
      videosSnap.docs.forEach(v => batch.update(v.ref, { isPremiumUser: true }));
      await batch.commit();

      // Enviar Email 7 (Activación Premium) — ver functions-sendgrid-triggers.js
      await db.collection('notifications').add({
        userId,
        type:    'premium_activated',
        title:   'Tu Plan Premium está activo',
        message: \`Premium activo hasta \${premiumUntil.toDate().toLocaleDateString()}\`,
        read:    false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(\`✅ Premium activado para userId: \${userId}\`);
      break;
    }

    // ── Suscripción cancelada o expirada ─────────────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId   = subscription.customer;

      const usersSnap = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();

      if (usersSnap.empty) break;

      const userDoc = usersSnap.docs[0];
      const userId  = userDoc.id;

      // Desactivar Premium
      await userDoc.ref.update({
        isPremium:    false,
        premiumUntil: null,
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
      });

      // Actualizar todos sus videos
      const videosSnap = await db.collection('videos')
        .where('userId', '==', userId)
        .get();
      const batch = db.batch();
      videosSnap.docs.forEach(v => batch.update(v.ref, { isPremiumUser: false }));
      await batch.commit();

      // Notificación in-app
      await db.collection('notifications').add({
        userId,
        type:    'premium_cancelled',
        title:   'Tu Plan Premium ha sido cancelado',
        message: 'Tu plan ha expirado. Puedes renovarlo cuando quieras.',
        read:    false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(\`✅ Premium desactivado para userId: \${userId}\`);
      break;
    }

    // ── Fallo de pago ─────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice    = event.data.object;
      const customerId = invoice.customer;

      const usersSnap = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();

      if (usersSnap.empty) break;

      const userId = usersSnap.docs[0].id;

      await db.collection('notifications').add({
        userId,
        type:    'payment_failed',
        title:   'Error en el pago de tu Plan Premium',
        message: 'No pudimos procesar tu pago. Actualiza tu método de pago.',
        read:    false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      break;
    }

    default:
      // Eventos no gestionados — ignorar silenciosamente
      break;
  }

  res.json({ received: true });
});
`;

  fs.mkdirSync(path.join(process.cwd(), 'functions'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'functions/stripe-payment-flow.js'), code);
  console.log('✅ functions/stripe-payment-flow.js generado');
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Configurando Stripe');
  console.log('════════════════════════════════════════');

  const product = await createPremiumProduct();
  const price   = await createInitialPrice(product.id);
  const webhook = await createWebhook();

  generateStripeService();
  generateStripeFunction();

  console.log(`
════════════════════════════════════════
  ✅ PASO 5 COMPLETADO
════════════════════════════════════════

En Stripe:
  • Producto: "Ximvid Premium" (${product.id})
  • Precio inicial: 9.99€/mes (${price.id})
  • Webhook: ${webhook?.id || 'ver dashboard Stripe'}

El admin puede cambiar el precio:
  1. Crear nuevo precio en dashboard.stripe.com
  2. Ir a Firestore → config/premium
  3. Actualizar:
     - stripePriceId: "price_XXXX" (nuevo Price ID)
     - monthlyPriceAmount: 1499 (precio en céntimos, ej: 14.99€)
     - monthlyLabel: "14.99€/mes"
  4. La app lo lee en tiempo real — sin redesplegar

Archivos generados:
  • src/services/stripe.js              (cliente React Native)
  • functions/stripe-payment-flow.js    (Cloud Functions)

⚠️  Guarda en .env:
  STRIPE_PRICE_ID_INITIAL=${price.id}
  ${webhook?.secret ? 'STRIPE_WEBHOOK_SECRET=' + webhook.secret : '# STRIPE_WEBHOOK_SECRET — ver webhook en Stripe Dashboard'}

Siguiente paso:
  node setup-sendgrid.js
════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
