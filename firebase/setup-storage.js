/**
 * XIMVID — setup-storage.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 3: Configura Firebase Storage con la estructura de carpetas,
 * las reglas de seguridad y las políticas de caché/CORS para que
 * Cloudflare CDN pueda servir los videos correctamente.
 *
 * Ejecutar desde terminal (dentro de la carpeta ximvid):
 *   node ../setup-storage.js
 * ─────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

// ─── ESTRUCTURA DE CARPETAS EN STORAGE ───────────────────────────
// Documentada aquí para referencia. Firebase Storage no tiene
// "carpetas reales" — son prefijos en los nombres de los archivos.

const storageStructure = `
Firebase Storage — Estructura de carpetas
==========================================

/assets/                          ← Assets estáticos de la app (NO de usuarios)
  /icons/                         ← Logos de redes sociales (PNG blanco, 60x60 @3x)
    instagram.png
    tiktok.png
    youtube.png
    ... (29 iconos en total)
  /categories/                    ← Iconos de categorías del feed
    products.png
    services.png
    training.png
    local.png
    creatives.png
    brand.png
  /brand/                         ← Logo y splash de la app
    logo.png
    logo-white.png
    splash.png

/profilePhotos/{userId}/          ← Fotos de perfil de usuarios
  photo.jpg                       ← JPG comprimido, máx 500KB, 400x400px

/bannerPhotos/{userId}/           ← Fotos de portada/banner
  banner.jpg                      ← JPG comprimido, máx 800KB, 1500x500px

/videos/{userId}/{videoId}/       ← Videos subidos por usuarios
  original.mp4                    ← Original recibido (se borra tras comprimir)
  video.mp4                       ← Video comprimido por Firebase Function
  index.m3u8                      ← Playlist HLS para streaming adaptativo
  segment_000.ts                  ← Segmentos HLS (generados por FFmpeg en Function)
  segment_001.ts
  ...

/thumbnails/{userId}/{videoId}/   ← Miniaturas de video
  thumb.jpg                       ← JPG 720x1280, extraído del frame 1s
  thumb_blur.jpg                  ← Versión borrosa para placeholder mientras carga

NOTAS DE OPTIMIZACIÓN:
- Videos se comprimen con FFmpeg a H.264 CRF 23, AAC 128kbps
- Resolución máxima: 1080p vertical (1080x1920)
- Los segmentos HLS permiten que el video empiece a reproducirse
  antes de que termine de cargar (igual que TikTok)
- Los thumbnails con blur se usan como placeholder mientras carga
  el thumbnail real — evita pantalla en negro
- Los originales se borran 24h después de comprimir para ahorrar espacio
`;

console.log(storageStructure);

// ─── GENERAR storage.rules ────────────────────────────────────────
function generateStorageRules() {
  const rules = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // ── Assets estáticos de la app — lectura pública, escritura solo admin ──
    match /assets/{allPaths=**} {
      allow read:  if true;
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // ── Fotos de perfil — lectura pública, escritura solo el dueño ──
    match /profilePhotos/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId
        // Solo JPG/PNG, máximo 2MB antes de que la Function lo comprima
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && request.resource.size < 2 * 1024 * 1024;
    }

    // ── Banners — lectura pública, escritura solo el dueño ─────────
    match /bannerPhotos/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.contentType.matches('image/(jpeg|png|webp)')
        && request.resource.size < 5 * 1024 * 1024;
    }

    // ── Videos — lectura pública, escritura solo el dueño ──────────
    match /videos/{userId}/{videoId}/{fileName} {
      allow read: if true; // Necesario para que Cloudflare CDN cachée los videos
      allow write: if request.auth != null && request.auth.uid == userId
        // Solo MP4, máximo 200MB (la Function comprime después)
        && request.resource.contentType == 'video/mp4'
        && request.resource.size < 200 * 1024 * 1024;
      // Las Firebase Functions pueden escribir sin restricción de tamaño
      // (usan el SDK admin que ignora estas reglas)
    }

    // ── Segmentos HLS — lectura pública, escritura solo Functions ──
    match /videos/{userId}/{videoId}/{segment} {
      allow read: if true;
      // Los .ts y .m3u8 los escribe solo la Firebase Function de compresión
      // No se pueden subir directamente desde el cliente
      allow write: if false;
    }

    // ── Thumbnails — lectura pública, escritura solo Functions ──────
    match /thumbnails/{userId}/{videoId}/{fileName} {
      allow read: if true;
      allow write: if false; // Solo la Function de compresión los genera
    }

    // ── Todo lo demás — denegado por defecto ───────────────────────
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
`;

  fs.writeFileSync(path.join(process.cwd(), 'storage.rules'), rules);
  console.log('✅ storage.rules generado');
}

// ─── GENERAR cors.json (para que Cloudflare pueda acceder) ────────
function generateCors() {
  const cors = [
    {
      origin: [
        'https://ximvid.com',
        'https://cdn.ximvid.com',
        'https://*.ximvid.com',
        // Expo en desarrollo
        'http://localhost:19006',
        'http://localhost:8081',
        'exp://*',
      ],
      method: ['GET', 'HEAD', 'OPTIONS'],
      responseHeader: [
        'Content-Type',
        'Content-Length',
        'Content-Range',
        'Accept-Ranges',
        'ETag',
        'Cache-Control',
      ],
      maxAgeSeconds: 3600,
    },
  ];

  fs.writeFileSync(
    path.join(process.cwd(), 'cors.json'),
    JSON.stringify(cors, null, 2)
  );
  console.log('✅ cors.json generado');
  console.log('   → Para aplicarlo: gsutil cors set cors.json gs://ximvid.appspot.com');
}

// ─── GENERAR script de subida de assets ──────────────────────────
// Este script sube todos los assets estáticos a Firebase Storage
function generateAssetUploadScript() {
  const script = `#!/usr/bin/env node
/**
 * upload-assets.js
 * Sube todos los assets estáticos de la app a Firebase Storage
 * Ejecutar UNA SOLA VEZ tras crear el proyecto en Firebase
 * 
 * Antes de ejecutar:
 * 1. Coloca los iconos en /local-assets/icons/ (PNG blanco, 60x60 @3x)
 * 2. Coloca los iconos de categorías en /local-assets/categories/
 * 3. Coloca el logo y splash en /local-assets/brand/
 * 
 * Ejecutar: node upload-assets.js
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccount.json')),
  storageBucket: 'ximvid.appspot.com',
});

const bucket = admin.storage().bucket();

const assets = [
  // Iconos de redes sociales
  { local: 'local-assets/icons/instagram.png',  remote: 'assets/icons/instagram.png' },
  { local: 'local-assets/icons/tiktok.png',     remote: 'assets/icons/tiktok.png' },
  { local: 'local-assets/icons/youtube.png',    remote: 'assets/icons/youtube.png' },
  { local: 'local-assets/icons/facebook.png',   remote: 'assets/icons/facebook.png' },
  { local: 'local-assets/icons/linkedin.png',   remote: 'assets/icons/linkedin.png' },
  { local: 'local-assets/icons/pinterest.png',  remote: 'assets/icons/pinterest.png' },
  { local: 'local-assets/icons/twitch.png',     remote: 'assets/icons/twitch.png' },
  { local: 'local-assets/icons/spotify.png',    remote: 'assets/icons/spotify.png' },
  { local: 'local-assets/icons/soundcloud.png', remote: 'assets/icons/soundcloud.png' },
  { local: 'local-assets/icons/behance.png',    remote: 'assets/icons/behance.png' },
  { local: 'local-assets/icons/vimeo.png',      remote: 'assets/icons/vimeo.png' },
  { local: 'local-assets/icons/discord.png',    remote: 'assets/icons/discord.png' },
  { local: 'local-assets/icons/patreon.png',    remote: 'assets/icons/patreon.png' },
  { local: 'local-assets/icons/twitter.png',    remote: 'assets/icons/twitter.png' },
  { local: 'local-assets/icons/snapchat.png',   remote: 'assets/icons/snapchat.png' },
  { local: 'local-assets/icons/reddit.png',     remote: 'assets/icons/reddit.png' },
  { local: 'local-assets/icons/tumblr.png',     remote: 'assets/icons/tumblr.png' },
  { local: 'local-assets/icons/whatsapp.png',   remote: 'assets/icons/whatsapp.png' },
  { local: 'local-assets/icons/telegram.png',   remote: 'assets/icons/telegram.png' },
  { local: 'local-assets/icons/email.png',      remote: 'assets/icons/email.png' },
  { local: 'local-assets/icons/phone.png',      remote: 'assets/icons/phone.png' },
  { local: 'local-assets/icons/web.png',        remote: 'assets/icons/web.png' },
  { local: 'local-assets/icons/shop.png',       remote: 'assets/icons/shop.png' },
  { local: 'local-assets/icons/etsy.png',       remote: 'assets/icons/etsy.png' },
  { local: 'local-assets/icons/amazon.png',     remote: 'assets/icons/amazon.png' },
  { local: 'local-assets/icons/wallapop.png',   remote: 'assets/icons/wallapop.png' },
  { local: 'local-assets/icons/calendly.png',   remote: 'assets/icons/calendly.png' },
  { local: 'local-assets/icons/paypal.png',     remote: 'assets/icons/paypal.png' },
  { local: 'local-assets/icons/bizum.png',      remote: 'assets/icons/bizum.png' },
  { local: 'local-assets/icons/share.png',      remote: 'assets/icons/share.png' },
  // Categorías
  { local: 'local-assets/categories/products.png',  remote: 'assets/categories/products.png' },
  { local: 'local-assets/categories/services.png',  remote: 'assets/categories/services.png' },
  { local: 'local-assets/categories/training.png',  remote: 'assets/categories/training.png' },
  { local: 'local-assets/categories/local.png',     remote: 'assets/categories/local.png' },
  { local: 'local-assets/categories/creatives.png', remote: 'assets/categories/creatives.png' },
  { local: 'local-assets/categories/brand.png',     remote: 'assets/categories/brand.png' },
  // Marca
  { local: 'local-assets/brand/logo.png',       remote: 'assets/brand/logo.png' },
  { local: 'local-assets/brand/logo-white.png', remote: 'assets/brand/logo-white.png' },
  { local: 'local-assets/brand/splash.png',     remote: 'assets/brand/splash.png' },
];

async function uploadAll() {
  for (const asset of assets) {
    const localPath = path.join(__dirname, asset.local);
    if (!fs.existsSync(localPath)) {
      console.log(\`⚠️  No encontrado: \${asset.local} — omitido\`);
      continue;
    }
    await bucket.upload(localPath, {
      destination: asset.remote,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1 año de caché en CDN
        contentType: 'image/png',
      },
    });
    console.log(\`✅ Subido: \${asset.remote}\`);
  }
  console.log('\\n✅ Todos los assets subidos a Firebase Storage');
}

uploadAll().catch(console.error);
`;

  fs.writeFileSync(path.join(process.cwd(), 'upload-assets.js'), script);
  console.log('✅ upload-assets.js generado');
}

// ─── MAIN ─────────────────────────────────────────────────────────
generateStorageRules();
generateCors();
generateAssetUploadScript();

console.log(`
════════════════════════════════════════
  ✅ PASO 3 COMPLETADO
════════════════════════════════════════

Archivos generados:
  • storage.rules     → firebase deploy --only storage
  • cors.json         → gsutil cors set cors.json gs://ximvid.appspot.com
  • upload-assets.js  → node upload-assets.js (tras tener los assets)

Estructura de Storage configurada:
  /assets/            → Iconos y brand (31 assets estáticos)
  /profilePhotos/     → Fotos de perfil (escritura solo dueño)
  /bannerPhotos/      → Banners (escritura solo dueño)
  /videos/            → Videos con HLS (lectura pública para CDN)
  /thumbnails/        → Miniaturas con blur placeholder

⚠️  IMPORTANTE sobre los assets:
  Antes de ejecutar upload-assets.js, crea la carpeta local-assets/
  con los iconos de todas las redes sociales en formato PNG blanco
  sobre fondo transparente, 60x60px a @3x (180x180px reales).
  
  Si no los tienes aún, puedes usar SVG descargados de simpleicons.org
  y convertirlos a PNG blanco con ImageMagick:
  convert icon.svg -resize 180x180 -colorspace Gray -negate icon.png

Siguiente paso:
  node setup-cloudflare.js
════════════════════════════════════════
`);
