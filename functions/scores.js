const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

const DEFAULTS = {
  cuotaArranque: 30,
  pesoEngagement: 50,
  impulsoInicialActivo: false,
  impulsoInicialVistas: 4000,
};

async function leerConfig() {
  try {
    const snap = await db.collection('config').doc('algoritmo').get();
    return Object.assign({}, DEFAULTS, snap.exists ? snap.data() : {});
  } catch (e) {
    return DEFAULTS;
  }
}

// Frescura: 100 puntos hoy, decae hasta 0 en 30 dias
function frescura(createdAt) {
  if (!createdAt || !createdAt.toDate) return 0;
  const dias = (Date.now() - createdAt.toDate().getTime()) / 86400000;
  if (dias < 0) return 100;
  if (dias > 30) return 0;
  return Math.round(100 * (1 - dias / 30));
}

async function calcular() {
  const cfg = await leerConfig();
  const hace30 = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 86400000);

  const snap = await db.collection('videos')
    .where('isActive', '==', true)
    .where('createdAt', '>=', hace30)
    .get();

  if (snap.empty) {
    console.log('Sin videos que puntuar');
    return { total: 0 };
  }

  // Interacciones unicas por video
  const interSnap = await db.collection('interactions').get();
  const porVideo = {};
  interSnap.docs.forEach(d => {
    const v = d.data();
    if (!v.videoId) return;
    porVideo[v.videoId] = (porVideo[v.videoId] || 0) + (v.count || 1);
  });

  let batch = db.batch();
  let n = 0, escritos = 0;

  for (const doc of snap.docs) {
    const v = doc.data();
    const vistas = v.views || 0;
    const inter = porVideo[doc.id] || 0;
    const fresh = frescura(v.createdAt);

    let score;
    let enGracia = false;
    const esSeed = v.isSeed === true;

    if (esSeed) {
      // Los seeds del robot son relleno: sin periodo de gracia ni impulso.
      // Solo puntuan por frescura + engagement real (que sera ~0).
      const engSeed = vistas > 0 ? (inter / vistas) : 0;
      score = Math.round(engSeed * cfg.pesoEngagement * 100 + fresh * 0.5);
    } else if (vistas < cfg.cuotaArranque) {
      // Periodo de gracia: prioridad para que arranque
      enGracia = true;
      score = 100 + fresh;
    } else if (cfg.impulsoInicialActivo && vistas < cfg.impulsoInicialVistas) {
      // Impulso inicial (toggle del panel): empuja hasta N vistas
      enGracia = true;
      score = 120 + fresh;
    } else {
      const engagement = vistas > 0 ? (inter / vistas) : 0;
      score = Math.round(engagement * cfg.pesoEngagement * 100 + fresh);
    }

    batch.update(doc.ref, {
      score: score,
      scoreEngagement: vistas > 0 ? Math.round((inter / vistas) * 1000) / 10 : 0,
      scoreEnGracia: enGracia,
      scoreAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    n++; escritos++;

    if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();

  console.log('Scores calculados:', escritos, 'videos');
  await db.collection('config').doc('algoritmo').set({
    ultimoCalculo: admin.firestore.FieldValue.serverTimestamp(),
    ultimoCalculoVideos: escritos,
  }, { merge: true });

  return { total: escritos };
}

exports.calcularScoresHourly = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 * * * *')
  .timeZone('Europe/Madrid')
  .onRun(async () => { await calcular(); return null; });

exports.calcularScoresNow = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login requerido');
    const u = await db.collection('users').doc(context.auth.uid).get();
    if (!u.exists || !u.data().isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Solo admin');
    }
    return await calcular();
  });
