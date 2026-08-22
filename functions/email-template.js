const APP_URL = process.env.APP_URL || 'https://ximvid.com';

const IMGS = {
  feed:     'https://storage.googleapis.com/ximvid-c8627.firebasestorage.app/email-assets/Screenshot_20260614_210637_Chrome.jpg',
  producto: 'https://storage.googleapis.com/ximvid-c8627.firebasestorage.app/email-assets/Screenshot_20260614_210038_Chrome.jpg',
  analitica:'https://storage.googleapis.com/ximvid-c8627.firebasestorage.app/email-assets/Screenshot_20260614_210224_Chrome.jpg',
  perfil:   'https://storage.googleapis.com/ximvid-c8627.firebasestorage.app/email-assets/Screenshot_20260614_210103_Chrome.jpg',
  hero:     'https://storage.googleapis.com/ximvid-c8627.firebasestorage.app/email-assets/hero-feed-v2.gif'
};

const BASE_URL = APP_URL;
const PLAY_URL  = 'https://play.google.com/store/apps/details?id=com.ximvid.app';
const APPLE_URL = 'https://apps.apple.com/app/ximvid/id0000000000';

function header() {
  return `
  <tr><td style="padding:28px 32px 0">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#fff;letter-spacing:-.5px">xim<span style="color:#f0b429;font-style:italic">vid</span></div>
    <div style="height:1px;background:rgba(255,255,255,.12);margin:20px 0 0"></div>
  </td></tr>`;
}

function footer() {
  return `
  <tr><td style="padding:10px 32px 32px">
    <div style="height:1px;background:rgba(255,255,255,.1);margin:0 0 22px"></div>
    <div style="text-align:center;font-family:Georgia,serif;font-size:22px;color:#fff;margin:0 0 16px">xim<span style="color:#f0b429;font-style:italic">vid</span></div>
    <div style="text-align:center;margin:0 0 20px">
      <a href="mailto:info@ximvid.com" style="display:inline-block;width:40px;height:40px;line-height:40px;border-radius:50%;background:rgba(255,255,255,.08);text-decoration:none;font-size:20px" title="Contacto">📧</a>
    </div>
    <div style="text-align:center;margin:0 0 18px">
      <a href="${PLAY_URL}" style="display:inline-block;margin:0 6px;padding:10px 18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;text-decoration:none;color:#fff;font-family:Arial,sans-serif;font-size:13px">▶ Google Play</a>
      <a href="${APPLE_URL}" style="display:inline-block;margin:0 6px;padding:10px 18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;text-decoration:none;color:#fff;font-family:Arial,sans-serif;font-size:13px"> App Store</a>
    </div>
    <div style="text-align:center;font-family:Arial,sans-serif;font-size:12px;margin:0 0 12px">
      <a href="${BASE_URL}/privacy.html" style="color:#8da3bf;text-decoration:underline">Política de privacidad</a>
      <span style="color:#5a6b82"> &nbsp;|&nbsp; </span>
      <a href="${BASE_URL}/terms.html" style="color:#8da3bf;text-decoration:underline">Términos de uso</a>
    </div>
    <div style="text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#4a5a72;line-height:1.6">
      Recibes este email porque tienes notificaciones activas en Ximvid.<br>
      Puedes desactivarlas en <strong>Ajustes → Notificaciones</strong>.<br><br>
      © 2026 Ximvid. Todos los derechos reservados.
    </div>
  </td></tr>`;
}

