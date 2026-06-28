const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ximvid-c8627' });
const db = admin.firestore();

async function fixUsernames() {
  // Obtener todos los videos sin username
  const videos = await db.collection('videos').where('username', '==', '').get();
  console.log(`Videos sin username: ${videos.size}`);
  
  for (const videoDoc of videos.docs) {
    const video = videoDoc.data();
    // Buscar el username del usuario
    const userDoc = await db.collection('users').doc(video.userId).get();
    if (userDoc.exists) {
      const username = userDoc.data().username || '';
      await videoDoc.ref.update({ username });
      console.log(`✅ Video ${videoDoc.id} → username: ${username}`);
    }
  }
  console.log('Listo');
  process.exit(0);
}

fixUsernames().catch(console.error);
