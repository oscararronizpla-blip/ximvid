/**
 * XIMVID — src/components/VideoPlayer.js
 * Reproductor de video optimizado para el feed.
 *
 * - HLS para streaming sin buffering (igual que TikTok)
 * - Thumbnail borroso como placeholder mientras carga
 * - Autoplay al entrar en pantalla, pausa al salir
 * - Loop activado, sin controles visibles
 * - Preload del siguiente video
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Image, StyleSheet, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useIsFocused }      from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  thumbnailBlurUrl,
  isActive,
}) {
  const videoRef    = useRef(null);
  const isFocused   = useIsFocused();
  const [ready,     setReady]     = useState(false);
  const [paused,    setPaused]    = useState(false);
  const [showThumb, setShowThumb] = useState(true);

  // ── Controlar reproducción según si el video es el activo ────
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive && isFocused && !paused) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
      // Si el video deja de ser activo, volver al inicio
      if (!isActive) {
        videoRef.current.setPositionAsync(0).catch(() => {});
        setShowThumb(true);
        setReady(false);
      }
    }
  }, [isActive, isFocused, paused]);

  // ── Tap para pausar/reproducir ───────────────────────────────
  const handleTap = () => {
    if (!isActive) return;
    setPaused(prev => !prev);
    if (paused) {
      videoRef.current?.playAsync().catch(() => {});
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  };

  const onReadyForDisplay = () => {
    setReady(true);
    // Pequeño delay para ocultar el thumbnail suavemente
    setTimeout(() => setShowThumb(false), 100);
  };

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.container}>

        {/* Thumbnail borroso — placeholder mientras carga el video */}
        {(showThumb || !ready) && thumbnailBlurUrl && (
          <Image
            source={{ uri: thumbnailBlurUrl }}
            style={styles.thumbnailBlur}
            blurRadius={Platform.OS === 'ios' ? 20 : 10}
            resizeMode="cover"
          />
        )}

        {/* Thumbnail nítido — se muestra encima del blur */}
        {(showThumb || !ready) && thumbnailUrl && (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}

        {/* Video principal */}
        {isActive && videoUrl && (
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isActive && isFocused && !paused}
            isMuted={false}
            onReadyForDisplay={onReadyForDisplay}
            onError={(e) => console.warn('VideoPlayer error:', e)}
            progressUpdateIntervalMillis={500}
            // Optimización: usar HLS si está disponible
            useNativeControls={false}
          />
        )}

        {/* Indicador de pausa */}
        {paused && isActive && (
          <View style={styles.pauseOverlay} pointerEvents="none">
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar}/>
              <View style={styles.pauseBar}/>
            </View>
          </View>
        )}

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    width, height,
    backgroundColor: '#000',
    overflow:        'hidden',
  },
  video: {
    position: 'absolute',
    top:0, left:0, right:0, bottom:0,
  },
  thumbnailBlur: {
    position:   'absolute',
    top:0, left:0, right:0, bottom:0,
    opacity:    0.6,
  },
  thumbnail: {
    position: 'absolute',
    top:0, left:0, right:0, bottom:0,
  },
  pauseOverlay: {
    position:       'absolute',
    top:0, left:0, right:0, bottom:0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    flexDirection:   'row',
    gap:             6,
    opacity:         0.7,
  },
  pauseBar: {
    width:           6,
    height:          32,
    borderRadius:    3,
    backgroundColor: '#fff',
  },
});
