const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('crypto');

admin.initializeApp({ projectId: 'ximvid-c8627', storageBucket: 'ximvid-c8627.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const KEY = process.env.PEXELS_KEY;
if (!KEY) { console.error('FALTA PEXELS_KEY'); process.exit(1); }

const CATS = [
  { uid: 'seed_viajes',    cat: 'Viajes',     q: 'travel beach ocean',  desES: 'Rincones del mundo que enamoran ✈️', desEN: 'Corners of the world to fall in love with ✈️', tags: ['viajes','travel','mundo','wanderlust'] },
  { uid: 'seed_food',      cat: 'Comida',     q: 'food cooking',        desES: 'Sabores que conquistan 🍜',           desEN: 'Flavors that win you over 🍜',                 tags: ['comida','food','foodie','recetas'] },
  { uid: 'seed_sport',     cat: 'Deporte',    q: 'fitness workout',     desES: 'Entrena duro, vive mejor 💪',         desEN: 'Train hard, live better 💪',                   tags: ['deporte','fitness','sport','motivacion'] },
  { uid: 'seed_nature',    cat: 'Naturaleza', q: 'nature forest',       desES: 'La naturaleza en estado puro 🌿',     desEN: 'Nature in its purest form 🌿',                 tags: ['naturaleza','nature','relax','tierra'] },
  { uid: 'seed_urban',     cat: 'Urbano',     q: 'city street night',   desES: 'La ciudad nunca duerme 🏙️',          desEN: 'The city never sleeps 🏙️',                    tags: ['urbano','city','street','nightlife'] }
];

function newId() { return crypto.randomBytes(10).toString('hex'); }
function token() { return crypto.randomUUID(); }

async function uploadBuffer(buf, path, contentType) {
  const t = token();
  await bucket.file(path).save(buf, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: t } } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${t}`;
}

async function run() {
  const users = {};
  for (const c of CATS) {
    const u = await db.collection('users').doc(c.uid).get();
    if (!u.exists) { console.error('Falta seed user:', c.uid); process.exit(1); }
    users[c.uid] = u.data();
  }
  for (const c of CATS) {
    console.log('---', c.cat, '---');
    const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(c.q)}&orientation=portrait&per_page=10`, { headers: { Authorization: KEY } });
    if (!res.ok) { console.error('Pexels', res.status, await res.text()); continue; }
    const data = await res.json();
    let done = false;
    for (const v of (data.videos || [])) {
      // Deduplicar por pexelsId
      const dup = await db.collection('videos').where('pexelsId', '==', v.id).limit(1).get();
      if (!dup.empty) continue;
      // Archivo vertical SD: alto entre 900-1300, ancho < alto
      const file = (v.video_files || []).find(f => f.width < f.height && f.height >= 900 && f.height <= 1400 && f.file_type === 'video/mp4');
      if (!file) continue;
      console.log('Descargando pexels', v.id, file.width + 'x' + file.height, '~' + v.duration + 's');
      const vidBuf = Buffer.from(await (await fetch(file.link)).arrayBuffer());
      if (vidBuf.length > 60 * 1024 * 1024) { console.log('Demasiado grande, salto'); continue; }
      const thBuf = Buffer.from(await (await fetch(v.image)).arrayBuffer());
      const videoId = newId();
      const base = `videos/${c.uid}/${videoId}`;
      const videoURL = await uploadBuffer(vidBuf, `${base}/video.mp4`, 'video/mp4');
      const thumbnailURL = await uploadBuffer(thBuf, `${base}/thumb.jpg`, 'image/jpeg');
      await db.collection('videos').add({
        userId: c.uid,
        username: users[c.uid].username || '',
        userLanguage: 'es',
        videoURL, thumbnailURL,
        intention: 'creating_content',
        description: c.desES,
        descriptionEn: c.desEN,
        hashtags: c.tags,
        duration: Math.min(Math.round(v.duration || 30), 90),
        views: 0, actionClicks: 0, shareClicks: 0,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lat: null, lng: null,
        category: c.cat,
        isSeed: true,
        pexelsId: v.id,
        moderationStatus: 'approved',
        moderatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('OK', c.cat, '->', videoId, (vidBuf.length/1048576).toFixed(1) + ' MB');
      done = true;
      break;
    }
    if (!done) console.log('Sin video valido para', c.cat);
  }
  console.log('FIN');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