function wrap(rows) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ximvid</title></head>
<body style="margin:0;padding:0;background:#050b16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050b16;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#0a1628;border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,.07)">
${rows}
</table>
</td></tr>
</table>
</body></html>`;
}

function btnGold(text, url) {
  return `<tr><td align="center" style="padding:6px 32px 24px">
    <a href="${url}" style="display:inline-block;background:linear-gradient(115deg,#7a5200,#c8860a,#f0b429,#ffd76a,#f0b429,#c8860a,#7a5200);color:#1a1300;text-decoration:none;padding:16px 40px;border-radius:14px;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;letter-spacing:.3px">${text}</a>
  </td></tr>`;
}

function imgBlock(src, alt) {
  return `<tr><td align="center" style="padding:0 32px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
      <tr><td style="padding:20px;background:radial-gradient(ellipse at center,rgba(200,134,10,.18) 0%,rgba(10,22,40,0) 70%);border-radius:32px">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr><td style="border:2px solid #c8860a;border-radius:28px;padding:3px;background:linear-gradient(145deg,#7a5200,#c8860a,#f0b429,#c8860a,#7a5200)">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="border-radius:26px;overflow:hidden;display:block;width:200px">
                <div style="background:#1a0800;border-radius:26px;padding:10px 0 4px;text-align:center">
                  <div style="width:40px;height:6px;background:#7a5200;border-radius:3px;margin:0 auto 8px"></div>
                </div>
                <img src="${src}" alt="${alt}" width="200" style="display:block;width:200px;height:360px;object-fit:cover;object-position:top">
                <div style="background:#1a0800;border-radius:0 0 26px 26px;padding:6px 0 8px;text-align:center">
                  <div style="width:24px;height:24px;border:1.5px solid #7a5200;border-radius:50%;margin:0 auto"></div>
                </div>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function sectionTitle(text) {
  return `<tr><td style="padding:28px 32px 10px">
    <div style="height:1px;background:rgba(255,255,255,.08);margin:0 0 24px"></div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#fff;line-height:1.3;margin:0 0 12px">${text}</div>
  </td></tr>`;
}

function bodyText(text) {
  return `<tr><td style="padding:0 32px 8px">
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#c9d4e3;line-height:1.7">${text}</div>
  </td></tr>`;
}

// ── EMAIL 1: BIENVENIDA (largo, todos los bloques) ─────────────────
function buildWelcomeEmail(userName) {
  const name = userName || 'creador';
  const rows = `
  ${header()}

  <!-- HERO -->
  <tr><td style="padding:36px 32px 8px;text-align:center">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;color:#fff;line-height:1.2;margin:0 0 14px">Tu vídeo son<br><span style="color:#f0b429;font-style:italic">tus redes sociales</span></div>
    <div style="font-family:Arial,sans-serif;font-size:16px;color:#c9d4e3;line-height:1.6;margin:0 0 24px">Bienvenido a Ximvid, ${name}. La primera app donde cada vídeo es una herramienta de venta y conexión directa con tu audiencia.</div>
  </td></tr>
  ${imgBlock(IMGS.hero, 'Ximvid en acción')}
  ${btnGold('Empezar ahora', BASE_URL)}

  <!-- BLOQUE 1: REDES EN UN VIDEO -->
  ${sectionTitle('Todas tus redes sociales,<br>en un solo vídeo')}
  ${bodyText('TikTok e Instagram no te dejan poner links en tus vídeos. En Ximvid cada vídeo lleva integradas todas tus redes sociales — Instagram, LinkedIn, WhatsApp, TikTok y hasta 43 plataformas más. El espectador las ve flotando a un lado y llega a donde tú quieras con un solo toque. Sin salir de la app. Sin perder el contacto.')}
  ${imgBlock(IMGS.perfil, 'Perfil Ximvid con redes integradas')}
  ${btnGold('Añadir mis redes', BASE_URL + '/social-links.html')}

  <!-- BLOQUE 2: VENDE MIENTRAS TE VEN -->
  ${sectionTitle('Vende mientras te ven')}
  ${bodyText('¿Vendes un producto? Añade foto, precio y botón de compra directamente en tu vídeo. ¿Ofreces un servicio? Crea un botón personalizado que lleve al cliente exactamente donde quieres: tu web, tu WhatsApp, tu agenda. La conversión ocurre mientras el vídeo se reproduce. No después. No en otro sitio.')}
  ${imgBlock(IMGS.producto, 'Ficha de producto en Ximvid')}
  ${btnGold('Subir mi primer vídeo', BASE_URL + '/upload.html')}

  <!-- BLOQUE 3: SUBE LO QUE YA TIENES -->
  ${sectionTitle('Sube el mismo vídeo<br>que ya tienes')}
  ${bodyText('Sin esfuerzo extra. El vídeo que ya grabaste para TikTok o Instagram funciona perfectamente en Ximvid. Súbelo desde tu galería en segundos, elige si vendes un producto, ofreces un servicio o simplemente compartes contenido, y Ximvid hace el resto: lo comprime, genera la miniatura y lo publica en el feed de miles de personas.')}
  ${btnGold('Publicar mi vídeo', BASE_URL + '/upload.html')}

  <!-- BLOQUE 4: ANALITICA -->
  ${sectionTitle('Sabe exactamente qué funciona')}
  ${bodyText('Ximvid te da los datos que las redes sociales te ocultan: tasa de conversión real, qué red social genera más clics, cuántas personas pulsaron tu botón de venta, rendimiento por vídeo. No más publicar a ciegas. Toma decisiones con datos reales de tu negocio.')}
  ${imgBlock(IMGS.analitica, 'Analítica de redes en Ximvid')}
  ${btnGold('Ver mis estadísticas', BASE_URL + '/stats.html')}

  ${footer()}`;

  return wrap(rows);
}

