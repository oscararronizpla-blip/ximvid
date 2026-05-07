/**
 * XIMVID — src/constants/socialNetworks.js
 * Lista completa de las 29 redes/contactos/enlaces disponibles.
 * Iconos cargados desde Firebase Storage CDN — no en el bundle.
 */

const ICON_BASE = process.env.EXPO_PUBLIC_CDN_URL
  ? `${process.env.EXPO_PUBLIC_CDN_URL}/assets/icons`
  : 'https://cdn.ximvid.com/assets/icons';

export const SOCIAL_NETWORKS = [
  // ── Redes sociales ────────────────────────────────────────────
  { id:'instagram',  label:'Instagram',   group:'social',  iconUrl:`${ICON_BASE}/instagram.png`,  placeholder:'https://instagram.com/tu_usuario' },
  { id:'tiktok',     label:'TikTok',      group:'social',  iconUrl:`${ICON_BASE}/tiktok.png`,     placeholder:'https://tiktok.com/@tu_usuario' },
  { id:'youtube',    label:'YouTube',     group:'social',  iconUrl:`${ICON_BASE}/youtube.png`,    placeholder:'https://youtube.com/@tu_canal' },
  { id:'facebook',   label:'Facebook',    group:'social',  iconUrl:`${ICON_BASE}/facebook.png`,   placeholder:'https://facebook.com/tu_pagina' },
  { id:'linkedin',   label:'LinkedIn',    group:'social',  iconUrl:`${ICON_BASE}/linkedin.png`,   placeholder:'https://linkedin.com/in/tu_perfil' },
  { id:'pinterest',  label:'Pinterest',   group:'social',  iconUrl:`${ICON_BASE}/pinterest.png`,  placeholder:'https://pinterest.com/tu_usuario' },
  { id:'twitch',     label:'Twitch',      group:'social',  iconUrl:`${ICON_BASE}/twitch.png`,     placeholder:'https://twitch.tv/tu_canal' },
  { id:'spotify',    label:'Spotify',     group:'social',  iconUrl:`${ICON_BASE}/spotify.png`,    placeholder:'https://open.spotify.com/artist/...' },
  { id:'soundcloud', label:'SoundCloud',  group:'social',  iconUrl:`${ICON_BASE}/soundcloud.png`, placeholder:'https://soundcloud.com/tu_usuario' },
  { id:'behance',    label:'Behance',     group:'social',  iconUrl:`${ICON_BASE}/behance.png`,    placeholder:'https://behance.net/tu_usuario' },
  { id:'vimeo',      label:'Vimeo',       group:'social',  iconUrl:`${ICON_BASE}/vimeo.png`,      placeholder:'https://vimeo.com/tu_usuario' },
  { id:'discord',    label:'Discord',     group:'social',  iconUrl:`${ICON_BASE}/discord.png`,    placeholder:'https://discord.gg/tu_servidor' },
  { id:'patreon',    label:'Patreon',     group:'social',  iconUrl:`${ICON_BASE}/patreon.png`,    placeholder:'https://patreon.com/tu_usuario' },
  { id:'twitter',    label:'X / Twitter', group:'social',  iconUrl:`${ICON_BASE}/twitter.png`,    placeholder:'https://x.com/tu_usuario' },
  { id:'snapchat',   label:'Snapchat',    group:'social',  iconUrl:`${ICON_BASE}/snapchat.png`,   placeholder:'https://snapchat.com/add/tu_usuario' },
  { id:'reddit',     label:'Reddit',      group:'social',  iconUrl:`${ICON_BASE}/reddit.png`,     placeholder:'https://reddit.com/u/tu_usuario' },
  { id:'tumblr',     label:'Tumblr',      group:'social',  iconUrl:`${ICON_BASE}/tumblr.png`,     placeholder:'https://tu_usuario.tumblr.com' },
  // ── Contacto directo ──────────────────────────────────────────
  { id:'whatsapp',   label:'WhatsApp',    group:'contact', iconUrl:`${ICON_BASE}/whatsapp.png`,   placeholder:'https://wa.me/34600000000' },
  { id:'telegram',   label:'Telegram',    group:'contact', iconUrl:`${ICON_BASE}/telegram.png`,   placeholder:'https://t.me/tu_usuario' },
  { id:'email',      label:'Email',       group:'contact', iconUrl:`${ICON_BASE}/email.png`,      placeholder:'mailto:tu@email.com' },
  { id:'phone',      label:'Teléfono',    group:'contact', iconUrl:`${ICON_BASE}/phone.png`,      placeholder:'tel:+34600000000' },
  // ── Mis enlaces ───────────────────────────────────────────────
  { id:'web',        label:'Mi web',      group:'links',   iconUrl:`${ICON_BASE}/web.png`,        placeholder:'https://miweb.com' },
  { id:'shop',       label:'Mi tienda',   group:'links',   iconUrl:`${ICON_BASE}/shop.png`,       placeholder:'https://mitienda.com' },
  { id:'etsy',       label:'Etsy',        group:'links',   iconUrl:`${ICON_BASE}/etsy.png`,       placeholder:'https://etsy.com/shop/tu_tienda' },
  { id:'amazon',     label:'Amazon',      group:'links',   iconUrl:`${ICON_BASE}/amazon.png`,     placeholder:'https://amazon.es/...' },
  { id:'wallapop',   label:'Wallapop',    group:'links',   iconUrl:`${ICON_BASE}/wallapop.png`,   placeholder:'https://wallapop.com/...' },
  { id:'calendly',   label:'Calendly',    group:'links',   iconUrl:`${ICON_BASE}/calendly.png`,   placeholder:'https://calendly.com/tu_usuario' },
  { id:'paypal',     label:'PayPal',      group:'links',   iconUrl:`${ICON_BASE}/paypal.png`,     placeholder:'https://paypal.me/tu_usuario' },
  { id:'bizum',      label:'Bizum',       group:'links',   iconUrl:`${ICON_BASE}/bizum.png`,      placeholder:'Tu número de Bizum' },
];

export const SOCIAL_GROUPS = [
  { id:'social',  label:'Redes sociales' },
  { id:'contact', label:'Contacto directo' },
  { id:'links',   label:'Mis enlaces' },
];

export const getSocialNetwork  = (id) => SOCIAL_NETWORKS.find(n => n.id === id);

export const formatFollowers = (n) => {
  if (!n || n === 0) return '';
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return String(n);
};
