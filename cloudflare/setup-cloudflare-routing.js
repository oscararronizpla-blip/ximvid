/**
 * XIMVID — setup-cloudflare-routing.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 4b: Configura el routing de URLs personales de creadores.
 *
 * Comportamiento de ximvid.com/username:
 *   - Si el visitante tiene la app → deep link abre el perfil
 *   - Si no tiene la app → Firebase Hosting sirve la landing page HTML
 *
 * También configura:
 *   - ximvid.com/video/{videoId} → deep link al video específico
 *   - ximvid.com/privacy → página estática de política de privacidad
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ZONE_ID   = process.env.CLOUDFLARE_ZONE_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// ─── Helper API ───────────────────────────────────────────────────
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
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  return data.result;
}

// ─── GENERAR firebase.json (routing en Firebase Hosting) ──────────
// Firebase Hosting es el que sirve las landing pages cuando no hay app.
// El routing aquí define qué página se sirve para cada URL.
function generateFirebaseJson() {
  const config = {
    hosting: {
      public: 'public',
      cleanUrls: true,
      trailingSlash: false,
      // Headers de seguridad y rendimiento
      headers: [
        {
          source: '**',
          headers: [
            { key: 'X-Content-Type-Options',    value: 'nosniff' },
            { key: 'X-Frame-Options',            value: 'SAMEORIGIN' },
            { key: 'X-XSS-Protection',           value: '1; mode=block' },
            { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          ],
        },
        // Headers de caché para assets estáticos
        {
          source: '/static/**',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          ],
        },
      ],
      // Rewrites — el orden importa, se evalúan de arriba a abajo
      rewrites: [
        // /video/{videoId} → sirve el HTML de landing que incluye el deep link
        {
          source: '/video/:videoId',
          function: 'renderVideoPage',
        },
        // /privacy → página estática de política de privacidad
        {
          source: '/privacy',
          destination: '/privacy.html',
        },
        // /terms → términos y condiciones
        {
          source: '/terms',
          destination: '/terms.html',
        },
        // /{username} → Firebase Function que renderiza la landing del creador
        // IMPORTANTE: Esta regla debe ir AL FINAL para no interceptar rutas de sistema
        {
          source: '/:username',
          function: 'renderCreatorPage',
        },
        // Todo lo demás → index.html (SPA fallback)
        {
          source: '**',
          destination: '/index.html',
        },
      ],
      // Redirects
      redirects: [
        // www → sin www
        {
          source: 'https://www.ximvid.com/**',
          destination: 'https://ximvid.com/:splat',
          type: 301,
        },
      ],
      // Rutas a ignorar del rewrite (archivos estáticos reales)
      ignore: [
        'firebase.json',
        '**/.*',
        '**/node_modules/**',
      ],
    },
    // Cloud Functions
    functions: {
      source: 'functions',
      runtime: 'nodejs18',
    },
    // Firestore
    firestore: {
      rules: 'firestore.rules',
      indexes: 'firestore.indexes.json',
    },
    // Storage
    storage: {
      rules: 'storage.rules',
    },
    // Emuladores para desarrollo local
    emulators: {
      auth: { port: 9099 },
      functions: { port: 5001 },
      firestore: { port: 8080 },
      hosting: { port: 5000 },
      storage: { port: 9199 },
      ui: { enabled: true, port: 4000 },
    },
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'firebase.json'),
    JSON.stringify(config, null, 2)
  );
  console.log('✅ firebase.json generado');
}

