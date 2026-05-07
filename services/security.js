/**
 * XIMVID — src/services/security.js
 * ─────────────────────────────────────────────────────────────────
 * Capa de seguridad completa:
 *  - Sanitización de inputs (anti-XSS)
 *  - Validación de URLs (anti-redirect malicioso)
 *  - Rate limiting cliente
 *  - Validación de tipos de archivo
 *
 * IMPORTAR en todas las pantallas con campos de texto y URLs.
 * Las Cloud Functions tienen su propia validación server-side.
 * ─────────────────────────────────────────────────────────────────
 */

// ─── 1. SANITIZACIÓN DE TEXTO ─────────────────────────────────────
// Elimina caracteres HTML peligrosos para prevenir XSS
// cuando el texto se renderiza en landing pages HTML
export function sanitizeText(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    // Eliminar tags HTML
    .replace(/<[^>]*>/g, '')
    // Escapar caracteres especiales HTML
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Eliminar caracteres de control (null bytes, etc.)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Eliminar intentos de inyección de scripts
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

// ─── 2. SANITIZACIÓN DE NOMBRE/MARCA ─────────────────────────────
// Más permisiva — permite emojis y caracteres internacionales
export function sanitizeName(input) {
  if (!input || typeof input !== 'string') return '';
  return sanitizeText(input).slice(0, 100); // Máx 100 chars
}

// ─── 3. SANITIZACIÓN DE DESCRIPCIÓN ──────────────────────────────
export function sanitizeDescription(input, maxLength = 150) {
  if (!input || typeof input !== 'string') return '';
  return sanitizeText(input).slice(0, maxLength);
}

// ─── 4. SANITIZACIÓN DE USERNAME ─────────────────────────────────
// Solo letras, números, guiones bajos y puntos
export function sanitizeUsername(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '') // Solo caracteres permitidos
    .replace(/\.{2,}/g, '.')     // No puntos consecutivos
    .replace(/^[._]/, '')        // No empezar con . o _
    .replace(/[._]$/, '')        // No terminar con . o _
    .slice(0, 30);               // Máx 30 chars
}

// ─── 5. VALIDACIÓN DE URL ─────────────────────────────────────────
// Previene URLs maliciosas: javascript:, data:, file:, etc.
const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:', 'whatsapp:', 'tg:'];
const BLOCKED_DOMAINS = [
  'javascript', 'data', 'file', 'vbscript', 'about',
];

export function validateUrl(input) {
  if (!input || typeof input !== 'string') return { valid: false, error: 'URL vacía' };

  const trimmed = input.trim();

  // Verificar que no empieza con protocolos peligrosos
  const lower = trimmed.toLowerCase();
  for (const blocked of BLOCKED_DOMAINS) {
    if (lower.startsWith(blocked + ':')) {
      return { valid: false, error: 'URL no permitida' };
    }
  }

  // Intentar parsear la URL
  try {
    // Añadir https:// si no tiene protocolo (para redes sociales)
    const urlToParse = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(urlToParse);

    // Verificar protocolo permitido
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: 'Protocolo no permitido' };
    }

    // Verificar que tiene dominio válido (no localhost en producción)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      if (process.env.NODE_ENV === 'production') {
        return { valid: false, error: 'URL no válida' };
      }
    }

    return { valid: true, sanitized: urlToParse };
  } catch {
    return { valid: false, error: 'Formato de URL inválido' };
  }
}

// ─── 6. VALIDACIÓN DE EMAIL ───────────────────────────────────────
export function validateEmail(input) {
  if (!input || typeof input !== 'string') return false;
  // RFC 5322 simplificado — lo más importante es que no sea inyección
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(input.trim()) && input.length <= 254;
}

// ─── 7. VALIDACIÓN DE TELÉFONO ────────────────────────────────────
export function validatePhone(input) {
  if (!input || typeof input !== 'string') return false;
  // E.164 format: +34600000000
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  return phoneRegex.test(input.replace(/[\s\-()]/g, ''));
}

// ─── 8. VALIDACIÓN DE CONTRASEÑA ─────────────────────────────────
export function validatePassword(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Contraseña requerida' };
  }
  if (input.length < 8) {
    return { valid: false, error: 'Mínimo 8 caracteres' };
  }
  if (input.length > 128) {
    return { valid: false, error: 'Contraseña demasiado larga' };
  }
  // Verificar que no es solo espacios
  if (input.trim().length === 0) {
    return { valid: false, error: 'Contraseña no válida' };
  }
  return { valid: true };
}

