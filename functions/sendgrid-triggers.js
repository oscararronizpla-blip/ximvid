const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const APP_URL = 'https://humanvalue.pages.dev';

// ─── DEEP LINKS DINÁMICOS ────────────────────────────────────────────────────
// La app es una SPA con estados internos (step/currentScreen).
// Los deep links usan ?screen= y ?action= para redirigir tras el login.
//
//   screen=profile                     → pantalla de perfil propio
//   screen=profile&action=edit-video   → perfil + abre modal subir vídeo
//   screen=profile&action=edit-profile → perfil + abre modal editar perfil
//   screen=profile&action=actor        → perfil + abre modal del actor
//
const getDeepLinks = () => ({
  // Bienvenida → perfil para completarlo
  profile:   `${APP_URL}?screen=profile&action=edit-profile`,
  // Email semanal → perfil + abre directamente el modal de subir vídeo
  editVideo: `${APP_URL}?screen=profile&action=edit-video`,
  // Actor → perfil + abre directamente el modal del actor asignado
  actor:     `${APP_URL}?screen=profile&action=actor`,
});
// ────────────────────────────────────────────────────────────────────────────

const translations = {
  es: {
    welcome: {
      subject: '🎉 ¡Bienvenido a HumanValue!',
      title: '¡Hola {name}! 👋',
      intro: 'Bienvenido a <strong>HumanValue</strong>, la plataforma donde descubres cómo te ven los demás en los aspectos que te definen como humano. Todo es <strong>completamente anónimo</strong> para que puedas recibir feedback honesto y mejorar.',
      stepsTitle: '🎯 Primeros pasos',
      step1: 'Completa tu perfil con foto y biografía',
      step2: 'Valora a otros usuarios de tu país',
      step3: 'Descubre tu perfil psicológico',
      step4: 'Encuentra tu actor parecido',
      step5: 'Las empresas valoran más al humano que el titulitis',
      button: 'COMPLETAR MI PERFIL',
      footer: 'Este es un email automático de HumanValue. Si tienes preguntas, responde a este email.'
    },
    weeklyRatings: {
      subject: '🎉 ¡Enhorabuena! Tienes nuevas valoraciones en HumanValue',
      title: '¡Felicidades {name}! 🌟',
      intro: 'Has recibido <strong>nuevas valoraciones</strong> esta semana en HumanValue.',
      congratsTitle: '¡Enhorabuena por tu éxito!',
      congratsText: 'Tu perfil está generando mucho interés y varios usuarios te han valorado. Esto demuestra el <strong>seguimiento y reconocimiento</strong> que estás consiguiendo en la plataforma.',
      updateTitle: '💡 Mejora tu visibilidad',
      updateText: 'Actualiza tu video ahora para mostrar tus mejoras. Todos los que te han valorado recibirán una <strong>notificación automática</strong> de que has actualizado tu contenido, y podrán volverte a valorar para ayudarte a crecer.',
      visionText: '<strong>Esto es imprescindible para tener visión</strong> de cómo progresas y cómo te ven los demás.',
      button: 'ACTUALIZAR MI VIDEO',
      footer: 'Sigue mejorando y compartiendo tu progreso. ¡La comunidad te está apoyando!'
    },
    actor: {
      subject: '🎭 ¡Descubre tu actor parecido!',
      title: '¡Tienes un actor parecido! 🎬',
      intro: 'Hola <strong>{name}</strong>,',
      text: 'Basado en tu perfil psicológico y las valoraciones que has recibido, hemos encontrado tu actor parecido:',
      whyTitle: '¿Por qué este actor?',
      button: 'VER MI ACTOR EN LA APP',
      footer: '¿Qué te parece tu actor parecido? ¡Comparte tu perfil con amigos!'
    }
  },
  en: {
    welcome: {
      subject: '🎉 Welcome to HumanValue!',
      title: 'Hello {name}! 👋',
      intro: 'Welcome to <strong>HumanValue</strong>, the platform where you discover how others see you in the aspects that define you as a human. Everything is <strong>completely anonymous</strong> so you can receive honest feedback and improve.',
      stepsTitle: '🎯 First steps',
      step1: 'Complete your profile with photo and bio',
      step2: 'Rate other users from your country',
      step3: 'Discover your psychological profile',
      step4: 'Find your similar actor',
      step5: 'Companies value the human more than degrees',
      button: 'COMPLETE MY PROFILE',
      footer: 'This is an automated email from HumanValue. If you have questions, reply to this email.'
    },
    weeklyRatings: {
      subject: '🎉 Congratulations! You have new ratings on HumanValue',
      title: 'Congratulations {name}! 🌟',
      intro: 'You have received <strong>new ratings</strong> this week on HumanValue.',
      congratsTitle: 'Congratulations on your success!',
      congratsText: 'Your profile is generating a lot of interest and several users have rated you. This shows the <strong>following and recognition</strong> you are achieving on the platform.',
      updateTitle: '💡 Improve your visibility',
      updateText: 'Update your video now to showcase your improvements. Everyone who rated you will receive an <strong>automatic notification</strong> that you\'ve updated your content, and they can rate you again to help you grow.',
      visionText: '<strong>This is essential to have vision</strong> of how you progress and how others see you.',
      button: 'UPDATE MY VIDEO',
      footer: 'Keep improving and sharing your progress. The community is supporting you!'
    },
    actor: {
      subject: '🎭 Discover your similar actor!',
      title: 'You have a similar actor! 🎬',
      intro: 'Hello <strong>{name}</strong>,',
      text: 'Based on your psychological profile and the ratings you\'ve received, we found your similar actor:',
      whyTitle: 'Why this actor?',
      button: 'SEE MY ACTOR IN THE APP',
      footer: 'What do you think about your similar actor? Share your profile with friends!'
    }
  },
  zh: {
    welcome: {
      subject: '🎉 欢迎来到 HumanValue！',
      title: '你好 {name}！👋',
      intro: '欢迎来到 <strong>HumanValue</strong>，这个平台让你发现别人如何看待定义你为人的方面。一切都是<strong>完全匿名</strong>的，让你可以收到诚实的反馈并改进。',
      stepsTitle: '🎯 首要步骤',
      step1: '完善你的个人资料，包括照片和简介',
      step2: '评价来自你国家的其他用户',
      step3: '发现你的心理档案',
      step4: '找到与你相似的演员',
      step5: '企业更看重人性而非学历',
      button: '完善我的资料',
      footer: '这是来自 HumanValue 的自动邮件。如有疑问，请回复此邮件。'
    },
    weeklyRatings: {
      subject: '🎉 恭喜！你在 HumanValue 上有新的评价',
      title: '恭喜 {name}！🌟',
      intro: '本周你在 HumanValue 上收到了<strong>新的评价</strong>。',
      congratsTitle: '恭喜你取得成功！',
      congratsText: '你的个人资料引起了很多关注，多位用户对你进行了评价。这表明你在平台上获得的<strong>关注和认可</strong>。',
      updateTitle: '💡 提高你的可见度',
      updateText: '现在更新你的视频以展示你的进步。所有评价过你的人都会收到<strong>自动通知</strong>，告知你已更新内容，他们可以再次评价你以帮助你成长。',
      visionText: '<strong>这对于了解</strong>你的进步以及别人如何看待你至关重要。',
      button: '更新我的视频',
      footer: '继续改进并分享你的进步。社区在支持你！'
    },
    actor: {
      subject: '🎭 发现与你相似的演员！',
      title: '你有一个相似的演员！🎬',
      intro: '你好 <strong>{name}</strong>，',
      text: '根据你的心理档案和收到的评价，我们找到了与你相似的演员：',
      whyTitle: '为什么是这位演员？',
      button: '在应用中查看我的演员',
      footer: '你觉得与你相似的演员如何？与朋友分享你的档案吧！'
    }
  }
};

