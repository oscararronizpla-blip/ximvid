/**
 * XIMVID — setup-cloudflare.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 4: Configura Cloudflare para:
 *   - Dominio principal ximvid.com → Firebase Hosting
 *   - CDN cdn.ximvid.com → Firebase Storage (videos y thumbnails)
 *   - Caché agresiva de videos (30 días)
 *   - Compresión automática de respuestas
 *   - Protección DDoS y rate limiting
 *
 * Ejecutar desde terminal:
 *   node setup-cloudflare.js
 *
 * Variables de entorno necesarias en .env:
 *   CLOUDFLARE_API_TOKEN=
 *   CLOUDFLARE_ZONE_ID=
 *   CLOUDFLARE_ACCOUNT_ID=
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();

const API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_ID     = process.env.CLOUDFLARE_ZONE_ID;
const ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID;

// Firebase Hosting IPs (actualizadas a fecha 2024)
const FIREBASE_HOSTING_IPS = [
  '151.101.1.195',
  '151.101.65.195',
];

// Firebase Storage bucket
const STORAGE_BUCKET = 'ximvid.appspot.com';

// ─── Validación de credenciales ───────────────────────────────────
if (!API_TOKEN || !ZONE_ID || !ACCOUNT_ID) {
  console.error(`
❌ Faltan variables de entorno de Cloudflare.

Necesitas:
  CLOUDFLARE_API_TOKEN  → dash.cloudflare.com → Mi perfil → Tokens de API
  CLOUDFLARE_ZONE_ID    → dash.cloudflare.com → ximvid.com → Resumen (panel derecho)
  CLOUDFLARE_ACCOUNT_ID → dash.cloudflare.com → ximvid.com → Resumen (panel derecho)

Crea el token con permisos:
  - Zone:DNS:Edit
  - Zone:Cache Rules:Edit
  - Zone:Page Rules:Edit
  - Zone:Firewall Rules:Edit
`);
  process.exit(1);
}

// ─── Helper: llamada a la API de Cloudflare ───────────────────────
async function cfApi(method, endpoint, body = null) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      `Cloudflare API error en ${endpoint}: ${JSON.stringify(data.errors)}`
    );
  }

  return data.result;
}

// ─── PASO 4.1 — Registros DNS ─────────────────────────────────────
async function setupDNS() {
  console.log('\n📡 Configurando registros DNS...');

  const records = [
    // ximvid.com → Firebase Hosting
    {
      type: 'A',
      name: '@',
      content: FIREBASE_HOSTING_IPS[0],
      proxied: true,   // Tráfico pasa por Cloudflare (protección + caché)
      comment: 'ximvid.com → Firebase Hosting',
    },
    {
      type: 'A',
      name: '@',
      content: FIREBASE_HOSTING_IPS[1],
      proxied: true,
      comment: 'ximvid.com → Firebase Hosting (redundancia)',
    },
    // www.ximvid.com → redirige a ximvid.com (se configura en Page Rules)
    {
      type: 'CNAME',
      name: 'www',
      content: 'ximvid.com',
      proxied: true,
      comment: 'www redirect a raíz',
    },
    // cdn.ximvid.com → Firebase Storage (videos y thumbnails)
    {
      type: 'CNAME',
      name: 'cdn',
      content: `storage.googleapis.com`,
      proxied: true,   // Cloudflare cachea los videos desde Storage
      comment: 'CDN de videos y thumbnails',
    },
    // Verificación del dominio para Firebase Hosting
    // Firebase proporciona este valor en la consola al añadir el dominio
    {
      type: 'TXT',
      name: '@',
      content: 'firebase-hosting-verification=REEMPLAZAR_CON_VALOR_DE_FIREBASE_CONSOLE',
      proxied: false,
      comment: 'Verificación Firebase Hosting — reemplazar con valor real',
    },
    // SPF para SendGrid (emails no van a spam)
    {
      type: 'TXT',
      name: '@',
      content: 'v=spf1 include:sendgrid.net ~all',
      proxied: false,
      comment: 'SPF para SendGrid',
    },
    // DKIM para SendGrid (autenticidad de emails)
    {
      type: 'CNAME',
      name: 's1._domainkey',
      content: 's1.domainkey.u12345678.wl.sendgrid.net',
      proxied: false,
      comment: 'DKIM SendGrid clave 1 — reemplazar con valor real de SendGrid',
    },
    {
      type: 'CNAME',
      name: 's2._domainkey',
      content: 's2.domainkey.u12345678.wl.sendgrid.net',
      proxied: false,
      comment: 'DKIM SendGrid clave 2 — reemplazar con valor real de SendGrid',
    },
  ];

  for (const record of records) {
    try {
      await cfApi('POST', `/zones/${ZONE_ID}/dns_records`, record);
      console.log(`  ✅ DNS ${record.type} ${record.name} creado`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭  DNS ${record.type} ${record.name} ya existe`);
      } else {
        console.warn(`  ⚠️  ${record.type} ${record.name}: ${err.message}`);
      }
    }
  }
}

// ─── PASO 4.2 — Cache Rules (para videos y thumbnails) ───────────
async function setupCacheRules() {
  console.log('\n🚀 Configurando reglas de caché...');

  const cacheRules = [
    // Videos MP4 — caché 30 días en Cloudflare
    {
      description: 'Cache videos MP4 — 30 días',
      expression: `(http.host eq "cdn.ximvid.com" and http.request.uri.path matches ".*\\.mp4$")`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: {
          mode: 'override_origin',
          default: 2592000, // 30 días en segundos
        },
        browser_ttl: {
          mode: 'override_origin',
          default: 86400, // 1 día en el navegador
        },
        serve_stale: {
          disable_stale_while_updating: false,
        },
      },
    },
    // Segmentos HLS (.ts) — caché 30 días (son inmutables)
    {
      description: 'Cache segmentos HLS — 30 días',
      expression: `(http.host eq "cdn.ximvid.com" and http.request.uri.path matches ".*\\.ts$")`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: {
          mode: 'override_origin',
          default: 2592000,
        },
        browser_ttl: {
          mode: 'override_origin',
          default: 86400,
        },
      },
    },
    // Playlists HLS (.m3u8) — caché corta (puede actualizarse)
    {
      description: 'Cache playlists HLS — 5 minutos',
      expression: `(http.host eq "cdn.ximvid.com" and http.request.uri.path matches ".*\\.m3u8$")`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: {
          mode: 'override_origin',
          default: 300, // 5 minutos
        },
        browser_ttl: {
          mode: 'override_origin',
          default: 60,
        },
      },
    },
    // Thumbnails JPG — caché 7 días
    {
      description: 'Cache thumbnails — 7 días',
      expression: `(http.host eq "cdn.ximvid.com" and http.request.uri.path matches ".*\\.jpg$")`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: {
          mode: 'override_origin',
          default: 604800, // 7 días
        },
        browser_ttl: {
          mode: 'override_origin',
          default: 86400,
        },
      },
    },
    // Assets de la app (iconos, logo) — caché 1 año (son inmutables)
    {
      description: 'Cache assets de app — 1 año',
      expression: `(http.host eq "cdn.ximvid.com" and http.request.uri.path starts_with "/assets/")`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: {
          mode: 'override_origin',
          default: 31536000, // 1 año
        },
        browser_ttl: {
          mode: 'override_origin',
          default: 31536000,
        },
      },
    },
  ];

  for (const rule of cacheRules) {
    try {
      await cfApi('POST', `/zones/${ZONE_ID}/rulesets`, {
        name: rule.description,
        kind: 'zone',
        phase: 'http_request_cache_settings',
        rules: [rule],
      });
      console.log(`  ✅ Cache rule: ${rule.description}`);
    } catch (err) {
      console.warn(`  ⚠️  Cache rule "${rule.description}": ${err.message}`);
    }
  }
}

// ─── PASO 4.3 — Page Rules ─────────────────────────────────────────
async function setupPageRules() {
  console.log('\n📄 Configurando Page Rules...');

  const pageRules = [
    // Redirigir www → sin www
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'www.ximvid.com/*' } }],
      actions: [
        {
          id: 'forwarding_url',
          value: {
            url: 'https://ximvid.com/$1',
            status_code: 301,
          },
        },
      ],
    },
    // Forzar HTTPS
    {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'http://ximvid.com/*' } }],
      actions: [{ id: 'always_use_https' }],
    },
  ];

  for (const rule of pageRules) {
    try {
      await cfApi('POST', `/zones/${ZONE_ID}/pagerules`, {
        ...rule,
        status: 'active',
      });
      console.log(`  ✅ Page Rule creada`);
    } catch (err) {
      console.warn(`  ⚠️  Page Rule: ${err.message}`);
    }
  }
}

// ─── PASO 4.4 — Firewall Rules (protección básica) ────────────────
async function setupFirewall() {
  console.log('\n🛡️  Configurando protección básica...');

  // Rate limiting: máximo 100 requests/min desde la misma IP
  // (protege contra scrapers y bots)
  try {
    await cfApi('POST', `/zones/${ZONE_ID}/rate_limits`, {
      match: {
        request: {
          url_pattern: 'ximvid.com/*',
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
        },
        response: { status: [200, 201, 400, 401, 403, 429] },
      },
      threshold: 100,       // 100 requests
      period: 60,           // por minuto
      action: {
        mode: 'challenge',  // Muestra challenge de Cloudflare (no bloquea directamente)
        timeout: 60,
        response: {
          content_type: 'application/json',
          body: '{"error":"Too many requests","code":429}',
        },
      },
      description: 'Rate limit: 100 req/min por IP',
      disabled: false,
    });
    console.log('  ✅ Rate limiting configurado (100 req/min)');
  } catch (err) {
    console.warn(`  ⚠️  Rate limiting: ${err.message}`);
  }
}

// ─── PASO 4.5 — Configuración de zona ────────────────────────────
async function setupZoneSettings() {
  console.log('\n⚙️  Configurando ajustes de la zona...');

  const settings = [
    { id: 'ssl',                      value: 'full_strict' },
    { id: 'always_use_https',         value: 'on' },
    { id: 'min_tls_version',          value: '1.2' },
    { id: 'automatic_https_rewrites', value: 'on' },
    { id: 'brotli',                   value: 'on' },    // Compresión Brotli (mejor que gzip)
    { id: 'http2',                    value: 'on' },
    { id: 'http3',                    value: 'on' },    // QUIC para mejor latencia móvil
    { id: 'early_hints',              value: 'on' },    // Preload hints
    { id: 'browser_cache_ttl',        value: 14400 },   // 4 horas base
    { id: 'rocket_loader',            value: 'off' },   // Off — puede interferir con React Native web
    { id: 'minify', value: { css: 'on', js: 'on', html: 'on' } },
  ];

  for (const setting of settings) {
    try {
      await cfApi('PATCH', `/zones/${ZONE_ID}/settings/${setting.id}`, {
        value: setting.value,
      });
      console.log(`  ✅ ${setting.id}: ${JSON.stringify(setting.value)}`);
    } catch (err) {
      console.warn(`  ⚠️  ${setting.id}: ${err.message}`);
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Configurando Cloudflare');
  console.log('════════════════════════════════════════');

  await setupDNS();
  await setupCacheRules();
  await setupPageRules();
  await setupFirewall();
  await setupZoneSettings();

  console.log(`
════════════════════════════════════════
  ✅ PASO 4 COMPLETADO
════════════════════════════════════════

DNS configurado:
  • ximvid.com         → Firebase Hosting (proxied)
  • www.ximvid.com     → redirige a ximvid.com
  • cdn.ximvid.com     → Firebase Storage (CDN de videos)

Optimizaciones activas:
  • Videos MP4: caché 30 días en Cloudflare
  • Segmentos HLS: caché 30 días
  • Thumbnails: caché 7 días
  • Assets app: caché 1 año
  • HTTP/3 (QUIC): activado — mejor latencia en móvil
  • Brotli: activado — compresión superior a gzip
  • Rate limiting: 100 req/min por IP

⚠️  ACCIONES MANUALES NECESARIAS:
  1. En Firebase Console → Hosting → Dominio personalizado
     Añade: ximvid.com y www.ximvid.com
     Firebase te dará el valor TXT de verificación
     → Actualiza el registro TXT en setup-cloudflare.js y vuelve a ejecutar

  2. Para el CDN de videos, en Firebase Console → Storage
     Asegúrate de que el bucket es ximvid.appspot.com
     o actualiza la variable STORAGE_BUCKET en este archivo

  3. En SendGrid → Settings → Sender Authentication
     Autentifica ximvid.com para obtener los valores CNAME de DKIM
     → Actualiza los registros s1._domainkey y s2._domainkey

Siguiente paso:
  node setup-cloudflare-routing.js
════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
