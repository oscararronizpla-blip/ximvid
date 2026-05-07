/**
 * XIMVID — setup-firestore.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 2: Configura Firestore con todas las colecciones,
 * documentos de ejemplo (para validar la estructura) e índices
 * compuestos necesarios para las queries del feed y estadísticas.
 *
 * Ejecutar desde terminal (dentro de la carpeta ximvid):
 *   node ../setup-firestore.js
 *
 * Requiere:
 *   - firebase-admin instalado: npm install -g firebase-admin
 *   - GOOGLE_APPLICATION_CREDENTIALS apuntando al serviceAccount.json
 *     descargado de Firebase Console → Configuración → Cuentas de servicio
 * ─────────────────────────────────────────────────────────────────
 */

const admin  = require('firebase-admin');
const fs     = require('fs');
const path   = require('path');

// ─── Inicializar Firebase Admin ───────────────────────────────────
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(process.cwd(), 'serviceAccount.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`
❌ No se encontró el archivo de credenciales en:
   ${serviceAccountPath}

Para obtenerlo:
1. Ve a Firebase Console → tu proyecto → ⚙️ Configuración
2. Pestaña "Cuentas de servicio"
3. Haz clic en "Generar nueva clave privada"
4. Guarda el archivo como serviceAccount.json en la raíz del proyecto

Luego ejecuta de nuevo: node setup-firestore.js
`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const now = admin.firestore.Timestamp.now();

// ─── Helper: crear documento si no existe ─────────────────────────
async function ensureDoc(collection, docId, data) {
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(data);
    console.log(`  ✅ ${collection}/${docId} creado`);
  } else {
    console.log(`  ⏭  ${collection}/${docId} ya existe — omitido`);
  }
}

// ─── COLECCIÓN: config (panel de administración) ──────────────────
// Guarda valores configurables desde el panel admin sin tocar código
async function setupConfig() {
  console.log('\n📁 Colección: config');
  await ensureDoc('config', 'premium', {
    // El admin actualiza este precio desde el panel sin redesplegar
    monthlyPriceAmount: 999,          // Precio en céntimos (9.99€ por defecto)
    monthlyCurrency:    'eur',
    monthlyLabel:       '9.99€/mes',  // Texto que se muestra en la app
    stripePriceId:      '',           // El admin rellena el Price ID de Stripe
    features: [
      'Mayor visibilidad en el feed',
      'Badge Premium en perfil y videos',
      'Estadísticas avanzadas',
    ],
    updatedAt: now,
  });

  await ensureDoc('config', 'app', {
    appName:            'Ximvid',
    appUrl:             'https://ximvid.com',
    cdnUrl:             'https://cdn.ximvid.com',
    supportEmail:       'soporte@ximvid.com',
    minAppVersion:      '1.0.0',      // Force update si la app es más antigua
    maintenanceMode:    false,
    maxVideoSizeMB:     100,          // Límite de subida (antes de comprimir)
    maxVideoDurationSec: 90,          // Máximo 90 segundos por video
    updatedAt: now,
  });

  // Asset URLs — todos los iconos de redes almacenados en Firebase Storage
  // El código de la app lee estas URLs en lugar de tener assets en el bundle
  await ensureDoc('config', 'assetUrls', {
    // Logos de redes sociales (blancos, PNG transparente, 60x60px @3x)
    socialIcons: {
      instagram:  'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/instagram.png',
      tiktok:     'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/tiktok.png',
      youtube:    'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/youtube.png',
      facebook:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/facebook.png',
      linkedin:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/linkedin.png',
      pinterest:  'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/pinterest.png',
      twitch:     'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/twitch.png',
      spotify:    'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/spotify.png',
      soundcloud: 'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/soundcloud.png',
      behance:    'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/behance.png',
      vimeo:      'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/vimeo.png',
      discord:    'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/discord.png',
      patreon:    'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/patreon.png',
      twitter:    'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/twitter.png',
      snapchat:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/snapchat.png',
      reddit:     'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/reddit.png',
      tumblr:     'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/tumblr.png',
      whatsapp:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/whatsapp.png',
      telegram:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/telegram.png',
      email:      'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/email.png',
      phone:      'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/phone.png',
      web:        'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/web.png',
      shop:       'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/shop.png',
      etsy:       'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/etsy.png',
      amazon:     'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/amazon.png',
      wallapop:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/wallapop.png',
      calendly:   'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/calendly.png',
      paypal:     'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/paypal.png',
      bizum:      'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/bizum.png',
      share:      'https://storage.googleapis.com/ximvid.appspot.com/assets/icons/share.png',
    },
    // Iconos de categorías del feed
    categoryIcons: {
      physicalProducts: 'https://storage.googleapis.com/ximvid.appspot.com/assets/categories/products.png',
      services:         'https://storage.googleapis.com/ximvid.appspot.com/assets/categories/services.png',
      training:         'https://storage.googleapis.com/ximvid.appspot.com/assets/categories/training.png',
      localBusiness:    'https://storage.googleapis.com/ximvid.appspot.com/assets/categories/local.png',
      creatives:        'https://storage.googleapis.com/ximvid.appspot.com/assets/categories/creatives.png',
      personalBrand:    'https://storage.googleapis.com/ximvid.appspot.com/assets/categories/brand.png',
    },
    // Logo y splash de la app
    appLogo:       'https://storage.googleapis.com/ximvid.appspot.com/assets/brand/logo.png',
    appLogoWhite:  'https://storage.googleapis.com/ximvid.appspot.com/assets/brand/logo-white.png',
    splashImage:   'https://storage.googleapis.com/ximvid.appspot.com/assets/brand/splash.png',
    updatedAt: now,
  });
}

// ─── COLECCIÓN: users ─────────────────────────────────────────────
async function setupUsers() {
  console.log('\n📁 Colección: users');
  await ensureDoc('users', '_schema_reference', {
    // Documento de referencia (no es un usuario real, empieza con _)
    uid:                '_schema_reference',
    email:              '',
    phone:              '',
    name:               '',
    username:           '',           // Único. URL: ximvid.com/username
    profilePhoto:       '',           // URL en Storage: /profilePhotos/{uid}/photo.jpg
    bannerPhoto:        '',           // URL en Storage: /bannerPhotos/{uid}/banner.jpg
    category:           '',           // 'selling_product' | 'selling_service' | 'sharing_content' | 'discovering'
    shortDescription:   '',           // Máx 150 caracteres
    longDescription:    '',           // Opcional, para la landing interna
    language:           'en',         // Código ISO del idioma seleccionado
    additionalLanguages: [],          // Idiomas extra para el feed
    timezone:           'UTC',        // Para enviar el resumen del viernes en hora local
    actionButtonText:   '',
    actionButtonURL:    '',
    landingType:        'internal',   // 'internal' | 'external'
    externalLandingURL: '',
    // socialLinks: array de objetos ordenados por el usuario
    socialLinks: [
      // { network: 'instagram', url: 'https://instagram.com/...', followers: 1200, order: 0 }
    ],
    isPremium:          false,
    premiumSince:       null,
    premiumUntil:       null,
    stripeCustomerId:   '',
    // Notificaciones
    emailNotifications: true,
    whatsappNotifications: false,
    whatsappPhone:      '',
    // Moderación
    isBanned:           false,
    isVerified:         false,
    reportCount:        0,
    // Totales acumulados (para evitar queries costosas)
    totalVideos:        0,
    totalFollowers:     0,
    totalFollowing:     0,
    createdAt:          now,
    updatedAt:          now,
  });
}

// ─── COLECCIÓN: videos ────────────────────────────────────────────
async function setupVideos() {
  console.log('\n📁 Colección: videos');
  await ensureDoc('videos', '_schema_reference', {
    videoId:            '_schema_reference',
    userId:             '',
    username:           '',
    userLanguage:       'en',         // Idioma del creador (para filtrado del feed)
    userCategory:       '',           // Categoría del creador (para filtro de categorías)
    isPremiumUser:      false,        // Cache del isPremium del usuario (para el algoritmo)
    // URLs de media — servidas siempre desde Cloudflare CDN
    videoURL:           '',           // cdn.ximvid.com/videos/{userId}/{videoId}/video.mp4
    videoURLOriginal:   '',           // Storage original antes de comprimir (se borra tras comprimir)
    thumbnailURL:       '',           // cdn.ximvid.com/thumbnails/{userId}/{videoId}/thumb.jpg
    // HLS (HTTP Live Streaming) para reproducción sin buffering
    hlsURL:             '',           // cdn.ximvid.com/videos/{userId}/{videoId}/index.m3u8
    // Metadatos del video
    duration:           0,            // Segundos
    fileSizeMB:         0,            // Tamaño tras comprimir
    resolution:         '',           // '1080x1920', '720x1280', etc.
    intention:          '',           // 'selling_product' | 'selling_service' | 'sharing_content'
    actionButtonText:   '',
    actionButtonURL:    '',
    // Estadísticas — se incrementan con FieldValue.increment() para evitar race conditions
    views:              0,
    uniqueViews:        0,
    actionClicks:       0,
    shareClicks:        0,
    // Estado del video
    isActive:           true,
    isProcessing:       false,        // true mientras Firebase Function comprime
    processingError:    '',
    // Moderación
    reportCount:        0,
    isReported:         false,
    isSuspended:        false,
    createdAt:          now,
    updatedAt:          now,
  });
}

// ─── COLECCIÓN: socialClicks ──────────────────────────────────────
async function setupSocialClicks() {
  console.log('\n📁 Colección: socialClicks');
  await ensureDoc('socialClicks', '_schema_reference', {
    clickId:        '_schema_reference',
    videoId:        '',
    videoOwnerId:   '',
    network:        '',               // 'instagram', 'whatsapp', etc.
    clickedAt:      now,
    visitorId:      '',               // uid si logado, 'anonymous_XXX' si no
    visitorIp:      '',               // Hasheada para privacidad (nunca en texto plano)
  });
}

// ─── COLECCIÓN: actionClicks ──────────────────────────────────────
async function setupActionClicks() {
  console.log('\n📁 Colección: actionClicks');
  await ensureDoc('actionClicks', '_schema_reference', {
    clickId:        '_schema_reference',
    videoId:        '',
    videoOwnerId:   '',
    actionURL:      '',
    clickedAt:      now,
    visitorId:      '',
    visitorIp:      '',
  });
}

// ─── COLECCIÓN: followers ─────────────────────────────────────────
async function setupFollowers() {
  console.log('\n📁 Colección: followers');
  await ensureDoc('followers', '_schema_reference', {
    followId:       '_schema_reference',
    followerId:     '',               // Quien sigue
    followingId:    '',               // A quien se sigue
    createdAt:      now,
  });
}

// ─── COLECCIÓN: weeklyStats ───────────────────────────────────────
async function setupWeeklyStats() {
  console.log('\n📁 Colección: weeklyStats');
  await ensureDoc('weeklyStats', '_schema_reference', {
    statId:                 '_schema_reference',
    userId:                 '',
    weekStart:              now,
    weekEnd:                now,
    totalViews:             0,
    totalUniqueViews:       0,
    totalActionClicks:      0,
    totalSocialClicks:      0,
    totalLandingVisits:     0,
    totalShareClicks:       0,
    newFollowers:           0,
    clicksByNetwork:        {},       // { instagram: 12, whatsapp: 5, ... }
    topVideo: {
      videoId:        '',
      thumbnailURL:   '',
      views:          0,
      actionClicks:   0,
      conversionRate: 0,             // % de views que hicieron clic
    },
    // Comparación con semana anterior (calculado en la Function)
    vsLastWeek: {
      viewsChange:        0,         // % de cambio
      actionClicksChange: 0,
      followersChange:    0,
    },
    emailSent:          false,
    whatsappSent:       false,
    createdAt:          now,
  });
}

// ─── COLECCIÓN: notifications ─────────────────────────────────────
async function setupNotifications() {
  console.log('\n📁 Colección: notifications');
  await ensureDoc('notifications', '_schema_reference', {
    notificationId: '_schema_reference',
    userId:         '',
    type:           '',               // 'new_follower' | 'social_click' | 'action_click' | 'weekly_stats'
    title:          '',
    message:        '',
    metadata:       {},               // Datos extra según el tipo
    read:           false,
    createdAt:      now,
  });
}

// ─── COLECCIÓN: videoReports (moderación) ─────────────────────────
// Requerido por Apple App Store y Google Play para apps con contenido UGC
async function setupVideoReports() {
  console.log('\n📁 Colección: videoReports (moderación — requerida por tiendas)');
  await ensureDoc('videoReports', '_schema_reference', {
    reportId:       '_schema_reference',
    videoId:        '',
    reportedUserId: '',               // Dueño del video
    reporterUserId: '',               // Quien reporta
    reason:         '',               // 'spam' | 'inappropriate' | 'hate_speech' | 'nudity' | 'violence' | 'other'
    description:    '',               // Descripción opcional del reportante
    status:         'pending',        // 'pending' | 'reviewed' | 'resolved' | 'dismissed'
    reviewedBy:     '',               // uid del admin que lo revisó
    resolution:     '',               // Notas del admin
    createdAt:      now,
    reviewedAt:     null,
  });
}

// ─── COLECCIÓN: deletionRequests (GDPR/CCPA) ──────────────────────
// Requerido por GDPR (Europa), CCPA (California) y por Apple/Google
async function setupDeletionRequests() {
  console.log('\n📁 Colección: deletionRequests (GDPR/CCPA — requerida legalmente)');
  await ensureDoc('deletionRequests', '_schema_reference', {
    requestId:      '_schema_reference',
    userId:         '',
    email:          '',
    reason:         '',               // Razón opcional
    status:         'pending',        // 'pending' | 'processing' | 'completed'
    requestedAt:    now,
    completedAt:    null,
    // Checklist de qué se ha borrado
    deletedData: {
      firestoreUser:    false,
      firestoreVideos:  false,
      storageFiles:     false,
      authAccount:      false,
      stripeCustomer:   false,
    },
  });
}

// ─── COLECCIÓN: landingVisits (para estadísticas) ─────────────────
async function setupLandingVisits() {
  console.log('\n📁 Colección: landingVisits');
  await ensureDoc('landingVisits', '_schema_reference', {
    visitId:        '_schema_reference',
    profileUsername: '',
    profileUserId:  '',
    visitedAt:      now,
    visitorId:      '',
    source:         '',               // 'direct' | 'shared_link' | 'qr'
    platform:       '',               // 'ios' | 'android' | 'web'
  });
}

// ─── GENERAR firestore.indexes.json ──────────────────────────────
// Los índices compuestos son necesarios para las queries del feed
function generateIndexes() {
  const indexes = {
    indexes: [
      // Feed: filtrar por idioma + ordenar por fecha (Para Ti)
      {
        collectionGroup: 'videos',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userLanguage', order: 'ASCENDING' },
          { fieldPath: 'isActive',     order: 'ASCENDING' },
          { fieldPath: 'isPremiumUser',order: 'DESCENDING' }, // Premium primero
          { fieldPath: 'createdAt',    order: 'DESCENDING' },
        ],
      },
      // Feed: filtrar por categoría + idioma
      {
        collectionGroup: 'videos',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userCategory',  order: 'ASCENDING' },
          { fieldPath: 'userLanguage',  order: 'ASCENDING' },
          { fieldPath: 'isActive',      order: 'ASCENDING' },
          { fieldPath: 'createdAt',     order: 'DESCENDING' },
        ],
      },
      // Feed: Siguiendo (los videos de gente que sigo)
      {
        collectionGroup: 'videos',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId',     order: 'ASCENDING' },
          { fieldPath: 'isActive',   order: 'ASCENDING' },
          { fieldPath: 'createdAt',  order: 'DESCENDING' },
        ],
      },
      // Estadísticas: por usuario y período
      {
        collectionGroup: 'weeklyStats',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId',    order: 'ASCENDING' },
          { fieldPath: 'weekStart', order: 'DESCENDING' },
        ],
      },
      // Followers: quién sigue a quién
      {
        collectionGroup: 'followers',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'followerId',  order: 'ASCENDING' },
          { fieldPath: 'createdAt',   order: 'DESCENDING' },
        ],
      },
      {
        collectionGroup: 'followers',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'followingId', order: 'ASCENDING' },
          { fieldPath: 'createdAt',   order: 'DESCENDING' },
        ],
      },
      // Clicks por video y red
      {
        collectionGroup: 'socialClicks',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'videoOwnerId', order: 'ASCENDING' },
          { fieldPath: 'clickedAt',    order: 'DESCENDING' },
        ],
      },
      // Reportes pendientes para el admin
      {
        collectionGroup: 'videoReports',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'status',     order: 'ASCENDING' },
          { fieldPath: 'createdAt',  order: 'DESCENDING' },
        ],
      },
    ],
    fieldOverrides: [],
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'firestore.indexes.json'),
    JSON.stringify(indexes, null, 2)
  );
  console.log('\n✅ firestore.indexes.json generado');
}

// ─── GENERAR firestore.rules ──────────────────────────────────────
function generateRules() {
  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ────────────────────────────────────────────────────
    function isAuth() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isAuth() && request.auth.uid == uid;
    }
    function isAdmin() {
      return isAuth() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // ── config — solo lectura pública, escritura solo admin ────────
    match /config/{doc} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ── users ───────────────────────────────────────────────────────
    match /users/{userId} {
      // Lectura pública de campos no sensibles (para el feed y landing pages)
      allow read: if true;
      // Solo el propio usuario o admin puede escribir su documento
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin(); // El borrado real lo hace la Function de GDPR
    }

    // ── videos — lectura pública, escritura solo el dueño ──────────
    match /videos/{videoId} {
      allow read: if resource.data.isActive == true || isOwner(resource.data.userId) || isAdmin();
      allow create: if isAuth() && request.resource.data.userId == request.auth.uid;
      allow update: if isOwner(resource.data.userId) || isAdmin();
      allow delete: if isOwner(resource.data.userId) || isAdmin();
    }

    // ── socialClicks — escritura pública (anónimos incluidos), lectura solo dueño ──
    match /socialClicks/{clickId} {
      allow create: if true; // Cualquiera puede registrar un clic (visitante anónimo)
      allow read:   if isAdmin() ||
        (isAuth() && get(/databases/$(database)/documents/videos/$(resource.data.videoId)).data.userId == request.auth.uid);
      allow update, delete: if isAdmin();
    }

    // ── actionClicks — igual que socialClicks ──────────────────────
    match /actionClicks/{clickId} {
      allow create: if true;
      allow read:   if isAdmin() ||
        (isAuth() && get(/databases/$(database)/documents/videos/$(resource.data.videoId)).data.userId == request.auth.uid);
      allow update, delete: if isAdmin();
    }

    // ── followers ──────────────────────────────────────────────────
    match /followers/{followId} {
      allow read:   if true; // Público (para mostrar seguidores)
      allow create: if isOwner(request.resource.data.followerId);
      allow delete: if isOwner(resource.data.followerId) || isAdmin();
      allow update: if false; // Los follows no se editan, se crean/borran
    }

    // ── weeklyStats — solo el dueño o admin ───────────────────────
    match /weeklyStats/{statId} {
      allow read:  if isOwner(resource.data.userId) || isAdmin();
      allow write: if isAdmin(); // Solo Cloud Functions escriben aquí
    }

    // ── notifications ─────────────────────────────────────────────
    match /notifications/{notifId} {
      allow read:   if isOwner(resource.data.userId);
      allow update: if isOwner(resource.data.userId); // Para marcar como leída
      allow create, delete: if isAdmin();
    }

    // ── videoReports — cualquier usuario logado puede reportar ─────
    match /videoReports/{reportId} {
      allow create: if isAuth();
      allow read, update, delete: if isAdmin();
    }

    // ── deletionRequests — el propio usuario o admin ───────────────
    match /deletionRequests/{requestId} {
      allow create: if isOwner(request.resource.data.userId);
      allow read, update, delete: if isAdmin();
    }

    // ── landingVisits — escritura pública, lectura solo dueño ─────
    match /landingVisits/{visitId} {
      allow create: if true;
      allow read:   if isAdmin() ||
        (isAuth() && resource.data.profileUserId == request.auth.uid);
      allow update, delete: if isAdmin();
    }
  }
}
`;

  fs.writeFileSync(path.join(process.cwd(), 'firestore.rules'), rules);
  console.log('✅ firestore.rules generado');
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Configurando Firestore');
  console.log('════════════════════════════════════════');

  try {
    await setupConfig();
    await setupUsers();
    await setupVideos();
    await setupSocialClicks();
    await setupActionClicks();
    await setupFollowers();
    await setupWeeklyStats();
    await setupNotifications();
    await setupVideoReports();
    await setupDeletionRequests();
    await setupLandingVisits();

    generateIndexes();
    generateRules();

    console.log(`
════════════════════════════════════════
  ✅ PASO 2 COMPLETADO
════════════════════════════════════════

Colecciones creadas en Firestore:
  • config          (configuración global + precio Premium)
  • users           (perfiles de usuarios)
  • videos          (videos con sus métricas)
  • socialClicks    (clics en iconos de redes)
  • actionClicks    (clics en botón CTA)
  • followers       (relaciones de seguimiento)
  • weeklyStats     (resúmenes semanales)
  • notifications   (notificaciones in-app)
  • videoReports    (moderación — requerida por tiendas)
  • deletionRequests (GDPR/CCPA — requerida legalmente)
  • landingVisits   (visitas a perfiles)

Archivos generados:
  • firestore.rules       → Ejecutar: firebase deploy --only firestore:rules
  • firestore.indexes.json → Ejecutar: firebase deploy --only firestore:indexes

Siguiente paso:
  node setup-storage.js
════════════════════════════════════════
`);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