const getBaseTemplate = (content, lang = 'es') => {
  const taglines = {
    es: 'Descubre cómo te ven los demás',
    en: 'Discover how others see you',
    zh: '发现别人如何看待你'
  };
  
  const footerTexts = {
    es: { follow: 'Síguenos en', rights: 'Todos los derechos reservados.', privacy: 'Política de Privacidad', terms: 'Términos de Uso' },
    en: { follow: 'Follow us on', rights: 'All rights reserved.', privacy: 'Privacy Policy', terms: 'Terms of Use' },
    zh: { follow: '关注我们', rights: '版权所有。', privacy: '隐私政策', terms: '使用条款' }
  };
  
  const ft = footerTexts[lang];
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HumanValue</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
              <tr>
                <td align="center" style="padding: 30px;">
                  <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">HumanValue</h1>
                  <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${taglines[lang]}</p>
                </td>
              </tr>
            </table>
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px;">${content}</td>
              </tr>
            </table>
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #f8f9fa; border-radius: 0 0 16px 16px;">
              <tr>
                <td align="center" style="padding: 30px 40px;">
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; line-height: 1.6;">${ft.follow}:</p>
                  <p style="margin: 0 0 20px 0;">
                    <a href="https://instagram.com/humanvalue" style="color: #fe2c55; text-decoration: none; margin: 0 10px;">Instagram</a>
                    <a href="https://facebook.com/humanvalue" style="color: #fe2c55; text-decoration: none; margin: 0 10px;">Facebook</a>
                    <a href="https://twitter.com/humanvalue" style="color: #fe2c55; text-decoration: none; margin: 0 10px;">Twitter</a>
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">© 2026 HumanValue. ${ft.rights}</p>
                  <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">
                    <a href="https://humanvalueapp.com/privacy.html" style="color: #999; text-decoration: none;">${ft.privacy}</a> | 
                    <a href="https://humanvalueapp.com/terms.html" style="color: #999; text-decoration: none;">${ft.terms}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const getButton = (text, url) => {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 30px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #fe2c55 0%, #ff6b6b 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 30px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(254, 44, 85, 0.3);">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. EMAIL DE BIENVENIDA
//    Botón → lleva al usuario directamente a su perfil para que lo complete
// ─────────────────────────────────────────────────────────────────────────────
exports.sendWelcomeEmail = onDocumentCreated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const user = event.data.data();
  const lang = user.language || 'es';
  const t = translations[lang].welcome;

  // Deep link: perfil propio del usuario recién creado
  const { profile } = getDeepLinks();

  const content = `
    <h1 style="color: #333; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">${t.title.replace('{name}', user.name)}</h1>
    <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">${t.intro}</p>
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin: 30px 0;">
      <h2 style="color: white; font-size: 22px; margin: 0 0 20px 0; font-weight: 600;">${t.stepsTitle}</h2>
      <ul style="color: white; font-size: 16px; line-height: 2; margin: 0; padding-left: 20px;">
        <li>${t.step1}</li>
        <li>${t.step2}</li>
        <li>${t.step3}</li>
        <li>${t.step4}</li>
        <li>${t.step5}</li>
      </ul>
    </div>
    ${getButton(t.button, profile)}
    <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #eee;">${t.footer}</p>
  `;
  
  const msg = {
    to: user.email,
    from: { email: 'noreply@humanvalueapp.com', name: 'HumanValue' },
    subject: t.subject,
    html: getBaseTemplate(content, lang)
  };
  
  try {
    await sgMail.send(msg);
    console.log('✅ Email de bienvenida enviado a:', user.email, '→', profile);
  } catch (error) {
    console.error('❌ Error enviando email:', error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EMAIL SEMANAL DE VALORACIONES
//    Botón → lleva al usuario directamente a editar su vídeo
// ─────────────────────────────────────────────────────────────────────────────
exports.sendWeeklyRatingsEmail = onSchedule({
  schedule: 'every friday 09:00',
  timeZone: 'Europe/Madrid'
}, async (event) => {
  
  const usersSnapshot = await admin.firestore().collection('users').get();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const userId = userDoc.id;
    const lang = user.language || 'es';
    const t = translations[lang].weeklyRatings;

    const ratingsSnapshot = await admin.firestore()
      .collection('users').doc(userId).collection('ratings')
      .where('createdAt', '>=', oneWeekAgo).get();
    
    if (ratingsSnapshot.empty) continue;

    // Deep link: sección de edición de vídeo del usuario concreto
    const { editVideo } = getDeepLinks();
    
    const content = `
      <h1 style="color: #333; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">${t.title.replace('{name}', user.name)}</h1>
      <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 30px 0;">${t.intro}</p>
      <div style="background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%); padding: 35px; border-radius: 16px; margin: 30px 0; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 15px;">🎉</div>
        <h2 style="color: white; font-size: 26px; margin: 0 0 15px 0; font-weight: bold;">${t.congratsTitle}</h2>
        <p style="color: rgba(255,255,255,0.95); font-size: 16px; line-height: 1.8; margin: 0;">${t.congratsText}</p>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; margin: 30px 0;">
        <h3 style="color: #fe2c55; font-size: 22px; margin: 0 0 15px 0; font-weight: 600;">${t.updateTitle}</h3>
        <p style="margin: 0 0 15px 0; color: #555; font-size: 16px; line-height: 1.8;">${t.updateText}</p>
        <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.8;">${t.visionText}</p>
      </div>
      ${getButton(t.button, editVideo)}
      <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #eee;">${t.footer}</p>
    `;
    
    const msg = {
      to: user.email,
      from: { email: 'noreply@humanvalueapp.com', name: 'HumanValue' },
      subject: t.subject,
      html: getBaseTemplate(content, lang)
    };
    
    try {
      await sgMail.send(msg);
      console.log('✅ Email semanal enviado a:', user.email, '→', editVideo);
    } catch (error) {
      console.error('❌ Error enviando email semanal:', error);
    }
  }
  
  console.log('✅ Proceso de emails semanales completado');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. NOTIFICACIÓN DE ACTOR ASIGNADO
//    Botón → lleva al usuario directamente a la ficha de su actor
// ─────────────────────────────────────────────────────────────────────────────
exports.sendActorNotification = onCall(async (request) => {
  const { userId, actorData } = request.data;
  
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const user = userDoc.data();
  const lang = user.language || 'es';
  const t = translations[lang].actor;

  // Deep link: ficha del actor concreto asignado al usuario
  const { actor: actorUrl } = getDeepLinks();

  const content = `
    <h1 style="color: #333; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">${t.title}</h1>
    <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 10px 0;">${t.intro.replace('{name}', user.name)}</p>
    <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 30px 0;">${t.text}</p>
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 16px; margin: 30px 0; text-align: center;">
      <img src="${actorData.actorImage}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 16px; margin-bottom: 20px; border: 4px solid white; box-shadow: 0 8px 24px rgba(0,0,0,0.2);" />
      <h2 style="margin: 10px 0; color: white; font-size: 32px; font-weight: bold;">${actorData.actor}</h2>
      <h3 style="margin: 5px 0; color: rgba(255,255,255,0.9); font-size: 20px; font-weight: normal;">${actorData.movie}</h3>
    </div>
    <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; margin: 30px 0;">
      <h3 style="color: #fe2c55; font-size: 20px; margin: 0 0 15px 0; font-weight: 600;">${t.whyTitle}</h3>
      <p style="margin: 0; color: #555; font-size: 16px; line-height: 1.8;">${actorData.reason}</p>
    </div>
    ${getButton(t.button, actorUrl)}
    <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #eee;">${t.footer}</p>
  `;
  
  const msg = {
    to: user.email,
    from: { email: 'noreply@humanvalueapp.com', name: 'HumanValue' },
    subject: t.subject,
    html: getBaseTemplate(content, lang)
  };
  
  await sgMail.send(msg);
  console.log('✅ Email de actor enviado a:', user.email, '→', actorUrl);
  return { success: true };
});
