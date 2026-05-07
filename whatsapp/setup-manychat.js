/**
 * XIMVID — setup-manychat.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 7: Configura ManyChat para notificaciones por WhatsApp.
 * Los flujos de WhatsApp son opcionales — el usuario los activa
 * desde Configuración si quiere recibirlos además del email.
 *
 * Ejecutar: node setup-manychat.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY;

if (!MANYCHAT_API_KEY) {
  console.error('❌ MANYCHAT_API_KEY no encontrada en .env');
  process.exit(1);
}

// ─── Helper: llamada a la API de ManyChat ─────────────────────────
async function mcApi(method, endpoint, body = null) {
  const res = await fetch(`https://api.manychat.com/fb${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(`ManyChat ${endpoint}: ${JSON.stringify(data)}`);
  }
  return data.data;
}

// ─── FLUJOS DE WHATSAPP A CONFIGURAR ─────────────────────────────
// ManyChat gestiona los flujos visualmente desde su dashboard.
// Este script documenta los flujos y crea los tags necesarios.
// Los flujos en sí se crean manualmente en app.manychat.com
// siguiendo las instrucciones del archivo manychat-flows-guide.md
// que se genera al final de este script.

async function setupTags() {
  console.log('\n🏷️  Creando tags en ManyChat...');

  const tags = [
    'ximvid_user',          // Tag base para todos los usuarios de Ximvid
    'ximvid_whatsapp_on',   // Usuarios con notificaciones WhatsApp activadas
    'ximvid_premium',       // Usuarios Premium
    'ximvid_creator',       // Usuarios que han subido al menos 1 video
  ];

  for (const tag of tags) {
    try {
      await mcApi('POST', '/tag/createTag', { name: tag });
      console.log(`  ✅ Tag creado: ${tag}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log(`  ⏭  Tag ya existe: ${tag}`);
      } else {
        console.warn(`  ⚠️  Tag ${tag}: ${err.message}`);
      }
    }
  }
}

// ─── GENERAR manychat-flows-guide.md ──────────────────────────────
// Guía paso a paso para crear los flujos en ManyChat dashboard
function generateFlowsGuide() {
  const guide = `# XIMVID — Guía de flujos de ManyChat
## Cómo crear los flujos de WhatsApp en app.manychat.com

---

## REQUISITOS PREVIOS

1. Cuenta ManyChat conectada a WhatsApp Business API
2. Número de WhatsApp Business verificado
3. API Key de ManyChat en el archivo .env

---

## FLUJO A — Bienvenida por WhatsApp

**Trigger:** El usuario activa las notificaciones WhatsApp en Ximvid
(Firebase Function llama a la API de ManyChat al guardar el número)

**Cómo crearlo en ManyChat:**
1. New Flow → "Ximvid - Bienvenida WhatsApp"
2. Trigger: API Trigger (el flujo lo activa Firebase, no ManyChat)
3. Primer mensaje:
   \`\`\`
   ¡Hola {{first name}}! 👋

   Ya tienes activadas las notificaciones de Ximvid por WhatsApp.
   
   Te avisaré cuando:
   ✦ Alguien pulse tus botones de redes
   ✦ Alguien se interese en lo que ofreces
   ✦ Tengas un nuevo seguidor
   ✦ El resumen de tu semana esté listo (viernes)
   
   Para desactivar, ve a Ximvid → Configuración → Notificaciones
   \`\`\`
4. Guardar el Flow ID — lo necesitas en .env como MANYCHAT_FLOW_WELCOME

---

## FLUJO B — Alguien pulsó tu red social

**Trigger:** Firebase Function llama a ManyChat API (evento en tiempo real)

**Cómo crearlo:**
1. New Flow → "Ximvid - Clic en red social"
2. Trigger: API Trigger
3. Mensaje:
   \`\`\`
   👀 Alguien visitó tu {{network}} desde tu video en Ximvid
   
   Red: {{network_label}}
   Hora: {{clicked_at}}
   
   Ver estadísticas → app.ximvid.com/{{username}}
   \`\`\`
4. Guardar como MANYCHAT_FLOW_SOCIAL_CLICK

---

## FLUJO C — Nuevo seguidor

**Trigger:** Firebase Function

**Mensaje:**
\`\`\`
🎉 ¡{{follower_name}} te sigue ahora en Ximvid!

Total de seguidores: {{total_followers}}

Ver su perfil → app.ximvid.com/{{follower_username}}
\`\`\`

Guardar como MANYCHAT_FLOW_NEW_FOLLOWER

---

## FLUJO D — Alguien pulsó tu botón de acción

**Trigger:** Firebase Function

**Mensaje:**
\`\`\`
🔥 ¡Alguien está interesado en lo que ofreces!

Pulsaron tu botón "{{action_button_text}}"
Clics hoy: {{total_clicks_today}}

Ver estadísticas → ximvid://stats
\`\`\`

Guardar como MANYCHAT_FLOW_ACTION_CLICK

---

## FLUJO E — Resumen del viernes

**Trigger:** Firebase Function (programada cada viernes 18:00)

**Mensaje:**
\`\`\`
📊 Tu semana en Ximvid

👁️ {{total_views}} visualizaciones
🔥 {{total_action_clicks}} clics en tu botón
📱 {{total_social_clicks}} clics en tus redes
👥 {{new_followers}} nuevos seguidores

Ver resumen completo → ximvid://stats
\`\`\`

Guardar como MANYCHAT_FLOW_WEEKLY_STATS

---

## CONFIGURAR LOS FLOW IDs EN .env

Una vez creados los flujos, añade sus IDs al archivo .env:

\`\`\`
MANYCHAT_FLOW_WELCOME=
MANYCHAT_FLOW_SOCIAL_CLICK=
MANYCHAT_FLOW_ACTION_CLICK=
MANYCHAT_FLOW_NEW_FOLLOWER=
MANYCHAT_FLOW_WEEKLY_STATS=
\`\`\`

Los IDs los encuentras en cada flujo: Settings → API Setup → Flow ID

---

## IMPORTANTE — Política de WhatsApp Business

WhatsApp Business API tiene restricciones sobre mensajes iniciados por la empresa:
- Solo se pueden enviar mensajes de plantilla aprobados (HSM)
- Las plantillas deben ser aprobadas por Meta antes de usarlas
- El proceso de aprobación tarda 1-3 días hábiles

ManyChat gestiona esto automáticamente cuando creas los flujos
con el tipo "Business Initiated Message".

Para cada flujo, ManyChat te pedirá que envíes la plantilla a revisión.
Hazlo tan pronto como crees el flujo.
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'manychat-flows-guide.md'),
    guide
  );
  console.log('\n✅ manychat-flows-guide.md generado');
}

// ─── GENERAR functions/manychat-triggers.js ───────────────────────
function generateManyChhatFunctions() {
  const code = `/**
 * XIMVID — functions/manychat-triggers.js
 * ─────────────────────────────────────────────────────────────────
 * Cloud Functions que llaman a la API de ManyChat para enviar
 * notificaciones por WhatsApp a los usuarios que lo tienen activado.
 *
 * Se ejecutan DESPUÉS de que los triggers de SendGrid ya han actuado
 * — son complementarios, nunca duplicados.
 * Importado en functions/index.js
 * ─────────────────────────────────────────────────────────────────
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

const db = admin.firestore();

const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY;
const FLOW_IDS = {
  welcome:      process.env.MANYCHAT_FLOW_WELCOME,
  socialClick:  process.env.MANYCHAT_FLOW_SOCIAL_CLICK,
  actionClick:  process.env.MANYCHAT_FLOW_ACTION_CLICK,
  newFollower:  process.env.MANYCHAT_FLOW_NEW_FOLLOWER,
  weeklyStats:  process.env.MANYCHAT_FLOW_WEEKLY_STATS,
};

// ─── Helper: enviar mensaje vía ManyChat API ─────────────────────
async function sendWhatsApp(phoneNumber, flowId, customFields = {}) {
  if (!MANYCHAT_API_KEY || !flowId) {
    console.warn('ManyChat: API key o Flow ID no configurado — saltando');
    return;
  }

  // Normalizar número de teléfono (quitar +, espacios, guiones)
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

  const res = await fetch('https://api.manychat.com/fb/sending/sendFlow', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${MANYCHAT_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriber_id:  null,         // ManyChat buscará por teléfono
      phone:          cleanPhone,
      flow_ns:        flowId,
      custom_fields:  customFields,
    }),
  });

  const data = await res.json();

  if (data.status !== 'success') {
    // No lanzar error — si WhatsApp falla, el email ya se envió
    console.warn(\`ManyChat sendFlow falló para \${cleanPhone}:\`, JSON.stringify(data));
  }
}

// ─── Helper: verificar si el usuario tiene WhatsApp activado ───
async function getUserWhatsApp(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  const user = userDoc.data();
  if (!user.whatsappNotifications || !user.whatsappPhone) return null;
  return { phone: user.whatsappPhone, name: user.name, username: user.username };
}

// ══════════════════════════════════════════════════════════════════
// ACTIVAR NOTIFICACIONES WHATSAPP
// Callable desde la app cuando el usuario activa WhatsApp en Config.
// ══════════════════════════════════════════════════════════════════
exports.activateWhatsAppNotifications = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const { phoneNumber } = data;
  const userId = context.auth.uid;

  if (!phoneNumber) {
    throw new functions.https.HttpsError('invalid-argument', 'Número de teléfono requerido');
  }

  // Guardar el número en Firestore
  await db.collection('users').doc(userId).update({
    whatsappNotifications: true,
    whatsappPhone:         phoneNumber,
    updatedAt:             admin.firestore.FieldValue.serverTimestamp(),
  });

  // Enviar mensaje de bienvenida por WhatsApp
  const userDoc = await db.collection('users').doc(userId).get();
  const user    = userDoc.data();

  await sendWhatsApp(phoneNumber, FLOW_IDS.welcome, {
    first_name: user.name || 'Creador',
    username:   user.username,
  });

  return { success: true };
});

// ══════════════════════════════════════════════════════════════════
// DESACTIVAR NOTIFICACIONES WHATSAPP
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
// NOTIFICACIÓN: Clic en red social → WhatsApp
// Se llama DESDE sendgrid-triggers.js → onSocialClick
// para no duplicar listeners de Firestore
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

// ══════════════════════════════════════════════════════════════════
// NOTIFICACIÓN: Clic en botón de acción → WhatsApp
// ══════════════════════════════════════════════════════════════════
exports.notifyActionClickWhatsApp = async (videoOwnerId, actionButtonText, totalClicksToday) => {
  const wa = await getUserWhatsApp(videoOwnerId);
  if (!wa) return;

  await sendWhatsApp(wa.phone, FLOW_IDS.actionClick, {
    action_button_text: actionButtonText,
    total_clicks_today: String(totalClicksToday),
  });
};

// ══════════════════════════════════════════════════════════════════
// NOTIFICACIÓN: Nuevo seguidor → WhatsApp
// ══════════════════════════════════════════════════════════════════
exports.notifyNewFollowerWhatsApp = async (followingId, followerName, followerUsername, totalFollowers) => {
  const wa = await getUserWhatsApp(followingId);
  if (!wa) return;

  await sendWhatsApp(wa.phone, FLOW_IDS.newFollower, {
    follower_name:     followerName,
    follower_username: followerUsername,
    total_followers:   String(totalFollowers),
  });
};

// ══════════════════════════════════════════════════════════════════
// NOTIFICACIÓN: Resumen semanal → WhatsApp
// Llamado desde weeklyStatsJob en sendgrid-triggers.js
// ══════════════════════════════════════════════════════════════════
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
`;

  fs.mkdirSync(path.join(process.cwd(), 'functions'), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), 'functions/manychat-triggers.js'),
    code
  );
  console.log('✅ functions/manychat-triggers.js generado');
}

// ─── GENERAR functions/index.js (punto de entrada de Functions) ───
// Consolida TODAS las Cloud Functions en un solo archivo de entrada
function generateFunctionsIndex() {
  const code = `/**
 * XIMVID — functions/index.js
 * ─────────────────────────────────────────────────────────────────
 * Punto de entrada de todas las Firebase Cloud Functions.
 * Importa y re-exporta cada módulo de forma que Firebase
 * las despliegue todas con: firebase deploy --only functions
 * ─────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin UNA SOLA VEZ aquí
// Todos los módulos comparten esta instancia
admin.initializeApp();

// ── Configurar rawBody para el webhook de Stripe ──────────────────
// Stripe necesita el body crudo (no parseado) para verificar la firma
const express    = require('express');
const bodyParser = require('body-parser');

// ── Módulos de Cloud Functions ────────────────────────────────────
const sendgridTriggers  = require('./sendgrid-triggers');
const manychatTriggers  = require('./manychat-triggers');
const stripeFlow        = require('./stripe-payment-flow');
const renderFunctions   = require('./render-functions');
const gdprFunctions     = require('./gdpr-functions');
const videoProcessing   = require('./video-processing');
const adminFunctions    = require('./admin-functions');

// ── Re-exportar todos los triggers ───────────────────────────────

// SendGrid — emails automáticos
exports.onUserCreated         = sendgridTriggers.onUserCreated;
exports.onProfileComplete     = sendgridTriggers.onProfileComplete;
exports.onActionClick         = sendgridTriggers.onActionClick;
exports.onSocialClick         = sendgridTriggers.onSocialClick;
exports.onNewFollower         = sendgridTriggers.onNewFollower;
exports.weeklyStatsJob        = sendgridTriggers.weeklyStatsJob;
exports.incompleteProfileCheck = sendgridTriggers.incompleteProfileCheck;
exports.onFirstVideo          = sendgridTriggers.onFirstVideo;

// ManyChat — notificaciones WhatsApp
exports.activateWhatsAppNotifications   = manychatTriggers.activateWhatsAppNotifications;
exports.deactivateWhatsAppNotifications = manychatTriggers.deactivateWhatsAppNotifications;

// Stripe — pagos y suscripciones
exports.createStripePaymentIntent  = stripeFlow.createStripePaymentIntent;
exports.cancelStripeSubscription   = stripeFlow.cancelStripeSubscription;
exports.getStripeBillingPortal     = stripeFlow.getStripeBillingPortal;
exports.stripeWebhook              = stripeFlow.stripeWebhook;

// Renderizado de páginas web (landing de creadores y videos)
exports.renderCreatorPage = renderFunctions.renderCreatorPage;
exports.renderVideoPage   = renderFunctions.renderVideoPage;

// GDPR / CCPA — eliminación de datos
exports.requestAccountDeletion = gdprFunctions.requestAccountDeletion;
exports.processDeleteQueue     = gdprFunctions.processDeleteQueue;

// Procesamiento de videos (compresión con FFmpeg)
exports.onVideoUploaded    = videoProcessing.onVideoUploaded;
exports.cleanupOldOriginals = videoProcessing.cleanupOldOriginals;

// Panel de administración
exports.getAdminStats      = adminFunctions.getAdminStats;
exports.banUser            = adminFunctions.banUser;
exports.suspendVideo       = adminFunctions.suspendVideo;
exports.updatePremiumPrice = adminFunctions.updatePremiumPrice;
`;

  fs.writeFileSync(path.join(process.cwd(), 'functions/index.js'), code);
  console.log('✅ functions/index.js generado (punto de entrada completo)');
}

// ─── GENERAR functions/package.json ──────────────────────────────
function generateFunctionsPackage() {
  const pkg = {
    name: 'ximvid-functions',
    description: 'Firebase Cloud Functions para Ximvid',
    scripts: {
      serve:  'firebase emulators:start --only functions',
      shell:  'firebase functions:shell',
      deploy: 'firebase deploy --only functions',
      logs:   'firebase functions:log',
    },
    engines: { node: '18' },
    main: 'index.js',
    dependencies: {
      'firebase-admin':   '^11.0.0',
      'firebase-functions': '^4.0.0',
      '@sendgrid/mail':   '^7.7.0',
      'stripe':           '^13.0.0',
      'mustache':         '^4.2.0',   // Para renderizar los templates HTML de landing pages
      'node-fetch':       '^2.7.0',
      'dotenv':           '^16.0.0',
    },
    devDependencies: {
      'firebase-functions-test': '^3.0.0',
    },
    private: true,
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'functions/package.json'),
    JSON.stringify(pkg, null, 2)
  );
  console.log('✅ functions/package.json generado');
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Configurando ManyChat');
  console.log('════════════════════════════════════════');

  try {
    await setupTags();
  } catch (err) {
    console.warn('⚠️  Tags de ManyChat:', err.message);
    console.log('   Continúa con el resto — los tags se pueden crear manualmente.');
  }

  generateFlowsGuide();
  generateManyChhatFunctions();
  generateFunctionsIndex();
  generateFunctionsPackage();

  console.log(`
════════════════════════════════════════
  ✅ PASO 7 COMPLETADO
════════════════════════════════════════

ManyChat configurado:
  Tags creados: ximvid_user, ximvid_whatsapp_on,
                ximvid_premium, ximvid_creator

Archivos generados:
  • manychat-flows-guide.md          (instrucciones para crear flujos)
  • functions/manychat-triggers.js   (Cloud Functions de WhatsApp)
  • functions/index.js               (punto de entrada de Functions)
  • functions/package.json           (dependencias de Functions)

⚠️  ACCIÓN MANUAL NECESARIA:
  Crear los 5 flujos en app.manychat.com siguiendo
  el archivo manychat-flows-guide.md, luego añadir
  los Flow IDs al archivo .env:
  
  MANYCHAT_FLOW_WELCOME=
  MANYCHAT_FLOW_SOCIAL_CLICK=
  MANYCHAT_FLOW_ACTION_CLICK=
  MANYCHAT_FLOW_NEW_FOLLOWER=
  MANYCHAT_FLOW_WEEKLY_STATS=

Siguiente paso:
  node setup-i18n.js
════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
