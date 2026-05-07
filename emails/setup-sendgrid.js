/**
 * XIMVID — setup-sendgrid.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 6: Configura SendGrid con todos los templates de email.
 * Los 10 emails automáticos de la app.
 *
 * Ejecutar: node setup-sendgrid.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL       = process.env.SENDGRID_FROM_EMAIL || 'noreply@ximvid.com';
const FROM_NAME        = process.env.SENDGRID_FROM_NAME  || 'Ximvid';
const APP_URL          = 'https://app.ximvid.com';
const MARKETING_URL    = 'https://ximvid.com';

if (!SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY no encontrada en .env');
  process.exit(1);
}

// ─── Helper: llamada a la API de SendGrid ─────────────────────────
async function sgApi(method, endpoint, body = null) {
  const res = await fetch(`https://api.sendgrid.com/v3${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid ${method} ${endpoint}: ${res.status} — ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── CSS base compartido por todos los emails ─────────────────────
const BASE_STYLES = `
  body { margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrap { max-width:560px; margin:0 auto; background:#ffffff; }
  .header { background:#111111; padding:28px 32px; text-align:center; }
  .header img { height:32px; }
  .body { padding:32px; }
  .footer { background:#f5f5f5; padding:20px 32px; text-align:center; font-size:12px; color:#999; }
  .footer a { color:#999; text-decoration:none; }
  h1 { font-size:22px; font-weight:500; color:#111; margin:0 0 12px; }
  p { font-size:15px; color:#444; line-height:1.6; margin:0 0 16px; }
  .btn {
    display:inline-block; background:#ff4d6d; color:#ffffff !important;
    padding:14px 28px; border-radius:10px; font-size:15px;
    font-weight:500; text-decoration:none; margin:8px 0;
    box-shadow:0 4px 16px rgba(255,77,109,0.35);
  }
  .metric { background:#f9f9f9; border-radius:10px; padding:16px 20px; margin:8px 0; }
  .metric .num { font-size:28px; font-weight:500; color:#111; }
  .metric .label { font-size:13px; color:#888; margin-top:2px; }
  .row { display:flex; gap:8px; margin:8px 0; }
  .row .metric { flex:1; }
  .network-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0; }
  .network-row:last-child { border-bottom:none; }
  .network-name { font-size:14px; color:#444; }
  .network-count { font-size:14px; font-weight:500; color:#111; }
  .trend-up   { color:#22c55e; }
  .trend-down { color:#ef4444; }
  .video-card { background:#f9f9f9; border-radius:10px; overflow:hidden; margin:16px 0; }
  .video-card img { width:100%; height:160px; object-fit:cover; }
  .video-card-body { padding:12px 16px; }
  .divider { height:1px; background:#f0f0f0; margin:20px 0; }
  .highlight { background:#fff8f9; border-left:3px solid #ff4d6d; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; }
`;

// ─── Función helper para crear templates HTML completos ───────────
function emailTemplate(content) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_STYLES}</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <img src="https://cdn.ximvid.com/assets/brand/logo-white.png" alt="Ximvid">
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p>
      © ${new Date().getFullYear()} Ximvid ·
      <a href="${APP_URL}/privacy">Privacidad</a> ·
      <a href="${APP_URL}/terms">Términos</a>
    </p>
    <p>
      <a href="{{unsubscribe_url}}">Darse de baja de notificaciones por email</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

// ─── Los 10 templates ────────────────────────────────────────────
const EMAIL_TEMPLATES = [

  // ── EMAIL 1 — Bienvenida ──────────────────────────────────────
  {
    key:     'email_welcome',
    name:    '[Ximvid] EMAIL 1 — Bienvenida',
    subject: 'Bienvenido a Ximvid — Tu perfil está listo',
    html: emailTemplate(`
      <h1>¡Hola, {{name}}! 👋</h1>
      <p>Tu cuenta en Ximvid está lista. Ahora cada video que subas puede convertirse en clientes, seguidores en todas tus redes y visitas a tu web — al mismo tiempo.</p>
      <p>Para empezar a crecer, completa estos 3 pasos:</p>
      <div class="metric">
        <div class="num">1</div>
        <div class="label">Sube tu primer video — puede ser uno que ya tengas en TikTok o Instagram</div>
      </div>
      <div class="metric">
        <div class="num">2</div>
        <div class="label">Configura tu botón de acción — la URL donde quieres que vayan tus clientes</div>
      </div>
      <div class="metric">
        <div class="num">3</div>
        <div class="label">Añade tus redes sociales — para que cada visitante pueda seguirte de un toque</div>
      </div>
      <div style="text-align:center;margin-top:28px;">
        <a class="btn" href="${APP_URL}/{{username}}">Ver mi perfil</a>
      </div>
      <div class="divider"></div>
      <p style="font-size:13px;color:#888;">Tu URL personal es <strong>${APP_URL}/{{username}}</strong> — compártela en todas tus redes.</p>
    `),
  },

  // ── EMAIL 2 — Perfil completado ───────────────────────────────
  {
    key:     'email_profile_complete',
    name:    '[Ximvid] EMAIL 2 — Perfil completado',
    subject: 'Tu perfil está completo — Empieza a crecer',
    html: emailTemplate(`
      <h1>Tu perfil está completo ✅</h1>
      <p>Ya tienes todo configurado, <strong>{{name}}</strong>. A partir de ahora, cada persona que vea tus videos puede:</p>
      <div class="highlight">
        ✦ Seguirte en todas tus redes con un solo toque<br>
        ✦ Contactarte directamente<br>
        ✦ Comprar o contratar lo que ofreces
      </div>
      <p>Tu URL personal para compartir en cualquier sitio:</p>
      <div class="metric" style="text-align:center;">
        <div class="num" style="font-size:18px;word-break:break-all;">${APP_URL}/{{username}}</div>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="${APP_URL}/{{username}}">Ver mi perfil completo</a>
      </div>
    `),
  },

  // ── EMAIL 3 — Alguien pulsó tu botón CTA ─────────────────────
  {
    key:     'email_action_click',
    name:    '[Ximvid] EMAIL 3 — Clic en botón de acción',
    subject: '¡Alguien está interesado en lo que ofreces!',
    html: emailTemplate(`
      <h1>Tienes un nuevo interesado 🔥</h1>
      <p>Alguien acaba de pulsar tu botón <strong>"{{actionButtonText}}"</strong> en uno de tus videos y ha sido redirigido a tu enlace de destino.</p>
      <div class="video-card">
        <img src="{{thumbnailURL}}" alt="Video">
        <div class="video-card-body">
          <p style="margin:0;font-size:14px;color:#888;">Este video generó el clic</p>
          <div style="display:flex;justify-content:space-between;margin-top:8px;">
            <span style="font-size:13px;color:#444;">{{videoViews}} visualizaciones hoy</span>
            <span style="font-size:13px;color:#ff4d6d;font-weight:500;">{{totalClicksToday}} clics hoy</span>
          </div>
        </div>
      </div>
      <div class="metric">
        <div class="label">URL destino</div>
        <div style="font-size:13px;color:#444;margin-top:4px;word-break:break-all;">{{actionButtonURL}}</div>
      </div>
      <div class="metric">
        <div class="label">Hora del clic</div>
        <div style="font-size:15px;color:#111;margin-top:4px;">{{clickedAt}}</div>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="ximvid://stats">Ver todas mis estadísticas</a>
      </div>
    `),
  },

  // ── EMAIL 4 — Alguien pulsó una red social ────────────────────
  {
    key:     'email_social_click',
    name:    '[Ximvid] EMAIL 4 — Clic en red social',
    subject: 'Alguien visitó tu {{networkLabel}} desde tu video',
    html: emailTemplate(`
      <h1>Nuevo visitante en tu {{networkLabel}} 👀</h1>
      <p>Alguien vio uno de tus videos en Ximvid y pulsó tu icono de <strong>{{networkLabel}}</strong>.</p>
      <div class="video-card">
        <img src="{{thumbnailURL}}" alt="Video">
        <div class="video-card-body">
          <p style="margin:0;font-size:14px;color:#888;">Desde este video</p>
        </div>
      </div>
      <div class="metric">
        <div class="label">Red social visitada</div>
        <div class="num" style="font-size:20px;margin-top:4px;">{{networkLabel}}</div>
      </div>
      <div class="metric">
        <div class="label">Hora</div>
        <div style="font-size:15px;color:#111;margin-top:4px;">{{clickedAt}}</div>
      </div>
      <p style="font-size:13px;color:#888;">Cada vez que alguien pulsa tus iconos de redes, Ximvid lo registra para que puedas ver qué red te genera más tráfico.</p>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="ximvid://stats/networks">Ver estadísticas por red</a>
      </div>
    `),
  },

  // ── EMAIL 5 — Nuevo seguidor ──────────────────────────────────
  {
    key:     'email_new_follower',
    name:    '[Ximvid] EMAIL 5 — Nuevo seguidor',
    subject: 'Tienes un nuevo seguidor en Ximvid',
    html: emailTemplate(`
      <h1>¡Nuevo seguidor! 🎉</h1>
      <p><strong>{{followerName}}</strong> te sigue ahora en Ximvid.</p>
      <div class="metric" style="display:flex;align-items:center;gap:16px;padding:16px;">
        <img src="{{followerPhoto}}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;" alt="">
        <div>
          <div style="font-size:16px;font-weight:500;color:#111;">{{followerName}}</div>
          <div style="font-size:13px;color:#888;">@{{followerUsername}}</div>
        </div>
      </div>
      <div class="metric" style="text-align:center;">
        <div class="label">Total de seguidores</div>
        <div class="num">{{totalFollowers}}</div>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="${APP_URL}/{{followerUsername}}">Ver perfil del seguidor</a>
      </div>
    `),
  },

  // ── EMAIL 6 — Resumen semanal ─────────────────────────────────
  {
    key:     'email_weekly_stats',
    name:    '[Ximvid] EMAIL 6 — Resumen semanal',
    subject: 'Tu resumen de la semana en Ximvid 📊',
    html: emailTemplate(`
      <h1>Tu semana en Ximvid</h1>
      <p style="color:#888;font-size:13px;">{{weekStart}} — {{weekEnd}}</p>

      <div class="row">
        <div class="metric">
          <div class="num">{{totalViews}}</div>
          <div class="label">Visualizaciones</div>
          <div style="font-size:12px;margin-top:4px;" class="{{viewsTrendClass}}">{{viewsTrend}}</div>
        </div>
        <div class="metric">
          <div class="num">{{totalActionClicks}}</div>
          <div class="label">Clics en botón</div>
          <div style="font-size:12px;margin-top:4px;" class="{{clicksTrendClass}}">{{clicksTrend}}</div>
        </div>
      </div>
      <div class="row">
        <div class="metric">
          <div class="num">{{totalLandingVisits}}</div>
          <div class="label">Visitas a tu perfil</div>
          <div style="font-size:12px;margin-top:4px;" class="{{landingTrendClass}}">{{landingTrend}}</div>
        </div>
        <div class="metric">
          <div class="num">{{newFollowers}}</div>
          <div class="label">Nuevos seguidores</div>
          <div style="font-size:12px;margin-top:4px;" class="{{followersTrendClass}}">{{followersTrend}}</div>
        </div>
      </div>

      <div class="divider"></div>

      <h2 style="font-size:16px;font-weight:500;color:#111;margin:0 0 12px;">Clics por red social</h2>
      <div>{{networkClicksRows}}</div>

      <div class="divider"></div>

      <h2 style="font-size:16px;font-weight:500;color:#111;margin:0 0 12px;">Tu mejor video esta semana</h2>
      <div class="video-card">
        <img src="{{topVideoThumbnail}}" alt="Top video">
        <div class="video-card-body">
          <div style="display:flex;justify-content:space-between;">
            <div>
              <div style="font-size:13px;color:#888;">Visualizaciones</div>
              <div style="font-size:18px;font-weight:500;color:#111;">{{topVideoViews}}</div>
            </div>
            <div>
              <div style="font-size:13px;color:#888;">Clics CTA</div>
              <div style="font-size:18px;font-weight:500;color:#111;">{{topVideoClicks}}</div>
            </div>
            <div>
              <div style="font-size:13px;color:#888;">Conversión</div>
              <div style="font-size:18px;font-weight:500;color:#ff4d6d;">{{topVideoConversion}}%</div>
            </div>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:28px;">
        <a class="btn" href="ximvid://stats">Ver estadísticas completas</a>
      </div>
    `),
  },

  // ── EMAIL 7 — Premium activado ────────────────────────────────
  {
    key:     'email_premium_activated',
    name:    '[Ximvid] EMAIL 7 — Premium activado',
    subject: 'Tu Plan Premium está activo ⭐',
    html: emailTemplate(`
      <h1>¡Tu Plan Premium está activo! ⭐</h1>
      <p>Hola <strong>{{name}}</strong>, tu suscripción ha sido procesada correctamente.</p>
      <div class="highlight">
        ✦ Tus videos tienen mayor visibilidad en el feed<br>
        ✦ Badge Premium en tu perfil y tus videos<br>
        ✦ Más personas descubren lo que ofreces
      </div>
      <div class="metric">
        <div class="label">Próxima renovación</div>
        <div style="font-size:16px;color:#111;margin-top:4px;">{{renewalDate}}</div>
      </div>
      <div class="metric">
        <div class="label">Importe</div>
        <div style="font-size:16px;color:#111;margin-top:4px;">{{amount}}/mes</div>
      </div>
      <p style="font-size:13px;color:#888;margin-top:20px;">Si en algún momento quieres cancelar, puedes hacerlo desde tu perfil en Ximvid → Configuración → Plan Premium. Tu plan seguirá activo hasta el final del período pagado.</p>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="ximvid://settings/premium">Gestionar mi plan</a>
      </div>
    `),
  },

  // ── EMAIL 8 — Premium cancelado ───────────────────────────────
  {
    key:     'email_premium_cancelled',
    name:    '[Ximvid] EMAIL 8 — Premium cancelado',
    subject: 'Tu Plan Premium ha sido cancelado',
    html: emailTemplate(`
      <h1>Plan Premium cancelado</h1>
      <p>Hola <strong>{{name}}</strong>, hemos recibido tu solicitud de cancelación.</p>
      <div class="metric">
        <div class="label">Tu plan sigue activo hasta</div>
        <div style="font-size:18px;font-weight:500;color:#111;margin-top:4px;">{{activeUntil}}</div>
      </div>
      <p>Hasta esa fecha seguirás teniendo mayor visibilidad en el feed y el badge Premium en tu perfil.</p>
      <div class="divider"></div>
      <p>Si fue un error o has cambiado de idea, puedes reactivar tu plan en cualquier momento.</p>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="ximvid://settings/premium">Reactivar Premium</a>
      </div>
    `),
  },

  // ── EMAIL 9 — Recordatorio completar perfil (48h) ─────────────
  {
    key:     'email_incomplete_profile',
    name:    '[Ximvid] EMAIL 9 — Recordatorio perfil incompleto (48h)',
    subject: 'Tu perfil está incompleto — Añade tus redes y empieza a crecer',
    html: emailTemplate(`
      <h1>Tu perfil está casi listo 👋</h1>
      <p>Hola <strong>{{name}}</strong>, vemos que aún no has añadido tus redes sociales a tu perfil de Ximvid.</p>
      <p>Sin ellas, las personas que vean tus videos no podrán seguirte en ninguna plataforma. Es el paso más importante para crecer.</p>
      <div class="highlight">
        Cada icono que añades es una puerta directa para que tus espectadores lleguen a donde ya tienes audiencia.
      </div>
      <p>Solo tienes que pegar la URL de tu perfil en cada red y ya aparecerán en todos tus videos automáticamente.</p>
      <div style="text-align:center;margin-top:28px;">
        <a class="btn" href="ximvid://profile/social-links">Añadir mis redes ahora</a>
      </div>
    `),
  },

  // ── EMAIL 10 — Primer video publicado ────────────────────────
  {
    key:     'email_first_video',
    name:    '[Ximvid] EMAIL 10 — Primer video publicado',
    subject: '¡Tu primer video está publicado! 🎬',
    html: emailTemplate(`
      <h1>¡Tu primer video ya está en Ximvid! 🎬</h1>
      <p>Hola <strong>{{name}}</strong>, tu video ya está visible para todo el mundo.</p>
      <div class="video-card">
        <img src="{{thumbnailURL}}" alt="Tu video">
        <div class="video-card-body">
          <p style="margin:0;font-size:14px;color:#444;">¡Ya está recibiendo visitas!</p>
        </div>
      </div>
      <p>Para conseguir tus primeras visualizaciones rápido, compártelo donde ya tienes audiencia:</p>
      <div class="highlight">
        ✦ Ponlo en tu historia de Instagram con el link a tu perfil<br>
        ✦ Menciónalo en tu bio de TikTok<br>
        ✦ Compártelo en tu grupo de WhatsApp más activo
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a class="btn" href="${APP_URL}/{{username}}">Ver mi perfil</a>
      </div>
      <p style="font-size:13px;color:#888;margin-top:20px;">Tu URL personal para compartir: <strong>${APP_URL}/{{username}}</strong></p>
    `),
  },
];

// ─── Crear todos los templates en SendGrid ────────────────────────
async function createTemplates() {
  console.log('\n📧 Creando templates en SendGrid...');

  // Obtener templates existentes para no duplicar
  const existing = await sgApi('GET', '/templates?generations=dynamic&page_size=100');
  const existingNames = (existing?.result || []).map(t => t.name);

  const templateIds = {};

  for (const tmpl of EMAIL_TEMPLATES) {
    if (existingNames.includes(tmpl.name)) {
      const found = existing.result.find(t => t.name === tmpl.name);
      console.log(`  ⏭  "${tmpl.name}" ya existe: ${found.id}`);
      templateIds[tmpl.key] = found.id;
      continue;
    }

    // Crear template
    const created = await sgApi('POST', '/templates', {
      name:       tmpl.name,
      generation: 'dynamic',
    });

    // Crear versión activa del template
    await sgApi('POST', `/templates/${created.id}/versions`, {
      template_id: created.id,
      name:        'v1',
      subject:     tmpl.subject,
      html_content: tmpl.html,
      plain_content: '{{name}}, tienes una nueva notificación de Ximvid.',
      active:      1,
    });

    templateIds[tmpl.key] = created.id;
    console.log(`  ✅ ${tmpl.name}: ${created.id}`);
  }

  return templateIds;
}

// ─── Guardar los Template IDs en un archivo de constantes ─────────
function saveTemplateIds(ids) {
  const content = `/**
 * XIMVID — src/constants/emailTemplates.js
 * IDs de los templates de SendGrid.
 * Generado automáticamente por setup-sendgrid.js
 * ⚠️ No editar manualmente — regenerar con: node setup-sendgrid.js
 */