// ─── GENERAR public/index.html (SPA principal) ────────────────────
// Esta es la página que se sirve cuando alguien visita ximvid.com
// directamente en el navegador. Redirige a las apps o muestra info.
function generateIndexHtml() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ximvid — Turn your videos into a sales machine</title>
  <meta name="description" content="Upload your videos once and get followers on all your networks and direct customers at the same time.">
  
  <!-- Open Graph -->
  <meta property="og:title" content="Ximvid">
  <meta property="og:description" content="Upload your videos once and get followers on all your networks and direct customers at the same time.">
  <meta property="og:image" content="https://ximvid.com/static/og-image.jpg">
  <meta property="og:url" content="https://ximvid.com">
  <meta property="og:type" content="website">
  
  <!-- Apple Smart App Banner -->
  <meta name="apple-itunes-app" content="app-id=REEMPLAZAR_APP_STORE_ID, app-argument=https://ximvid.com">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #111;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 20px;
    }
    .container { max-width: 400px; }
    .logo { width: 80px; height: 80px; margin: 0 auto 20px; }
    h1 { font-size: 2rem; font-weight: 500; margin-bottom: 10px; }
    p { color: #aaa; margin-bottom: 30px; line-height: 1.6; }
    .btn {
      display: block;
      padding: 16px 24px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 500;
      margin-bottom: 12px;
      font-size: 1rem;
    }
    .btn-primary { background: #ff4d6d; color: #fff; }
    .btn-secondary { background: #222; color: #fff; border: 1px solid #333; }
  </style>
</head>
<body>
  <div class="container">
    <img class="logo" src="/static/logo.png" alt="Ximvid">
    <h1>Ximvid</h1>
    <p>Upload your videos once and get followers on all your networks and direct customers at the same time.</p>
    <a class="btn btn-primary" href="https://apps.apple.com/app/ximvid/idREEMPLAZAR">
      Download on App Store
    </a>
    <a class="btn btn-secondary" href="https://play.google.com/store/apps/details?id=com.ximvid.app">
      Get it on Google Play
    </a>
  </div>

  <script>
    // Deep link: si el usuario llega aquí desde un link de la app,
    // intentar abrir la app nativa primero
    const appScheme = 'ximvid://';
    const urlParams = new URLSearchParams(window.location.search);
    const deepPath = urlParams.get('deep');
    
    if (deepPath) {
      window.location.href = appScheme + deepPath;
      // Si la app no está instalada, el navegador se queda en esta página
      // mostrando los botones de descarga
    }
  </script>
</body>
</html>`;

  fs.mkdirSync(path.join(process.cwd(), 'public'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'public/index.html'), html);
  console.log('✅ public/index.html generado');
}

// ─── GENERAR public/landing-template.html ─────────────────────────
// Template que Firebase Function renderiza con datos del creador.
// Se sirve cuando alguien visita ximvid.com/username en el navegador.
function generateLandingTemplate() {
  const template = `<!DOCTYPE html>
<html lang="{{language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{{name}} — Ximvid</title>
  <meta name="description" content="{{shortDescription}}">
  
  <!-- Open Graph (para compartir en redes) -->
  <meta property="og:title" content="{{name}} — Ximvid">
  <meta property="og:description" content="{{shortDescription}}">
  <meta property="og:image" content="{{profilePhoto}}">
  <meta property="og:url" content="https://ximvid.com/{{username}}">
  <meta property="og:type" content="profile">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{name}}">
  <meta name="twitter:description" content="{{shortDescription}}">
  <meta name="twitter:image" content="{{profilePhoto}}">
  
  <!-- Apple Smart App Banner -->
  <meta name="apple-itunes-app" content="app-id=REEMPLAZAR_APP_STORE_ID, app-argument=ximvid://profile/{{username}}">
  
  <!-- Schema.org para SEO -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "{{name}}",
    "description": "{{shortDescription}}",
    "image": "{{profilePhoto}}",
    "url": "https://ximvid.com/{{username}}"
  }
  </script>
  
  <style>
    :root {
      --primary: #ff4d6d;
      --bg: #0a0a0a;
      --card: #161616;
      --border: #2a2a2a;
      --text: #ffffff;
      --muted: #888888;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 480px;
      margin: 0 auto;
      min-height: 100vh;
    }
    
    /* Banner */
    .banner {
      width: 100%;
      height: 180px;
      object-fit: cover;
      background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    }
    
    /* Header */
    .header {
      padding: 0 20px 20px;
      position: relative;
    }
    .avatar-wrap {
      margin-top: -40px;
      display: inline-block;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 3px solid var(--bg);
      object-fit: cover;
    }
    .premium-badge {
      position: absolute;
      bottom: 2px;
      right: 2px;
      background: var(--primary);
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .name { font-size: 1.4rem; font-weight: 500; margin-top: 10px; }
    .category { font-size: 0.85rem; color: var(--primary); margin-top: 2px; }
    .description { font-size: 0.9rem; color: var(--muted); margin-top: 8px; line-height: 1.5; }
    
    /* Botón de acción */
    .action-btn {
      display: block;
      background: var(--primary);
      color: var(--text);
      text-align: center;
      padding: 16px;
      border-radius: 12px;
      margin: 16px 20px;
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      box-shadow: 0 4px 20px rgba(255, 77, 109, 0.4);
      transition: opacity 0.2s;
    }
    .action-btn:hover { opacity: 0.9; }
    
    /* Iconos de redes */
    .social-section { padding: 0 20px; margin-bottom: 20px; }
    .social-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      padding: 16px 0;
    }
    .social-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      text-decoration: none;
    }
    .social-icon {
      width: 44px;
      height: 44px;
      filter: brightness(0) invert(1); /* Iconos blancos */
      transition: transform 0.2s;
    }
    .social-item:hover .social-icon { transform: scale(1.1); }
    .social-followers {
      font-size: 0.7rem;
      color: var(--muted);
    }
    
    /* Videos */
    .videos-section { padding: 0 20px; }
    .videos-section h2 { font-size: 1rem; font-weight: 500; margin-bottom: 12px; }
    .videos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .video-thumb {
      position: relative;
      aspect-ratio: 9/16;
      overflow: hidden;
      border-radius: 8px;
      background: var(--card);
    }
    .video-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .video-views {
      position: absolute;
      bottom: 4px;
      left: 4px;
      font-size: 0.7rem;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    }
    
    /* App banner */
    .app-banner {
      margin: 20px;
      padding: 16px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .app-banner p { font-size: 0.85rem; color: var(--muted); }
    .store-links { display: flex; gap: 8px; }
    .store-link {
      flex: 1;
      display: block;
      text-align: center;
      padding: 10px;
      background: var(--bg);
      border-radius: 8px;
      font-size: 0.8rem;
      color: var(--text);
      text-decoration: none;
      border: 1px solid var(--border);
    }
    
    /* Footer */
    footer {
      text-align: center;
      padding: 20px;
      font-size: 0.75rem;
      color: var(--muted);
    }
    footer a { color: var(--muted); }
  </style>
</head>
<body>

  <!-- Banner -->
  <img class="banner"
    src="{{bannerPhoto}}"
    alt=""
    onerror="this.style.display='none'"
  >

  <!-- Header del creador -->
  <div class="header">
    <div class="avatar-wrap" style="position:relative">
      <img class="avatar" src="{{profilePhoto}}" alt="{{name}}">
      {{#isPremium}}<span class="premium-badge">⭐</span>{{/isPremium}}
    </div>
    <div class="name">{{name}}</div>
    <div class="category">{{categoryLabel}}</div>
    <div class="description">{{shortDescription}}</div>
  </div>

  <!-- Botón de acción -->
  {{#actionButtonText}}
  <a class="action-btn" href="{{actionButtonURL}}" target="_blank" rel="noopener">
    {{actionButtonText}}
  </a>
  {{/actionButtonText}}

  <!-- Redes sociales -->
  <div class="social-section">
    <div class="social-grid">
      {{#socialLinks}}
      <a class="social-item" href="{{url}}" target="_blank" rel="noopener noreferrer">
        <img class="social-icon" src="{{iconUrl}}" alt="{{network}}">
        <span class="social-followers">{{followersFormatted}}</span>
      </a>
      {{/socialLinks}}
    </div>
  </div>

  <!-- Últimos videos -->
  {{#hasVideos}}
  <div class="videos-section">
    <h2>Latest videos</h2>
    <div class="videos-grid">
      {{#videos}}
      <a class="video-thumb" href="https://ximvid.com/video/{{videoId}}">
        <!-- Primero carga el blur placeholder (rápido), luego el real -->
        <img
          src="{{thumbnailBlurURL}}"
          data-src="{{thumbnailURL}}"
          alt=""
          loading="lazy"
        >
        <span class="video-views">{{viewsFormatted}} views</span>
      </a>
      {{/videos}}
    </div>
  </div>
  {{/hasVideos}}

  <!-- Banner de descarga de la app -->
  <div class="app-banner">
    <p>Get the full experience on the Ximvid app</p>
    <div class="store-links">
      <a class="store-link" href="https://apps.apple.com/app/ximvid/idREEMPLAZAR">
        🍎 App Store
      </a>
      <a class="store-link" href="https://play.google.com/store/apps/details?id=com.ximvid.app">
        🤖 Google Play
      </a>
    </div>
  </div>

  <footer>
    <a href="https://ximvid.com">Ximvid</a> ·
    <a href="https://ximvid.com/privacy">Privacy</a> ·
    <a href="https://ximvid.com/terms">Terms</a>
  </footer>

  <script>
    // Lazy loading de thumbnails
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          imageObserver.unobserve(img);
        }
      });
    });
    lazyImages.forEach(img => imageObserver.observe(img));

    // Deep link: intentar abrir la app si está instalada
    // Si pasan 2 segundos sin abrir la app, asumimos que no está instalada
    // y mostramos el banner de descarga (ya visible)
    const username = '{{username}}';
    window.addEventListener('load', () => {
      const appUrl = 'ximvid://profile/' + username;
      
      // Solo intentar deep link si el usuario viene de un link externo
      // (no si está navegando directamente)
      if (document.referrer && !document.referrer.includes('ximvid.com')) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = appUrl;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }
    });
  </script>

</body>
</html>`;

  fs.writeFileSync(
    path.join(process.cwd(), 'public/landing-template.html'),
    template
  );
  console.log('✅ public/landing-template.html generado');
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Configurando routing');
  console.log('════════════════════════════════════════\n');

  generateFirebaseJson();
  generateIndexHtml();
  generateLandingTemplate();

  // Configurar Cloudflare Workers para el routing inteligente
  if (ZONE_ID && API_TOKEN) {
    try {
      // El Worker de Cloudflare es el que decide si servir app o web
      // basándose en el User-Agent del dispositivo
      console.log('\n⚙️  Worker de Cloudflare (routing inteligente)...');
      console.log('  ⚠️  El Worker debe crearse manualmente en dash.cloudflare.com');
      console.log('  → Workers & Pages → Create application → Worker');
      console.log('  → Pegar el código de cloudflare-worker.js');
    } catch (err) {
      console.warn('  ⚠️  Worker:', err.message);
    }
  }

  // Generar el código del Worker
  const workerCode = `/**
 * Cloudflare Worker — ximvid.com
 * Routing inteligente para URLs de creadores
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  
  // Rutas del sistema — pasar directamente a Firebase Hosting
  const systemPaths = ['/privacy', '/terms', '/static', '/favicon.ico', '/robots.txt'];
  if (systemPaths.some(p => url.pathname.startsWith(p))) {
    return fetch(request);
  }
  
  // Detectar si es un video específico
  const videoMatch = url.pathname.match(/^\\/video\\/([a-zA-Z0-9_-]+)$/);
  if (videoMatch) {
    const videoId = videoMatch[1];
    // Delegar a Firebase Function renderVideoPage
    return fetch(request);
  }
  
  // Detectar si es el perfil de un creador (/{username})
  const usernameMatch = url.pathname.match(/^\\/([a-zA-Z0-9_-]+)$/);
  if (usernameMatch && url.pathname !== '/') {
    const username = usernameMatch[1];
    
    // Detectar si tiene la app instalada es imposible desde el servidor.
    // Servimos siempre la landing web que incluye el deep link en JavaScript.
    // Si la app está instalada, el deep link la abre automáticamente.
    return fetch(request);
  }
  
  // Resto — Firebase Hosting
  return fetch(request);
}`;

  fs.writeFileSync(
    path.join(process.cwd(), 'cloudflare-worker.js'),
    workerCode
  );

  console.log(`
════════════════════════════════════════
  ✅ PASO 4b COMPLETADO
════════════════════════════════════════

Archivos generados:
  • firebase.json            → Configuración completa de Firebase
  • public/index.html        → Página principal en el navegador
  • public/landing-template.html → Template de landing de creadores
  • cloudflare-worker.js     → Worker para routing inteligente

URLs configuradas:
  ximvid.com/{username}      → Landing page del creador (con deep link)
  ximvid.com/video/{id}      → Página del video (con deep link)
  ximvid.com/privacy         → Política de privacidad
  ximvid.com/terms           → Términos y condiciones

Deep linking:
  Si el usuario tiene la app → ximvid://profile/{username}
  Si no tiene la app         → Landing web con botones de descarga

Siguiente paso:
  node setup-stripe.js
════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
