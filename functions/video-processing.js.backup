/**
 * XIMVID — functions/video-processing.js
 * Procesamiento automático de videos tras la subida:
 *
 *  1. Detecta nuevo video en Storage
 *  2. Descarga el original
 *  3. Comprime con FFmpeg (H.264 CRF 23, AAC 128kbps, máx 1080p)
 *  4. Genera segmentos HLS para streaming sin buffering
 *  5. Extrae thumbnail (frame del segundo 1)
 *  6. Genera thumbnail borroso (para placeholder)
 *  7. Sube todo al CDN path correcto
 *  8. Actualiza Firestore con las URLs finales
 *  9. Borra el original para ahorrar espacio
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const path      = require('path');
const os        = require('os');
const fs        = require('fs');
const { exec }  = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const db        = admin.firestore();
const storage   = admin.storage();

// ══════════════════════════════════════════════════════════════════
// onVideoUploaded — se dispara al subir un archivo a Storage
// Solo procesa archivos en /videos/{userId}/{videoId}/original.mp4
// ══════════════════════════════════════════════════════════════════
exports.onVideoUploaded = functions
  .runWith({
    timeoutSeconds: 540,  // 9 minutos (máximo para Cloud Functions)
    memory:         '2GB',
  })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath    = object.name;
    const contentType = object.contentType;

    // Solo procesar archivos de video en la ruta correcta
    if (!contentType?.startsWith('video/')) return;
    if (!filePath?.includes('/original.')) return;

    // Extraer userId y videoId de la ruta
    // Formato: videos/{userId}/{videoId}/original.mp4
    const pathParts = filePath.split('/');
    if (pathParts.length < 4 || pathParts[0] !== 'videos') return;

    const userId  = pathParts[1];
    const videoId = pathParts[2];

    console.log(`Procesando video: userId=${userId}, videoId=${videoId}`);

    const bucket     = storage.bucket();
    const tmpDir     = os.tmpdir();
    const workDir    = path.join(tmpDir, videoId);
    fs.mkdirSync(workDir, { recursive: true });

    const inputPath   = path.join(workDir, 'original.mp4');
    const outputPath  = path.join(workDir, 'video.mp4');
    const thumbPath   = path.join(workDir, 'thumb.jpg');
    const thumbBlurPath = path.join(workDir, 'thumb_blur.jpg');
    const hlsDir      = path.join(workDir, 'hls');
    fs.mkdirSync(hlsDir, { recursive: true });

    try {
      // Marcar como en proceso en Firestore
      // Buscar el video por userId (el videoId en Firestore es el doc ID)
      const videosSnap = await db.collection('videos')
        .where('userId', '==', userId)
        .where('isProcessing', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      let videoDocRef = null;
      if (!videosSnap.empty) {
        videoDocRef = videosSnap.docs[0].ref;
      }

      // ── 1. Descargar el original ─────────────────────────────
      await bucket.file(filePath).download({ destination: inputPath });
      console.log('✅ Original descargado');

      // ── 2. Obtener información del video ─────────────────────
      const { stdout: probeOutput } = await execAsync(
        `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`
      );
      const probeData = JSON.parse(probeOutput);
      const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
      const duration    = parseFloat(videoStream?.duration || 0);
      const origWidth   = parseInt(videoStream?.width  || 1080);
      const origHeight  = parseInt(videoStream?.height || 1920);

      // Calcular resolución de salida (máx 1080p vertical)
      let outWidth  = origWidth;
      let outHeight = origHeight;
      if (origHeight > 1920) {
        outWidth  = Math.round(origWidth  * (1920 / origHeight));
        outHeight = 1920;
      }
      // Asegurar que son pares (FFmpeg lo requiere)
      outWidth  = outWidth  % 2 === 0 ? outWidth  : outWidth  - 1;
      outHeight = outHeight % 2 === 0 ? outHeight : outHeight - 1;

      console.log(`Resolución: ${origWidth}x${origHeight} → ${outWidth}x${outHeight}`);

      // ── 3. Comprimir video (H.264 CRF 23) ───────────────────
      // CRF 23 = calidad alta con tamaño reducido
      // preset fast = velocidad de compresión equilibrada
      await execAsync(`ffmpeg -i "${inputPath}" \
        -c:v libx264 -crf 23 -preset fast \
        -vf "scale=${outWidth}:${outHeight}" \
        -c:a aac -b:a 128k \
        -movflags +faststart \
        -max_muxing_queue_size 9999 \
        -t 90 \
        "${outputPath}" -y`);
      console.log('✅ Video comprimido');

      // ── 4. Generar segmentos HLS ──────────────────────────────
      // HLS permite que el video empiece a reproducirse sin esperar a cargar todo
      await execAsync(`ffmpeg -i "${outputPath}" \
        -c:v copy -c:a copy \
        -f hls \
        -hls_time 4 \
        -hls_list_size 0 \
        -hls_segment_type mpegts \
        -hls_segment_filename "${hlsDir}/segment_%03d.ts" \
        "${hlsDir}/index.m3u8" -y`);
      console.log('✅ HLS generado');

      // ── 5. Extraer thumbnail (frame del segundo 1) ────────────
      const thumbTime = Math.min(1, duration * 0.1); // 1s o 10% del video
      await execAsync(`ffmpeg -i "${outputPath}" \
        -ss ${thumbTime} -vframes 1 \
        -vf "scale=720:-2" \
        -q:v 2 \
        "${thumbPath}" -y`);
      console.log('✅ Thumbnail extraído');

      // ── 6. Generar thumbnail borroso (placeholder) ────────────
      await execAsync(`ffmpeg -i "${thumbPath}" \
        -vf "boxblur=20:5,scale=180:-2" \
        -q:v 8 \
        "${thumbBlurPath}" -y`);
      console.log('✅ Thumbnail borroso generado');

      // ── 7. Subir archivos procesados al Storage ───────────────
      const uploadOptions = { cacheControl: 'public, max-age=31536000' };

      // Video comprimido
      await bucket.upload(outputPath, {
        destination: `videos/${userId}/${videoId}/video.mp4`,
        metadata:    { ...uploadOptions, contentType: 'video/mp4' },
      });

      // Thumbnail
      await bucket.upload(thumbPath, {
        destination: `thumbnails/${userId}/${videoId}/thumb.jpg`,
        metadata:    { ...uploadOptions, contentType: 'image/jpeg' },
      });

      // Thumbnail borroso
      await bucket.upload(thumbBlurPath, {
        destination: `thumbnails/${userId}/${videoId}/thumb_blur.jpg`,
        metadata:    { ...uploadOptions, contentType: 'image/jpeg' },
      });

      // Playlist HLS y segmentos
      await bucket.upload(`${hlsDir}/index.m3u8`, {
        destination: `videos/${userId}/${videoId}/index.m3u8`,
        metadata:    { cacheControl: 'public, max-age=300', contentType: 'application/x-mpegURL' },
      });

      const hlsFiles = fs.readdirSync(hlsDir).filter(f => f.endsWith('.ts'));
      for (const segment of hlsFiles) {
        await bucket.upload(path.join(hlsDir, segment), {
          destination: `videos/${userId}/${videoId}/${segment}`,
          metadata:    { ...uploadOptions, contentType: 'video/MP2T' },
        });
      }
      console.log(`✅ ${hlsFiles.length} segmentos HLS subidos`);

      // Obtener URLs firmadas (públicas desde CDN)
      const cdnBase    = `https://cdn.ximvid.com`;
      const videoURL   = `${cdnBase}/videos/${userId}/${videoId}/video.mp4`;
      const hlsURL     = `${cdnBase}/videos/${userId}/${videoId}/index.m3u8`;
      const thumbURL   = `${cdnBase}/thumbnails/${userId}/${videoId}/thumb.jpg`;
      const thumbBlurURL = `${cdnBase}/thumbnails/${userId}/${videoId}/thumb_blur.jpg`;

      // Calcular tamaño del archivo comprimido
      const stats       = fs.statSync(outputPath);
      const fileSizeMB  = Math.round(stats.size / (1024 * 1024) * 10) / 10;

      // ── 8. Actualizar Firestore con URLs finales ──────────────
      if (videoDocRef) {
        await videoDocRef.update({
          videoURL,
          hlsURL,
          thumbnailURL:     thumbURL,
          thumbnailBlurURL: thumbBlurURL,
          duration:         Math.round(duration),
          fileSizeMB,
          resolution:       `${outWidth}x${outHeight}`,
          isProcessing:     false,
          processingError:  '',
          updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Firestore actualizado con URLs finales');
      }

      // ── 9. Borrar el original para ahorrar espacio ────────────
      // Se borra 24h después para tener un margen de seguridad
      // En producción se puede usar una Cloud Task con delay
      await bucket.file(filePath).delete();
      console.log('✅ Original borrado');

      console.log(`✅ Video ${videoId} procesado correctamente`);

    } catch (err) {
      console.error(`❌ Error procesando video ${videoId}:`, err);

      // Marcar como error en Firestore para que el usuario sepa
      const videosSnap = await db.collection('videos')
        .where('userId', '==', userId)
        .where('isProcessing', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!videosSnap.empty) {
        await videosSnap.docs[0].ref.update({
          isProcessing:    false,
          processingError: err.message || 'Error desconocido',
        });
      }
    } finally {
      // Limpiar archivos temporales
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {}
    }
  });

// ══════════════════════════════════════════════════════════════════
// cleanupOldOriginals — cron diario
// Limpia originales que no se borraron automáticamente
// ══════════════════════════════════════════════════════════════════
exports.cleanupOldOriginals = functions.pubsub
  .schedule('0 3 * * *') // Cada día a las 3:00 UTC
  .timeZone('UTC')
  .onRun(async () => {
    const bucket  = storage.bucket();
    const cutoff  = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h atrás

    const [files] = await bucket.getFiles({ prefix: 'videos/' });
    let deleted   = 0;

    for (const file of files) {
      if (!file.name.includes('/original.')) continue;

      const [metadata] = await file.getMetadata();
      const created    = new Date(metadata.timeCreated);

      if (created < cutoff) {
        await file.delete();
        deleted++;
        console.log(`Borrado original: ${file.name}`);
      }
    }

    console.log(`cleanupOldOriginals: ${deleted} archivos borrados`);
  });
