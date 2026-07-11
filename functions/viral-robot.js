/**
 * XIMVID — viral-robot.js
 * Robot nocturno: inserta videos de Pexels como contenido seed.
 * Respeta config/robot (toggle activo, videosPorDia, categorias, maxMB).
 * La compresion la hace onVideoUploaded automaticamente.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('crypto');

const db = admin.firestore();
const ROBOT_UID = 'bRM9oA0FENSE6hwYyS0CnFbBNHB3';

const CATS = {
  'Viajes':     { queries: ['travel beach','mountain landscape','road trip','tropical island','city travel'], desES: ['Rincones del mundo que enamoran ✈️','Destinos que quitan el aliento 🌍','Viajar es vivir dos veces ✈️'], desEN: ['Corners of the world to fall in love with ✈️','Breathtaking destinations 🌍','To travel is to live twice ✈️'], tags: ['viajes','travel','mundo','wanderlust'] },
  'Comida':     { queries: ['cooking food','street food','dessert','coffee','healthy food'], desES: ['Sabores que conquistan 🍜','Cocina que enamora 🍳','Un bocado de felicidad 🧁'], desEN: ['Flavors that win you over 🍜','Cooking to fall in love with 🍳','A bite of happiness 🧁'], tags: ['comida','food','foodie','recetas'] },
  'Deporte':    { queries: ['fitness workout','running','yoga','gym training','extreme sport'], desES: ['Entrena duro, vive mejor 💪','Sin excusas, solo resultados 🏃','El limite lo pones tu 🔥'], desEN: ['Train hard, live better 💪','No excuses, only results 🏃','You set the limit 🔥'], tags: ['deporte','fitness','sport','motivacion'] },
  'Naturaleza': { queries: ['nature forest','ocean waves','waterfall','wildlife','sunset nature'], desES: ['La naturaleza en estado puro 🌿','Momentos que calman el alma 🌊','El planeta es un espectaculo 🌍'], desEN: ['Nature in its purest form 🌿','Moments that soothe the soul 🌊','The planet is a show 🌍'], tags: ['naturaleza','nature','relax','tierra'] },
  'Urbano':     { queries: ['city street night','urban lifestyle','skyline','traffic timelapse','street art'], desES: ['La ciudad nunca duerme 🏙️','Ritmo urbano 🌃','Historias de asfalto 🚦'], desEN: ['The city never sleeps 🏙️','Urban rhythm 🌃','Asphalt stories 🚦'], tags: ['urbano','city','street','nightlife'] },
  'Lifestyle':  { queries: ['lifestyle fashion','friends fun','home decor','music party','art creative'], desES: ['Vive a tu manera ✨','Pequenos momentos, grandes recuerdos 💫','Estilo es actitud 😎'], desEN: ['Live your way ✨','Small moments, big memories 💫','Style is attitude 😎'], tags: ['lifestyle','vida','style','mood'] }
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function newId() { return crypto.randomBytes(10).toString('hex'); }

async function uploadBuffer(bucket, buf, path, contentType) {
  const t = crypto.randomUUID();
  await bucket.file(path).save(buf, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: t } } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${t}`;
}

async function insertOne(bucket, cat, conf, robotUser, maxMB, hoursAgo) {
  const c = CATS[cat];
  const q = pick(c.queries);
  const page = 1 + Math.floor(Math.random() * 5);
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=15&page=${page}`, { headers: { Authorization: process.env.PEXELS_KEY } });
  if (!res.ok) throw new Error('Pexels ' + res.status);
  const data = await res.json();
  for (const v of (data.videos || [])) {
    const dup = await db.collection('videos').where('pexelsId', '==', v.id).limit(1).get();
    if (!dup.empty) continue;
    const file = (v.video_files || []).find(f => f.width < f.height && f.height >= 900 && f.height <= 1400 && f.file_type === 'video/mp4');
    if (!file) continue;
    const vidBuf = Buffer.from(await (await fetch(file.link)).arrayBuffer());
    if (vidBuf.length > maxMB * 1024 * 1024) continue;
    const thBuf = Buffer.from(await (await fetch(v.image)).arrayBuffer());
    const videoId = newId();
    const base = `videos/${ROBOT_UID}/${videoId}`;
    const videoURL = await uploadBuffer(bucket, vidBuf, `${base}/video.mp4`, 'video/mp4');
    const thumbnailURL = await uploadBuffer(bucket, thBuf, `${base}/thumb.jpg`, 'image/jpeg');
    const created = new Date(Date.now() - hoursAgo * 3600 * 1000);
    const i = Math.floor(Math.random() * c.desES.length);
    await db.collection('videos').add({
      userId: ROBOT_UID,
      username: robotUser.username || 'ximvid',
      userLanguage: 'es',
      videoURL, thumbnailURL,
      intention: 'creating_content',
      description: c.desES[i],
      descriptionEn: c.desEN[i],
      hashtags: c.tags,
      duration: Math.min(Math.round(v.duration || 30), 90),
      views: 0, actionClicks: 0, shareClicks: 0,
      isActive: true,
      createdAt: admin.firestore.Timestamp.fromDate(created),
      lat: null, lng: null,
      category: cat,
      isSeed: true,
      pexelsId: v.id,
      moderationStatus: 'approved',
      moderatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return v.id;
  }
  return null;
}

async function runRobot() {
  const confSnap = await db.collection('config').doc('robot').get();
  const conf = confSnap.exists ? confSnap.data() : {};
  if (!conf.activo) { console.log('Robot APAGADO, no hago nada.'); return 'apagado'; }

  const bucket = admin.storage().bucket();
  const cats = (conf.categorias || Object.keys(CATS)).filter(c => CATS[c]);
  const total = Math.min(conf.videosPorDia || 12, 50);
  const maxMB = conf.maxMB || 25;

  const ru = await db.collection('users').doc(ROBOT_UID).get();
  if (!ru.exists) { console.error('No existe la cuenta robot'); return 'sin cuenta robot'; }
  const robotUser = ru.data();

  let ok = 0, fail = 0;
  for (let n = 0; n < total; n++) {
    const cat = cats[n % cats.length];
    try {
      const id = await insertOne(bucket, cat, conf, robotUser, maxMB, Math.random() * 20);
      if (id) { ok++; console.log('OK', cat, id); } else { console.log('sin candidato', cat); }
    } catch (e) { fail++; console.error(cat, e.message); }
    await new Promise(r => setTimeout(r, 2000));
  }
  const result = `${ok} insertados, ${fail} errores — ${new Date().toISOString()}`;
  await db.collection('config').doc('robot').update({
    ultimaEjecucion: admin.firestore.FieldValue.serverTimestamp(),
    ultimoResultado: result
  });
  console.log('FIN:', result);
  return result;
}

exports.viralRobotNightly = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('0 3 * * *')
  .timeZone('Europe/Madrid')
  .onRun(runRobot);

// Ejecucion manual desde el panel (solo admins)
exports.viralRobotRunNow = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login requerido');
    const u = await db.collection('users').doc(context.auth.uid).get();
    if (!u.exists || u.data().isAdmin !== true) throw new functions.https.HttpsError('permission-denied', 'Solo admins');
    const result = await runRobot();
    return { result };
  });
