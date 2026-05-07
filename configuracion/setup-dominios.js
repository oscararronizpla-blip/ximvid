/**
 * XIMVID — setup-dominios.js
 * ─────────────────────────────────────────────────────────────────
 * Actualización de arquitectura de dominios:
 *
 *   ximvid.com          → Landing de marketing (Vercel/Netlify)
 *   app.ximvid.com      → URLs de creadores + contenido (Firebase Hosting)
 *   cdn.ximvid.com      → Videos y assets (Cloudflare → Firebase Storage)
 *   api.ximvid.com      → Firebase Functions
 *
 * Este archivo actualiza firebase.json y los DNS de Cloudflare
 * para reflejar esta separación profesional de dominios.
 *
 * Ejecutar: node setup-dominios.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const ZONE_ID   = process.env.CLOUDFLARE_ZONE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function cfApi(method, endpoint, body = null) {
  const res  = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  return data.result;
}

// ─── PASO A — Actualizar DNS de Cloudflare ────────────────────────
async function updateDNS() {
  console.log('\n📡 Actualizando registros DNS...');

  const records = [
    // ximvid.com → Vercel (landing de marketing)
    // Vercel proporciona sus IPs al añadir el dominio en su dashboard
    {
      type: 'A', name: '@',
      content: '76.76.21.21',   // IP de Vercel (actualizar con la real de Vercel)
      proxied: true,
      comment: 'ximvid.com → Vercel (landing marketing)',
    },
    // www.ximvid.com → redirige a ximvid.com
    {
      type: 'CNAME', name: 'www',
      content: 'cname.vercel-dns.com',
      proxied: true,
      comment: 'www → Vercel',
    },
    // app.ximvid.com → Firebase Hosting (creadores, videos, privacidad)
    {
      type: 'A', name: 'app',
      content: '151.101.1.195',
      proxied: true,
      comment: 'app.ximvid.com → Firebase Hosting',
    },
    {
      type: 'A', name: 'app',
      content: '151.101.65.195',
      proxied: true,
      comment: 'app.ximvid.com → Firebase Hosting (redundancia)',
    },
    // cdn.ximvid.com → Firebase Storage via Cloudflare CDN
    {
      type: 'CNAME', name: 'cdn',
      content: 'storage.googleapis.com',
      proxied: true,
      comment: 'cdn.ximvid.com → Videos y assets',
    },
    // api.ximvid.com → Firebase Functions
    {
      type: 'CNAME', name: 'api',
      content: 'us-central1-ximvid.cloudfunctions.net',
      proxied: true,
      comment: 'api.ximvid.com → Firebase Functions',
    },
    // SPF SendGrid
    {
      type: 'TXT', name: '@',
      content: 'v=spf1 include:sendgrid.net ~all',
      proxied: false,
      comment: 'SPF SendGrid',
    },
  ];

  for (const record of records) {
    try {
      await cfApi('POST', `/zones/${ZONE_ID}/dns_records`, record);
      console.log(`  ✅ ${record.type} ${record.name} → ${record.content}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭  ${record.type} ${record.name} ya existe`);
      } else {
        console.warn(`  ⚠️  ${record.type} ${record.name}: ${err.message}`);
      }
    }
  }
}

// ─── PASO B — Actualizar firebase.json ───────────────────────────
// Firebase Hosting ahora solo gestiona app.ximvid.com
function updateFirebaseJson() {
  const config = {
    hosting: [
      // ── app.ximvid.com — URLs de creadores y contenido ──────────
      {
        target: 'app',
        public: 'public',
        cleanUrls: true,
        trailingSlash: false,
        headers: [
          {
            source: '**',
            headers: [
              { key: 'X-Content-Type-Options',  value: 'nosniff' },
              { key: 'X-Frame-Options',          value: 'SAMEORIGIN' },
              { key: 'X-XSS-Protection',         value: '1; mode=block' },
              { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
              // HSTS — fuerza HTTPS durante 1 año
              { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
            ],
          },
          {
            source: '/static/**',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
            ],
          },
        ],
        rewrites: [
          // /video/{videoId} → Firebase Function renderVideoPage
          { source: '/video/:videoId', function: 'renderVideoPage' },
          // /privacy y /terms → páginas estáticas
          { source: '/privacy', destination: '/privacy.html' },
          { source: '/terms',   destination: '/terms.html' },
          // /{username} → Firebase Function renderCreatorPage
          // ⚠️ Debe ir AL FINAL — intercepta cualquier path de 1 segmento
          { source: '/:username', function: 'renderCreatorPage' },
          // Fallback
          { source: '**', destination: '/index.html' },
        ],
        redirects: [
          // Redirigir el dominio antiguo ximvid.com/username → app.ximvid.com/username
          // si alguien tiene links viejos guardados
          {
            source:      'https://ximvid.com/:username',
            destination: 'https://app.ximvid.com/:username',
            type: 301,
          },
        ],
      },
    ],
    // Asignar targets de hosting
    targets: {
      app: {
        hosting: {
          site: 'ximvid-app',   // Nombre del site en Firebase Console
        },
      },
    },
    functions: {
      source:  'functions',
      runtime: 'nodejs18',
    },
    firestore: {
      rules:   'firestore.rules',
      indexes: 'firestore.indexes.json',
    },
    storage: {
      rules: 'storage.rules',
    },
    emulators: {
      auth:      { port: 9099 },
      functions: { port: 5001 },
      firestore: { port: 8080 },
      hosting:   { port: 5000 },
      storage:   { port: 9199 },
      ui:        { enabled: true, port: 4000 },
    },
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'firebase.json'),
    JSON.stringify(config, null, 2)
  );
  console.log('\n✅ firebase.json actualizado (app.ximvid.com)');
}

// ─── PASO C — Actualizar .env.example con los dominios correctos ──
function updateEnvExample() {
  const envContent = `# ════════════════════════════════════════
# XIMVID — Variables de entorno
# Copiar como .env y rellenar valores reales
# NUNCA subir .env a git
# ════════════════════════════════════════

# Dominios
EXPO_PUBLIC_APP_URL=https://app.ximvid.com
EXPO_PUBLIC_MARKETING_URL=https://ximvid.com
EXPO_PUBLIC_CDN_URL=https://cdn.ximvid.com
EXPO_PUBLIC_API_URL=https://api.ximvid.com
EXPO_PUBLIC_APP_NAME=Ximvid

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=ximvid.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=ximvid
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=ximvid.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# Precio gestionado desde panel admin en Firestore → config/premium

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@ximvid.com
SENDGRID_FROM_NAME=Ximvid

# ManyChat
MANYCHAT_API_KEY=

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_ACCOUNT_ID=
`;

  fs.writeFileSync(path.join(process.cwd(), '.env.example'), envContent);
  console.log('✅ .env.example actualizado con dominios correctos');
}

// ─── PASO D — Actualizar constantes en src/constants ─────────────
function updateConstants() {
  const colorsContent = `/**
 * XIMVID — src/constants/colors.js
 * Paleta de colores completa de la app
 */
