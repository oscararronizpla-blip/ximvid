/**
 * XIMVID — video-processing.js (version simple y segura)
 * Comprime video.mp4 a H.264 CRF 23 (estilo TikTok) tras la subida.
 * - Reemplaza el original SOLO si el comprimido pesa menos.
 * - Actualiza videoURL en Firestore con el nuevo enlace.
 * - Evita bucle infinito con un metadato marcador.
 */
const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const path      = require('path');
const os        = require('os');
const fs        = require('fs');
const { exec }  = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const db      = admin.firestore();
const storage = admin.storage();

exports.onVideoUploaded = functions
  .runWith({ timeoutSeconds: 300, memory: '2GB' })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath    = object.name;
    const contentType = object.contentType;

    // Solo videos en videos/{userId}/{videoId}/video.mp4
    if (!contentType || !contentType.startsWith('video/')) return null;
    if (!filePath || !filePath.endsWith('/video.mp4')) return null;

    // Evitar bucle: si ya fue comprimido por nosotros, salir
    if (object.metadata && object.metadata.ximvidCompressed === 'true') {
      console.log('Ya comprimido, ignoro:', filePath);
      return null;
    }

    const parts = filePath.split('/');
    if (parts.length < 4 || parts[0] !== 'videos') return null;
    const userId  = parts[1];
    const videoId = parts[2];
    console.log('Comprimiendo video:', userId, videoId);

    const workDir = path.join(os.tmpdir(), videoId + '_' + Date.now());
    fs.mkdirSync(workDir, { recursive: true });
    const inputPath  = path.join(workDir, 'in.mp4');
    const outputPath = path.join(workDir, 'out.mp4');

    const bucket = storage.bucket();
    const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch(e){} };

    try {
      // 1. Descargar original
      await bucket.file(filePath).download({ destination: inputPath });
      const origSize = fs.statSync(inputPath).size;

      // 2. Detectar resolucion para limitar a 1080p vertical
      let outW = 1080, outH = 1920;
      try {
        const { stdout } = await execAsync(
          `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`
        );
        const probe = JSON.parse(stdout);
        const vs = (probe.streams || []).find(s => s.codec_type === 'video');
        if (vs && vs.width && vs.height) {
          let w = parseInt(vs.width), h = parseInt(vs.height);
          if (h > 1920) { w = Math.round(w * (1920 / h)); h = 1920; }
          outW = w % 2 === 0 ? w : w - 1;
          outH = h % 2 === 0 ? h : h - 1;
        }
      } catch(e) { console.log('ffprobe fallo, uso escala por defecto'); }

      // 3. Comprimir H.264 CRF 23 + AAC 128k + faststart (estilo TikTok)
      await execAsync(
        `ffmpeg -i "${inputPath}" -c:v libx264 -crf 23 -preset fast ` +
        `-vf "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:a aac -b:a 128k ` +
        `-movflags +faststart -max_muxing_queue_size 9999 -t 90 ` +
        `"${outputPath}" -y`
      );
      const newSize = fs.statSync(outputPath).size;
      console.log('Original:', origSize, 'Comprimido:', newSize);

      // 4. Solo reemplazar si el comprimido pesa menos (con margen 5%)
      if (newSize >= origSize * 0.95) {
        console.log('El comprimido no ahorra espacio, dejo el original intacto');
        cleanup();
        return null;
      }

      // 5. Subir comprimido al MISMO path con marcador
      await bucket.upload(outputPath, {
        destination: filePath,
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
          metadata: { ximvidCompressed: 'true' }
        }
      });

      // 6. Obtener nueva URL publica (token de descarga)
      const file = bucket.file(filePath);
      const [meta] = await file.getMetadata();
      let token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
      if (!token) {
        const crypto = require('crypto');
        token = crypto.randomUUID();
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token, ximvidCompressed: 'true' } });
      }
      const encodedPath = encodeURIComponent(filePath);
      const newURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

      // 7. Actualizar videoURL en Firestore (buscar doc por path)
      const snap = await db.collection('videos')
        .where('userId', '==', userId)
        .get();
      let updated = 0;
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.videoURL && d.videoURL.includes(encodeURIComponent(`${userId}/${videoId}/video.mp4`))) {
          docSnap.ref.update({ videoURL: newURL });
          updated++;
        }
      });
      console.log('Firestore actualizado, docs:', updated);

      cleanup();
      return null;
    } catch (e) {
      console.error('Error comprimiendo video:', e);
      cleanup();
      return null;
    }
  });