// ── EMAIL INVITACION (descubridor -> creador) ─────────────────────
function buildInviteEmail(userName) {
  const name = userName || '';
  const saludo = name ? ('Hola ' + name + ',') : 'Hola,';
  const rows = `
  ${header()}
  <!-- HERO -->
  <tr><td style="padding:36px 32px 8px;text-align:center">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;color:#fff;line-height:1.2;margin:0 0 14px">El buscador universal<br>de <span style="color:#f0b429;font-style:italic">los creadores</span></div>
    <div style="font-family:Arial,sans-serif;font-size:16px;color:#c9d4e3;line-height:1.6;margin:0 0 24px">${saludo} descubre Ximvid: el lugar donde los vídeos que ya son virales en TikTok, Instagram y YouTube se reúnen — y donde conectas con cada creador en la red social que tú elijas, con un solo toque.</div>
  </td></tr>
  ${imgBlock(IMGS.hero, 'Ximvid en acción')}
  ${btnGold('Descubrir Ximvid', BASE_URL)}
  <!-- PILAR 1: DESCUBRE LO VIRAL -->
  ${sectionTitle('Descubre lo que ya<br>está triunfando')}
  ${bodyText('No empieces de cero buscando en mil sitios. En Ximvid encuentras reunidos los vídeos que ya se hicieron virales en otras redes. Lo mejor de cada creador, en un solo feed, listo para descubrir.')}
  ${imgBlock(IMGS.perfil, 'Feed de creadores en Ximvid')}
  <!-- PILAR 2: BUSCADOR UNIVERSAL -->
  ${sectionTitle('Todas sus redes,<br>en un solo lugar')}
  ${bodyText('Ximvid es el buscador universal de las redes sociales de los creadores. ¿Te gusta alguien? Tienes todas sus plataformas delante: Instagram, TikTok, LinkedIn, WhatsApp, YouTube y más de 43 redes. Se acabó buscar a cada uno por separado.')}
  ${btnGold('Explorar creadores', BASE_URL + '/search.html')}
  <!-- PILAR 3: CONECTA CON UN CLIC -->
  ${sectionTitle('Conecta con un clic')}
  ${bodyText('Mientras ves el vídeo, las redes del creador flotan a un lado. Pulsa la que más te guste y entras directo a su perfil. Sin copiar nombres, sin buscar, sin perder el contacto. La conexión más directa entre tú y quien te interesa.')}
  <!-- PILAR 4 (GIRO A CREADOR): REPLICA TU CONTENIDO -->
  ${sectionTitle('¿Creas contenido?<br>Replica lo que ya funciona')}
  ${bodyText('Aquí viene lo mejor: si ya tienes vídeos que funcionaron en otras redes, replícalos en Ximvid sin esfuerzo. El mismo vídeo que grabaste para TikTok o Instagram hace crecer TODAS tus redes a la vez, porque cada espectador puede saltar a cualquiera de tus plataformas. Un solo vídeo, todas tus redes creciendo juntas.')}
  ${imgBlock(IMGS.analitica, 'Crecimiento de redes en Ximvid')}
  <!-- PILAR 5: VENDE O CONECTA CON UN CLIC -->
  ${sectionTitle('Vende o haz que<br>te contacten al instante')}
  ${bodyText('Y lo más potente: expón tu producto o servicio dentro del vídeo. El espectador lo compra o te contacta con un solo clic, por donde tú elijas — WhatsApp, tu tienda, tu web, tu agenda o un botón de compra directa. Sin formularios, sin salir de la app. Tu vídeo deja de ser solo contenido y se convierte en tu vendedor.')}
  ${imgBlock(IMGS.producto, 'Vende con un clic en Ximvid')}
  ${btnGold('Empezar a crear gratis', BASE_URL + '/register.html')}
  ${footer()}`;
  return wrap(rows);
}
// ── EMAIL 2: CTA (alguien pulso tu boton de accion) ───────────────
function buildCtaEmail(opts) {
  const { userName, videoDesc, ctaType, lang } = opts;
  const isEs = (lang !== 'en');
  const isProduct = (ctaType === 'product');
  const title = isEs
    ? (isProduct ? '¡Alguien quiere tu producto!' : '¡Alguien quiere tu servicio!')
    : (isProduct ? 'Someone wants your product!' : 'Someone wants your service!');
  const body = isEs
    ? `Hay alguien interesado en <strong style="color:#f0b429">${videoDesc || 'tu vídeo'}</strong>. Ha pulsado tu botón de ${isProduct ? 'compra' : 'acción'} en Ximvid. Entra ahora para ver quién es y no pierdas la oportunidad.`
    : `Someone is interested in <strong style="color:#f0b429">${videoDesc || 'your video'}</strong>. They tapped your ${isProduct ? 'buy' : 'action'} button on Ximvid. Open the app now to follow up.`;
  const cta = isEs ? 'Ver quién es' : 'See who it is';
  const tip = isEs
    ? '💡 <strong>Consejo:</strong> Responde rápido. Los usuarios que reciben respuesta en menos de 1 hora convierten 3 veces más.'
    : '💡 <strong>Tip:</strong> Respond fast. Users who reply within 1 hour convert 3x more.';

  const rows = `
  ${header()}
  <tr><td style="padding:36px 32px 8px;text-align:center">
    <div style="font-size:48px;margin:0 0 12px">${isProduct ? '🛍️' : '🎯'}</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#fff;line-height:1.2;margin:0 0 14px">${title}</div>
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#c9d4e3;line-height:1.7">${body}</div>
  </td></tr>
  ${btnGold(cta, BASE_URL + '/notifications.html')}
  ${bodyText(tip)}
  ${imgBlock(IMGS.hero, 'Ximvid en acción')}
  ${bodyText(isEs
    ? 'Cada clic cuenta. Revisa tus estadísticas para ver el rendimiento de todos tus vídeos y saber qué contenido convierte mejor.'
    : 'Every click counts. Check your stats to see how all your videos perform and find out what content converts best.')}
  ${btnGold(isEs ? 'Ver mis estadísticas' : 'View my stats', BASE_URL + '/stats.html')}
  ${footer()}`;

  return wrap(rows);
}