export const colors = {
  primary:     '#ff4d6d',
  primaryGlow: 'rgba(255, 77, 109, 0.4)',
  black:       '#000000',
  bgDark:      '#0a0a0a',
  bgCard:      '#161616',
  border:      '#2a2a2a',
  white:       '#ffffff',
  textMain:    '#ffffff',
  textMuted:   '#888888',
  textLight:   'rgba(255,255,255,0.7)',
  success:     '#22c55e',
  warning:     '#f59e0b',
  error:       '#ef4444',
  navBg:       'rgba(0,0,0,0.6)',
  overlay:     'rgba(0,0,0,0.4)',
};
`;

  const domainsContent = `/**
 * XIMVID — src/constants/domains.js
 * URLs base de todos los servicios — únicas fuente de verdad
 * Cambiar aquí afecta a toda la app automáticamente
 */
export const domains = {
  // URL base para perfiles de creadores y contenido
  app:       process.env.EXPO_PUBLIC_APP_URL       || 'https://app.ximvid.com',
  // Landing de marketing (para compartir la app con amigos)
  marketing: process.env.EXPO_PUBLIC_MARKETING_URL || 'https://ximvid.com',
  // CDN de videos, thumbnails y assets
  cdn:       process.env.EXPO_PUBLIC_CDN_URL       || 'https://cdn.ximvid.com',
  // Firebase Functions
  api:       process.env.EXPO_PUBLIC_API_URL        || 'https://api.ximvid.com',
};

