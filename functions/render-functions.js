/**
 * XIMVID — functions/render-functions.js
 * Firebase Functions que renderizan las landing pages de creadores
 * y las páginas de video cuando se visitan desde el navegador.
 *
 * Rutas gestionadas por Firebase Hosting:
 *   app.ximvid.com/{username}      → renderCreatorPage
 *   app.ximvid.com/video/{videoId} → renderVideoPage
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const Mustache  = require('mustache');
const fs        = require('fs');
const path      = require('path');

const db = admin.firestore();

// ─── Helper: leer el template HTML ───────────────────────────────
function getTemplate(name) {
  const templatePath = path.join(__dirname, '..', 'public', `${name}.html`);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch {
    return null;
  }
}

// ─── Helper: formatear número de seguidores ───────────────────────
function formatFollowers(n) {
  if (!n || n === 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Helper: obtener label de categoría ──────────────────────────
function getCategoryLabel(category) {
  const labels = {
    selling_product: 'Productos',
    selling_service: 'Servicios',
    sharing_content: 'Contenido',
    discovering:     'Descubridor',
    physicalProducts:'Productos físicos',
    services:        'Servicios',
    training:        'Formación',
    localBusiness:   'Negocio local',
    creatives:       'Creativos',
    personalBrand:   'Marca personal',
  };
  return labels[category] || category || '';
}

// ─── Helper: obtener URL del icono de red social ──────────────────
function getSocialIconUrl(networkId) {
  return `https://cdn.ximvid.com/assets/icons/${networkId}.png`;
}

// ══════════════════════════════════════════════════════════════════
// renderCreatorPage — app.ximvid.com/{username}
// ══════════════════════════════════════════════════════════════════
exports.renderCreatorPage = functions.https.onRequest(async (req, res) => {
  // Extraer username de la URL
  const urlParts = req.path.split('/').filter(Boolean);
  const username = urlParts[0];

  if (!username) {
    return res.status(404).send('Not found');
  }

  // Palabras reservadas que no son usernames
  const reserved = ['privacy','terms','help','about','video','api','admin','static'];
  if (reserved.includes(username.toLowerCase())) {
    return res.status(404).send('Not found');
  }

  try {
    // Buscar usuario por username
    const usersSnap = await db.collection('users')
      .where('username', '==', username.toLowerCase())
      .where('isBanned', '==', false)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><title>Perfil no encontrado — Ximvid</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px;background:#f0f8ff;">
          <h1>Perfil no encontrado</h1>
          <p>El usuario @${username} no existe en Ximvid.</p>
          <a href="https://ximvid.com" style="color:#ff4d6d;">Ir a Ximvid →</a>
        </body></html>
      `);
    }

    const userDoc  = usersSnap.docs[0];
    const userId   = userDoc.id;
    const userData = userDoc.data();

    // Si tiene landing externa, redirigir
    if (userData.landingType === 'external' && userData.externalLandingURL) {
      return res.redirect(301, userData.externalLandingURL);
    }

    // Cargar últimos 6 videos del creador
    const videosSnap = await db.collection('videos')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    const videos = videosSnap.docs.map(d => {
      const v = d.data();
      return {
        videoId:        d.id,
        thumbnailURL:   v.thumbnailURL    || '',
        thumbnailBlurURL: v.thumbnailBlurURL || v.thumbnailURL || '',
        viewsFormatted: formatFollowers(v.views || 0),
        hasAction:      !!(v.actionButtonText && v.actionButtonURL),
      };
    });

    // Preparar datos para el template
    const activeLinks = (userData.socialLinks || [])
      .filter(l => l.url?.trim())
      .map(l => ({
        network:           l.network,
        url:               l.url,
        iconUrl:           getSocialIconUrl(l.network),
        followersFormatted:formatFollowers(l.followers),
      }));

    const templateData = {
      name:             userData.name || username,
      username:         userData.username || username,
      language:         userData.language || 'en',
      profilePhoto:     userData.profilePhoto || '',
      bannerPhoto:      userData.bannerPhoto  || '',
      shortDescription: userData.shortDescription || '',
      longDescription:  userData.longDescription  || '',
      categoryLabel:    getCategoryLabel(userData.category),
      actionButtonText: userData.actionButtonText || '',
      actionButtonURL:  userData.actionButtonURL  || '',
      isPremium:        userData.isPremium || false,
      socialLinks:      activeLinks,
      hasVideos:        videos.length > 0,
      videos,
      // Meta tags
      pageTitle:        `${userData.name || username} — Ximvid`,
      pageDescription:  userData.shortDescription || `Perfil de ${userData.name || username} en Ximvid`,
      pageUrl:          `https://app.ximvid.com/${username}`,
    };

    const template = getTemplate('landing-template');
    if (!template) {
      return res.status(500).send('Template not found');
    }

    const html = Mustache.render(template, templateData);

    // Headers de caché — la landing se cachea 5 minutos en Cloudflare
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch (err) {
    console.error('renderCreatorPage error:', err);
    return res.status(500).send('Internal server error');
  }
});

// ══════════════════════════════════════════════════════════════════
// renderVideoPage — app.ximvid.com/video/{videoId}
// ══════════════════════════════════════════════════════════════════
exports.renderVideoPage = functions.https.onRequest(async (req, res) => {
  const urlParts = req.path.split('/').filter(Boolean);
  const videoId  = urlParts[1]; // /video/{videoId}

  if (!videoId) return res.status(404).send('Not found');

  try {
    const videoDoc = await db.collection('videos').doc(videoId).get();

    if (!videoDoc.exists || !videoDoc.data().isActive || videoDoc.data().isSuspended) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><title>Video no encontrado — Ximvid</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px;background:#f0f8ff;">
          <h1>Video no encontrado</h1>
          <p>Este video no existe o ha sido eliminado.</p>
          <a href="https://ximvid.com" style="color:#ff4d6d;">Ir a Ximvid →</a>
        </body></html>
      `);
    }

    const video    = videoDoc.data();
    const userDoc  = await db.collection('users').doc(video.userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // HTML de la página del video con Open Graph para compartir en redes
    const html = `<!DOCTYPE html>
<html lang="${userData.language || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${userData.name || video.username} en Ximvid</title>
  <meta name="description" content="${userData.shortDescription || 'Ver este video en Ximvid'}">

  <!-- Open Graph — para compartir en WhatsApp, Instagram, Twitter -->
  <meta property="og:title"       content="${userData.name || video.username} — Ximvid">
  <meta property="og:description" content="${userData.shortDescription || 'Ver este video en Ximvid'}">
  <meta property="og:image"       content="${video.thumbnailURL || ''}">
  <meta property="og:url"         content="https://app.ximvid.com/video/${videoId}">
  <meta property="og:type"        content="video.other">
  <meta property="og:video"       content="${video.videoURL || ''}">
  <meta property="og:video:type"  content="video/mp4">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="player">
  <meta name="twitter:title"       content="${userData.name || video.username}">
  <meta name="twitter:image"       content="${video.thumbnailURL || ''}">
  <meta name="twitter:player"      content="https://app.ximvid.com/video/${videoId}">

  <!-- Apple Smart App Banner -->
  <meta name="apple-itunes-app" content="app-id=REEMPLAZAR_APP_ID, app-argument=ximvid://video/${videoId}">

  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#f0f8ff; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; }
    .card { max-width:400px; width:100%; background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 8px 32px rgba(0,40,80,0.12); }
    .thumb { width:100%; aspect-ratio:9/16; object-fit:cover; max-height:500px; background:#000; }
    .info { padding:20px; }
    .creator { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
    .avatar { width:44px; height:44px; border-radius:22px; object-fit:cover; border:2px solid rgba(0,100,200,0.2); }
    .name { font-size:16px; font-weight:700; color:#001428; }
    .username { font-size:13px; color:rgba(0,40,80,0.55); }
    .cta { display:block; background:linear-gradient(90deg,#ff4d6d,#e8003d); color:#fff; text-align:center; padding:14px; border-radius:12px; font-size:15px; font-weight:700; text-decoration:none; margin-bottom:16px; box-shadow:0 4px 16px rgba(255,77,109,0.4); }
    .download { display:flex; gap:8px; }
    .store-btn { flex:1; padding:11px; border-radius:10px; border:1.5px solid rgba(0,60,120,0.2); text-align:center; font-size:13px; font-weight:600; color:#001e3c; text-decoration:none; background:rgba(0,60,120,0.06); }
  </style>
</head>
<body>
  <div class="card">
    ${video.thumbnailURL ? `<img class="thumb" src="${video.thumbnailURL}" alt="Video">` : ''}
    <div class="info">
      <div class="creator">
        ${userData.profilePhoto ? `<img class="avatar" src="${userData.profilePhoto}" alt="">` : ''}
        <div>
          <div class="name">${userData.name || video.username}</div>
          <div class="username">@${video.username}</div>
        </div>
      </div>
      ${video.actionButtonText ? `<a class="cta" href="${video.actionButtonURL}" target="_blank" rel="noopener">${video.actionButtonText}</a>` : ''}
      <div class="download">
        <a class="store-btn" href="https://apps.apple.com/app/ximvid">🍎 App Store</a>
        <a class="store-btn" href="https://play.google.com/store/apps/details?id=com.ximvid.app">🤖 Google Play</a>
      </div>
    </div>
  </div>

  <script>
    // Intentar abrir la app si está instalada
    setTimeout(() => {
      window.location.href = 'ximvid://video/${videoId}';
    }, 100);
  </script>
</body>
</html>`;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch (err) {
    console.error('renderVideoPage error:', err);
    return res.status(500).send('Internal server error');
  }
});