// ── EMAIL 3: RESUMEN SEMANAL (con graficas de barras) ─────────────
function buildWeeklyEmail(opts) {
  const { userName, total, counts, lang } = opts;
  const isEs = (lang !== 'en');
  const NET_NAMES = {
    instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube', facebook:'Facebook',
    twitter:'X / Twitter', linkedin:'LinkedIn', pinterest:'Pinterest', snapchat:'Snapchat',
    twitch:'Twitch', whatsapp:'WhatsApp', telegram:'Telegram', spotify:'Spotify',
    web:'Web propia', shop:'Tienda online', threads:'Threads', email:'Email directo',
    phone:'Teléfono', patreon:'Patreon', calendly:'Calendly'
  };
  const entries = Object.entries(counts || {}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const maxVal = entries.length ? Math.max(...entries.map(e=>e[1])) : 1;
  const chartRows = entries.map(([net, val]) => {
    const pct = Math.round((val/maxVal)*100);
    const name = NET_NAMES[net] || net;
    return `<tr><td style="padding:6px 0">
      <div style="font-family:Arial,sans-serif;font-size:13px;color:#c9d4e3;margin:0 0 5px;display:flex;justify-content:space-between">
        <span>${name}</span><span style="color:#f0b429;font-weight:bold">${val} clics</span>
      </div>
      <div style="background:rgba(255,255,255,.07);border-radius:8px;height:16px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#7a5200,#c8860a,#f0b429);height:16px;border-radius:8px;width:${pct}%"></div>
      </div>
    </td></tr>`;
  }).join('');

  const title = isEs ? 'Tu resumen semanal de redes' : 'Your weekly social summary';
  const intro = isEs
    ? `Esta semana tus redes sociales recibieron <strong style="color:#f0b429">${total} clics</strong> desde tus vídeos de Ximvid. Aquí tienes el desglose de qué redes están funcionando mejor:`
    : `This week your social links received <strong style="color:#f0b429">${total} clicks</strong> from your Ximvid videos. Here's which networks are performing best:`;
  const tip = isEs
    ? '💡 <strong>Consejo:</strong> Las redes con más clics son donde tu audiencia prefiere conectar. Asegúrate de tener ese perfil actualizado.'
    : '💡 <strong>Tip:</strong> Your top networks are where your audience prefers to connect. Make sure those profiles are up to date.';

  const rows = `
  ${header()}
  <tr><td style="padding:36px 32px 8px;text-align:center">
    <div style="font-size:44px;margin:0 0 12px">📊</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#fff;line-height:1.2;margin:0 0 14px">${title}</div>
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#c9d4e3;line-height:1.7">${intro}</div>
  </td></tr>

  <!-- GRAFICA -->
  <tr><td style="padding:8px 32px 24px">
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px">
      <div style="font-family:Georgia,serif;font-size:16px;color:rgba(255,255,255,.7);margin:0 0 16px;text-transform:uppercase;letter-spacing:1px;font-size:11px">Clics por red social esta semana</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${chartRows}</table>
    </div>
  </td></tr>

  ${btnGold(isEs ? 'Ver analítica completa' : 'View full analytics', BASE_URL + '/social-stats.html')}
  ${bodyText(tip)}
  ${imgBlock(IMGS.hero, 'Ximvid en acción')}
  ${bodyText(isEs
    ? 'Recuerda: cuantas más redes actives en tu perfil, más puntos de contacto tienes con tu audiencia. Activa las que todavía no tienes.'
    : 'Remember: the more networks you activate on your profile, the more touchpoints you have with your audience.')}
  ${btnGold(isEs ? 'Gestionar mis redes' : 'Manage my networks', BASE_URL + '/social-links.html')}
  ${footer()}`;

  return wrap(rows);
}

// ── EMAIL AVISO SERIO (censura, advertencias) — sobrio, sin marketing ──
function buildWarningEmail(opts) {
  const { userName, title, body, videoDesc, lang } = opts;
  const isEs = lang !== 'en';
  const rows = `
  ${header()}
  <tr><td style="padding:36px 32px 8px">
    <div style="font-size:40px;margin:0 0 14px">⚠️</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#fff;line-height:1.25;margin:0 0 16px">${title}</div>
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#c9d4e3;line-height:1.7;margin:0 0 14px">${isEs ? 'Hola' : 'Hi'} ${userName || ''},</div>
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#c9d4e3;line-height:1.7">${body}</div>
    ${videoDesc ? `<div style="margin:18px 0 0;padding:12px 16px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.25);border-radius:12px;font-family:Arial,sans-serif;font-size:13px;color:#e8b4b4">${isEs?'Video afectado':'Affected video'}: "${videoDesc}"</div>` : ''}
  </td></tr>
  <tr><td style="padding:22px 32px 8px">
    <a href="${BASE_URL}/terms.html" style="display:inline-block;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;text-decoration:none;padding:13px 28px;border-radius:12px;font-family:Arial,sans-serif;font-size:14px">${isEs?'Leer las normas de la comunidad':'Read community guidelines'}</a>
  </td></tr>
  ${footer()}`;
  return wrap(rows);
}

function buildAdminMessageEmail(opts) {
  const { userName, title, body, lang } = opts;
  const isEs = lang !== 'en';
  const rows = `
  ${header()}
  <tr><td style="padding:36px 32px 8px">
    <div style="font-size:40px;margin:0 0 14px">✉️</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#fff;line-height:1.25;margin:0 0 16px">${title}</div>
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#c9d4e3;line-height:1.7;margin:0 0 16px">${isEs ? 'Hola' : 'Hi'} ${userName || ''},</div>
    <div style="padding:18px 20px;background:rgba(34,88,168,.12);border:1px solid rgba(34,88,168,.35);border-left:3px solid #2258a8;border-radius:12px;font-family:Arial,sans-serif;font-size:15px;color:#dde6f2;line-height:1.75">${(body || '').replace(/\n/g, '<br>')}</div>
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#8a97a8;margin:18px 0 0">— ${isEs ? 'El equipo de Ximvid' : 'The Ximvid team'}</div>
  </td></tr>
  <tr><td style="padding:24px 32px 8px">
    <a href="${BASE_URL}/feed.html" style="display:inline-block;background:#f0b429;color:#1a1a1a;text-decoration:none;padding:13px 30px;border-radius:12px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold">${isEs ? 'Abrir Ximvid' : 'Open Ximvid'}</a>
  </td></tr>
  ${footer()}`;
  return wrap(rows);
}
module.exports = { buildEmail: buildWelcomeEmail, buildWelcomeEmail, buildCtaEmail, buildWeeklyEmail, buildInviteEmail, buildWarningEmail, buildAdminMessageEmail, IMGS };
