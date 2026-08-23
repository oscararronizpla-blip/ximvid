const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ximvid-c8627' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('videos').where('isActive','==',true).get();
  let con=0, sin=0;
  snap.forEach(d => { const v=d.data(); if(v.lat!=null && v.lng!=null) con++; else sin++; });
  console.log('CON ubicacion:', con, '| SIN ubicacion:', sin, '| TOTAL:', snap.size);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
