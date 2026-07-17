const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ximvid-c8627' });
const auth = admin.auth();
const db = admin.firestore();

const EMAIL = 'revision.play@ximvidapp.com';
const PASS  = 'RevisionXimvid2026';

(async () => {
  let uid;
  try {
    const u = await auth.createUser({ email: EMAIL, password: PASS, emailVerified: true });
    uid = u.uid;
    console.log('Usuario Auth creado:', uid);
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail(EMAIL);
      uid = u.uid;
      await auth.updateUser(uid, { password: PASS, emailVerified: true });
      console.log('Usuario ya existia, contrasena actualizada:', uid);
    } else { throw e; }
  }

  await db.collection('users').doc(uid).set({
    uid: uid,
    email: EMAIL,
    name: 'Revisor Play',
    username: 'revisionplay',
    language: 'es',
    isPremium: false,
    userType: 'creator',
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('Doc de usuario creado/actualizado.');
  console.log('---');
  console.log('EMAIL:', EMAIL);
  console.log('PASS :', PASS);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