// ─── 9. VALIDACIÓN DE NÚMERO DE SEGUIDORES ───────────────────────
export function validateFollowers(input) {
  const num = parseInt(input);
  if (isNaN(num)) return 0;
  if (num < 0) return 0;
  if (num > 1_000_000_000) return 1_000_000_000; // Máx 1B
  return num;
}

// ─── 10. RATE LIMITING EN CLIENTE ────────────────────────────────
// Previene spam de llamadas a Firebase (login, registro, búsqueda)
const rateLimitStore = {};

export function checkRateLimit(action, maxCalls = 5, windowMs = 60000) {
  const now  = Date.now();
  const key  = action;

  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { calls: [], blocked: false };
  }

  const store = rateLimitStore[key];

  // Limpiar llamadas fuera de la ventana
  store.calls = store.calls.filter(t => now - t < windowMs);

  if (store.calls.length >= maxCalls) {
    const waitSec = Math.ceil((store.calls[0] + windowMs - now) / 1000);
    return {
      allowed: false,
      error:   `Demasiados intentos. Espera ${waitSec} segundos.`,
    };
  }

  store.calls.push(now);
  return { allowed: true };
}

// ─── 11. VALIDACIÓN DE ARCHIVOS ───────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;   // 5MB
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimeType)) {
    return { valid: false, error: 'Solo se permiten imágenes JPG, PNG o WebP' };
  }
  if (file.fileSize && file.fileSize > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'La imagen no puede superar 5 MB' };
  }
  return { valid: true };
}

export function validateVideoFile(file) {
  if (file.mimeType && !ALLOWED_VIDEO_TYPES.includes(file.mimeType)) {
    return { valid: false, error: 'Solo se permiten videos MP4 o MOV' };
  }
  if (file.fileSize && file.fileSize > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, error: 'El video no puede superar 200 MB' };
  }
  if (file.duration && file.duration > 90) {
    return { valid: false, error: 'El video no puede durar más de 90 segundos' };
  }
  return { valid: true };
}

// ─── 12. VALIDACIÓN COMPLETA DE REGISTRO ─────────────────────────
// Función que agrupa todas las validaciones del formulario de registro
export function validateRegistrationForm({ name, emailOrPhone, password }) {
  const errors = {};

  // Nombre
  const sanitizedName = sanitizeName(name);
  if (!sanitizedName || sanitizedName.length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres';
  }

  // Email o teléfono
  const trimmedContact = (emailOrPhone || '').trim();
  if (!trimmedContact) {
    errors.email = 'El email o teléfono es obligatorio';
  } else if (!validateEmail(trimmedContact) && !validatePhone(trimmedContact)) {
    errors.email = 'Introduce un email o teléfono válido';
  }

  // Contraseña
  const passValidation = validatePassword(password);
  if (!passValidation.valid) {
    errors.password = passValidation.error;
  }

  return {
    valid:  Object.keys(errors).length === 0,
    errors,
    sanitized: { name: sanitizedName, contact: trimmedContact },
  };
}

// ─── 13. SANITIZAR OBJETO DE SOCIAL LINK ─────────────────────────
export function sanitizeSocialLink(link) {
  const urlValidation = validateUrl(link.url || '');
  return {
    network:   sanitizeText(link.network || '').slice(0, 30),
    url:       urlValidation.valid ? urlValidation.sanitized : '',
    followers: validateFollowers(link.followers),
    order:     Math.max(0, Math.min(100, parseInt(link.order) || 0)),
  };
}

// ─── 14. SANITIZAR PERFIL COMPLETO ───────────────────────────────
export function sanitizeUserProfile(data) {
  const actionUrlValidation = validateUrl(data.actionButtonURL || '');
  const landingUrlValidation = validateUrl(data.externalLandingURL || '');

  return {
    name:             sanitizeName(data.name || ''),
    username:         sanitizeUsername(data.username || ''),
    shortDescription: sanitizeDescription(data.shortDescription || '', 150),
    longDescription:  sanitizeDescription(data.longDescription || '', 1000),
    actionButtonText: sanitizeText(data.actionButtonText || '').slice(0, 50),
    actionButtonURL:  actionUrlValidation.valid ? actionUrlValidation.sanitized : '',
    externalLandingURL: landingUrlValidation.valid ? landingUrlValidation.sanitized : '',
    socialLinks:      (data.socialLinks || []).map(sanitizeSocialLink),
  };
}
