/**
 * XIMVID — src/constants/domains.js
 * URLs base de todos los servicios — única fuente de verdad.
 * Cambiar aquí afecta a toda la app automáticamente.
 */
export const domains = {
  app:       process.env.EXPO_PUBLIC_APP_URL       || 'https://app.ximvid.com',
  marketing: process.env.EXPO_PUBLIC_MARKETING_URL || 'https://ximvid.com',
  cdn:       process.env.EXPO_PUBLIC_CDN_URL       || 'https://cdn.ximvid.com',
  api:       process.env.EXPO_PUBLIC_API_URL        || 'https://api.ximvid.com',
};

export const creatorUrl   = (username) => `${domains.app}/${username}`;
export const videoUrl     = (videoId)  => `${domains.app}/video/${videoId}`;
export const videoCdnUrl  = (userId, videoId) => `${domains.cdn}/videos/${userId}/${videoId}/video.mp4`;
export const hlsUrl       = (userId, videoId) => `${domains.cdn}/videos/${userId}/${videoId}/index.m3u8`;
export const thumbUrl     = (userId, videoId) => `${domains.cdn}/thumbnails/${userId}/${videoId}/thumb.jpg`;
export const thumbBlurUrl = (userId, videoId) => `${domains.cdn}/thumbnails/${userId}/${videoId}/thumb_blur.jpg`;
