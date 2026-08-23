const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ximvid-c8627' });
const db = admin.firestore();
const USERNAME = process.argv[2];
const VALOR = process.argv[3] === 'true';
(async () => {
  const snap = await db.collection('users').where('username','==',USERNAME).limit(1).get();
  if (snap.empty) { console.log('Usuario no encontrado:', USERNAME); process.exit(1); }
  await snap.docs[0].ref.update({ isPremiumUser: VALOR });
  console.log(USERNAME, '-> isPremiumUser =', VALOR);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