// URLs de perfiles de creadores
export const creatorUrl  = (username) => \`\${domains.app}/\${username}\`;
// URLs de videos individuales
export const videoUrl    = (videoId)  => \`\${domains.app}/video/\${videoId}\`;
// URL de video en CDN
export const videoCdnUrl = (userId, videoId) =>
  \`\${domains.cdn}/videos/\${userId}/\${videoId}/video.mp4\`;
// URL de playlist HLS (para streaming sin buffering)
export const hlsUrl      = (userId, videoId) =>
  \`\${domains.cdn}/videos/\${userId}/\${videoId}/index.m3u8\`;
// URL de thumbnail
export const thumbUrl    = (userId, videoId) =>
  \`\${domains.cdn}/thumbnails/\${userId}/\${videoId}/thumb.jpg\`;
// URL de thumbnail blur (placeholder mientras carga)
export const thumbBlurUrl = (userId, videoId) =>
  \`\${domains.cdn}/thumbnails/\${userId}/\${videoId}/thumb_blur.jpg\`;
`;

  const socialNetworksContent = `/**
 * XIMVID — src/constants/socialNetworks.js
 * Lista completa de las 29 redes/contactos/enlaces disponibles.
 * Los iconos se cargan desde Firebase Storage (no están en el bundle).
 * El orden aquí define el orden por defecto — el usuario puede reordenar.
 */

// URLs base de los iconos en Firebase Storage CDN
const ICON_BASE = process.env.EXPO_PUBLIC_CDN_URL
  ? \`\${process.env.EXPO_PUBLIC_CDN_URL}/assets/icons\`
  : 'https://cdn.ximvid.com/assets/icons';

export const SOCIAL_NETWORKS = [
  // ── Redes sociales ─────────────────────────────────────────────
  { id: 'instagram',  label: 'Instagram',  group: 'social',   iconUrl: \`\${ICON_BASE}/instagram.png\`,  placeholder: 'https://instagram.com/tu_usuario' },
  { id: 'tiktok',     label: 'TikTok',     group: 'social',   iconUrl: \`\${ICON_BASE}/tiktok.png\`,     placeholder: 'https://tiktok.com/@tu_usuario' },
  { id: 'youtube',    label: 'YouTube',    group: 'social',   iconUrl: \`\${ICON_BASE}/youtube.png\`,    placeholder: 'https://youtube.com/@tu_canal' },
  { id: 'facebook',   label: 'Facebook',   group: 'social',   iconUrl: \`\${ICON_BASE}/facebook.png\`,   placeholder: 'https://facebook.com/tu_pagina' },
  { id: 'linkedin',   label: 'LinkedIn',   group: 'social',   iconUrl: \`\${ICON_BASE}/linkedin.png\`,   placeholder: 'https://linkedin.com/in/tu_perfil' },
  { id: 'pinterest',  label: 'Pinterest',  group: 'social',   iconUrl: \`\${ICON_BASE}/pinterest.png\`,  placeholder: 'https://pinterest.com/tu_usuario' },
  { id: 'twitch',     label: 'Twitch',     group: 'social',   iconUrl: \`\${ICON_BASE}/twitch.png\`,     placeholder: 'https://twitch.tv/tu_canal' },
  { id: 'spotify',    label: 'Spotify',    group: 'social',   iconUrl: \`\${ICON_BASE}/spotify.png\`,    placeholder: 'https://open.spotify.com/artist/...' },
  { id: 'soundcloud', label: 'SoundCloud', group: 'social',   iconUrl: \`\${ICON_BASE}/soundcloud.png\`, placeholder: 'https://soundcloud.com/tu_usuario' },
  { id: 'behance',    label: 'Behance',    group: 'social',   iconUrl: \`\${ICON_BASE}/behance.png\`,    placeholder: 'https://behance.net/tu_usuario' },
  { id: 'vimeo',      label: 'Vimeo',      group: 'social',   iconUrl: \`\${ICON_BASE}/vimeo.png\`,      placeholder: 'https://vimeo.com/tu_usuario' },
  { id: 'discord',    label: 'Discord',    group: 'social',   iconUrl: \`\${ICON_BASE}/discord.png\`,    placeholder: 'https://discord.gg/tu_servidor' },
  { id: 'patreon',    label: 'Patreon',    group: 'social',   iconUrl: \`\${ICON_BASE}/patreon.png\`,    placeholder: 'https://patreon.com/tu_usuario' },
  { id: 'twitter',    label: 'X / Twitter',group: 'social',   iconUrl: \`\${ICON_BASE}/twitter.png\`,    placeholder: 'https://x.com/tu_usuario' },
  { id: 'snapchat',   label: 'Snapchat',   group: 'social',   iconUrl: \`\${ICON_BASE}/snapchat.png\`,   placeholder: 'https://snapchat.com/add/tu_usuario' },
  { id: 'reddit',     label: 'Reddit',     group: 'social',   iconUrl: \`\${ICON_BASE}/reddit.png\`,     placeholder: 'https://reddit.com/u/tu_usuario' },
  { id: 'tumblr',     label: 'Tumblr',     group: 'social',   iconUrl: \`\${ICON_BASE}/tumblr.png\`,     placeholder: 'https://tu_usuario.tumblr.com' },
  // ── Contacto directo ───────────────────────────────────────────
  { id: 'whatsapp',   label: 'WhatsApp',   group: 'contact',  iconUrl: \`\${ICON_BASE}/whatsapp.png\`,   placeholder: 'https://wa.me/34600000000' },
  { id: 'telegram',   label: 'Telegram',   group: 'contact',  iconUrl: \`\${ICON_BASE}/telegram.png\`,   placeholder: 'https://t.me/tu_usuario' },
  { id: 'email',      label: 'Email',      group: 'contact',  iconUrl: \`\${ICON_BASE}/email.png\`,      placeholder: 'mailto:tu@email.com' },
  { id: 'phone',      label: 'Teléfono',   group: 'contact',  iconUrl: \`\${ICON_BASE}/phone.png\`,      placeholder: 'tel:+34600000000' },
  // ── Mis enlaces ────────────────────────────────────────────────
  { id: 'web',        label: 'Mi web',     group: 'links',    iconUrl: \`\${ICON_BASE}/web.png\`,        placeholder: 'https://miweb.com' },
  { id: 'shop',       label: 'Mi tienda',  group: 'links',    iconUrl: \`\${ICON_BASE}/shop.png\`,       placeholder: 'https://mitienda.com' },
  { id: 'etsy',       label: 'Etsy',       group: 'links',    iconUrl: \`\${ICON_BASE}/etsy.png\`,       placeholder: 'https://etsy.com/shop/tu_tienda' },
  { id: 'amazon',     label: 'Amazon',     group: 'links',    iconUrl: \`\${ICON_BASE}/amazon.png\`,     placeholder: 'https://amazon.es/...' },
  { id: 'wallapop',   label: 'Wallapop',   group: 'links',    iconUrl: \`\${ICON_BASE}/wallapop.png\`,   placeholder: 'https://wallapop.com/...' },
  { id: 'calendly',   label: 'Calendly',   group: 'links',    iconUrl: \`\${ICON_BASE}/calendly.png\`,   placeholder: 'https://calendly.com/tu_usuario' },
  { id: 'paypal',     label: 'PayPal',     group: 'links',    iconUrl: \`\${ICON_BASE}/paypal.png\`,     placeholder: 'https://paypal.me/tu_usuario' },
  { id: 'bizum',      label: 'Bizum',      group: 'links',    iconUrl: \`\${ICON_BASE}/bizum.png\`,      placeholder: 'Tu número de Bizum' },
];

// Grupos para mostrar en la UI de configuración
export const SOCIAL_GROUPS = [
  { id: 'social',  label: 'Redes sociales' },
  { id: 'contact', label: 'Contacto directo' },
  { id: 'links',   label: 'Mis enlaces' },
];

// Helper: obtener configuración de una red por su id
export const getSocialNetwork = (id) =>
  SOCIAL_NETWORKS.find(n => n.id === id);

// Helper: formatear número de seguidores (1200 → "1.2K")
export const formatFollowers = (n) => {
  if (!n || n === 0) return '';
  if (n >= 1_000_000) return \`\${(n / 1_000_000).toFixed(1)}M\`;
  if (n >= 1_000)     return \`\${(n / 1_000).toFixed(1)}K\`;
  return String(n);
};
`;

  fs.mkdirSync(path.join(process.cwd(), 'src/constants'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'src/constants/colors.js'),        colorsContent);
  fs.writeFileSync(path.join(process.cwd(), 'src/constants/domains.js'),       domainsContent);
  fs.writeFileSync(path.join(process.cwd(), 'src/constants/socialNetworks.js'), socialNetworksContent);

  console.log('✅ src/constants/colors.js');
  console.log('✅ src/constants/domains.js');
  console.log('✅ src/constants/socialNetworks.js');
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Actualizando arquitectura de dominios');
  console.log('════════════════════════════════════════');

  if (ZONE_ID && API_TOKEN) {
    await updateDNS();
  } else {
    console.log('\n⚠️  Sin credenciales Cloudflare — saltando DNS (se puede ejecutar después)');
  }

  updateFirebaseJson();
  updateEnvExample();
  updateConstants();

  console.log(`
════════════════════════════════════════
  ✅ ARQUITECTURA DE DOMINIOS ACTUALIZADA
════════════════════════════════════════

Estructura definitiva:
  ximvid.com          → Landing marketing (Vercel)
  app.ximvid.com      → Creadores y contenido (Firebase Hosting)
  cdn.ximvid.com      → Videos y assets (Cloudflare CDN)
  api.ximvid.com      → Firebase Functions

Archivos actualizados:
  • firebase.json                      (target: app.ximvid.com)
  • .env.example                       (dominios correctos)
  • src/constants/colors.js            (paleta de colores)
  • src/constants/domains.js           (URLs base — única fuente de verdad)
  • src/constants/socialNetworks.js    (29 redes con iconos desde CDN)

⚠️  Acción manual en Firebase Console:
  Hosting → Añadir dominio personalizado → app.ximvid.com

⚠️  Acción manual en Vercel:
  Dashboard → Add Domain → ximvid.com
  (para la landing de marketing — la haremos en el siguiente paso)

Siguiente paso:
  node setup-sendgrid.js
════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
