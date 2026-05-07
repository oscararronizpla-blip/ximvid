/**
 * XIMVID — src/hooks/useVideo.js
 * Hook para gestionar el estado de reproducción de videos en el feed.
 * Controla qué video está activo y gestiona el preload del siguiente.
 */

import { useState, useCallback, useRef } from 'react';

export function useVideo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted,        setMuted]        = useState(false);
  const preloadedRefs  = useRef({});

  // Cambiar el video activo
  const setActiveVideo = useCallback((index) => {
    setCurrentIndex(index);
  }, []);

  // Registrar referencia de video para preload
  const registerVideo = useCallback((index, ref) => {
    preloadedRefs.current[index] = ref;
  }, []);

  // Toggle mute global
  const toggleMute = useCallback(() => {
    setMuted(prev => !prev);
  }, []);

  // Comprobar si un índice es el video activo o el siguiente (para preload)
  const shouldLoad = useCallback((index) => {
    return index === currentIndex || index === currentIndex + 1;
  }, [currentIndex]);

  return {
    currentIndex,
    muted,
    setActiveVideo,
    registerVideo,
    toggleMute,
    shouldLoad,
    isActive: (index) => index === currentIndex,
  };
}
