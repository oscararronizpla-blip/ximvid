require('dotenv').config({ path: __dirname + '/.env' });
const { buildInviteEmail } = require('./email-template');
const { sendEmail } = require('./mailer');
(async () => {
  const html = buildInviteEmail('Oscar');
  await sendEmail(process.env.GMAIL_USER, 'Descubre Ximvid — el buscador universal de creadores', html);
  console.log('Muestra de invitacion enviada a', process.env.GMAIL_USER);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