export const EMAIL_TEMPLATE_IDS = ${JSON.stringify(ids, null, 2)};
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/constants/emailTemplates.js'),
    content
  );
  console.log('\n✅ src/constants/emailTemplates.js generado con los IDs');
}

// ─── Verificar dominio en SendGrid ───────────────────────────────
async function checkDomainVerification() {
  console.log('\n🔍 Verificando autenticación de dominio en SendGrid...');
  try {
    const domains = await sgApi('GET', '/whitelabel/domains');
    const ximvidDomain = (domains || []).find(d => d.domain === 'ximvid.com');

    if (!ximvidDomain) {
      console.log(`
  ⚠️  El dominio ximvid.com no está autenticado en SendGrid.
  
  Para autenticarlo:
  1. SendGrid Dashboard → Settings → Sender Authentication
  2. Authenticate Your Domain → ximvid.com
  3. SendGrid te dará registros CNAME para añadir en Cloudflare
  4. Vuelve a ejecutar: node setup-sendgrid.js para verificar
  
  Sin esto los emails pueden ir a spam.
`);
    } else if (!ximvidDomain.valid) {
      console.log('  ⚠️  Dominio pendiente de verificación — añade los CNAME en Cloudflare');
    } else {
      console.log('  ✅ Dominio ximvid.com verificado en SendGrid');
    }
  } catch {
    console.log('  ⚠️  No se pudo verificar el dominio — comprueba manualmente en SendGrid');
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════');
  console.log('  XIMVID — Configurando SendGrid');
  console.log('════════════════════════════════════════');

  await checkDomainVerification();
  const templateIds = await createTemplates();
  saveTemplateIds(templateIds);

  console.log(`
════════════════════════════════════════
  ✅ PASO 6 COMPLETADO
════════════════════════════════════════

Templates creados en SendGrid (10 emails):
  1. Bienvenida al registrarse
  2. Perfil completado
  3. Clic en botón de acción (CTA)
  4. Clic en red social
  5. Nuevo seguidor
  6. Resumen semanal (viernes 18:00)
  7. Premium activado
  8. Premium cancelado
  9. Recordatorio perfil incompleto (48h)
  10. Primer video publicado

Archivo generado:
  • src/constants/emailTemplates.js  (IDs de SendGrid)

Siguiente paso:
  node setup-sendgrid-triggers.js  (Firebase Functions para los triggers)
════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
