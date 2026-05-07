/**
 * XIMVID — setup-proyecto.js
 * ─────────────────────────────────────────────────────────────────
 * Paso 1: Crear el proyecto Expo con todas sus dependencias
 * y la estructura de carpetas completa.
 *
 * Ejecutar desde terminal:
 *   node setup-proyecto.js
 *
 * Requisitos previos:
 *   node >= 18, npm >= 9, expo-cli instalado globalmente
 * ─────────────────────────────────────────────────────────────────
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Configuración ────────────────────────────────────────────────
const APP_NAME = 'ximvid';
const APP_DIR  = path.join(process.cwd(), APP_NAME);

// ─── Helpers ──────────────────────────────────────────────────────
function run(cmd, cwd = APP_DIR) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

function mkdirp(relPath) {
  const abs = path.join(APP_DIR, relPath);
  fs.mkdirSync(abs, { recursive: true });
  // Crea un .gitkeep para que git no ignore carpetas vacías
  fs.writeFileSync(path.join(abs, '.gitkeep'), '');
}

function writeFile(relPath, content) {
  const abs = path.join(APP_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

// ─── PASO 1.1 — Verificar requisitos ──────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('  XIMVID — Verificando requisitos previos');
console.log('════════════════════════════════════════\n');

try {
  const node = execSync('node --version').toString().trim();
  const major = parseInt(node.replace('v', '').split('.')[0]);
  if (major < 18) throw new Error(`Node ${node} detectado. Se requiere >= 18`);
  console.log(`✅ Node: ${node}`);

  const npm = execSync('npm --version').toString().trim();
  const npmMajor = parseInt(npm.split('.')[0]);
  if (npmMajor < 9) throw new Error(`npm ${npm} detectado. Se requiere >= 9`);
  console.log(`✅ npm: ${npm}`);

  try {
    const expo = execSync('npx expo --version').toString().trim();
    console.log(`✅ Expo CLI: ${expo}`);
  } catch {
    console.log('⚠️  Expo CLI no encontrado — instalando...');
    execSync('npm install -g expo-cli', { stdio: 'inherit' });
  }

  try {
    const firebase = execSync('firebase --version').toString().trim();
    console.log(`✅ Firebase CLI: ${firebase}`);
  } catch {
    console.log('⚠️  Firebase CLI no encontrado — instalando...');
    execSync('npm install -g firebase-tools', { stdio: 'inherit' });
  }
} catch (err) {
  console.error(`\n❌ Error de requisitos: ${err.message}`);
  process.exit(1);
}

// ─── PASO 1.2 — Crear proyecto Expo ───────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('  Creando proyecto Expo...');
console.log('════════════════════════════════════════\n');

if (fs.existsSync(APP_DIR)) {
  console.log(`⚠️  La carpeta "${APP_NAME}" ya existe. Saltando creación.`);
} else {
  run(
    `npx create-expo-app ${APP_NAME} --template blank`,
    process.cwd()
  );
}

// ─── PASO 1.3 — Instalar dependencias ─────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('  Instalando dependencias...');
console.log('════════════════════════════════════════\n');

const deps = [
  // Navegación
  '@react-navigation/native',
  '@react-navigation/bottom-tabs',
  '@react-navigation/stack',
  // Firebase
  'firebase',
  // Pagos
  '@stripe/stripe-react-native',
  // Media
  'expo-av',
  'expo-camera',
  'expo-image-picker',
  'expo-image-manipulator',   // Compresión de imágenes antes de subir
  // Geolocalización
  'expo-location',
  // Deep linking
  'expo-linking',
  // Notificaciones push
  'expo-notifications',
  // Internacionalización
  'i18next',
  'react-i18next',
  // Gestures y animaciones
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  // Compartir
  'expo-sharing',
  // Almacenamiento local
  '@react-native-async-storage/async-storage',
  // Gradientes (columna derecha)
  'expo-linear-gradient',
  // Video upload progress
  'expo-file-system',
  // Drag & drop para reordenar iconos
  'react-native-draggable-flatlist',
  // Splash screen y fonts
  'expo-splash-screen',
  'expo-font',
  // Status bar
  'expo-status-bar',
];

run(`npx expo install ${deps.join(' ')}`);

// Dependencias de desarrollo
const devDeps = [
  'babel-plugin-module-resolver',
];
run(`npm install --save-dev ${devDeps.join(' ')}`);

// ─── PASO 1.4 — Crear estructura de carpetas ──────────────────────
console.log('\n════════════════════════════════════════');
console.log('  Creando estructura de carpetas...');
console.log('════════════════════════════════════════\n');

const folders = [
  // Pantallas
  'src/screens',
  // Componentes
  'src/components',
  // Navegación
  'src/navigation',
  // Servicios externos
  'src/services',
  // Internacionalización
  'src/i18n/translations',
  // Constantes
  'src/constants',
  // Hooks personalizados
  'src/hooks',
  // Assets (referencias a URLs de Firebase Storage)
  'src/assets',
  // Firebase Functions (backend)
  'functions',
  // Web pública (Firebase Hosting)
  'public',
  // Admin panel
  'src/screens/admin',
];

folders.forEach(f => {
  mkdirp(f);
  console.log(`  📁 ${f}`);
});

// ─── PASO 1.5 — Crear archivos base de cada módulo ────────────────
console.log('\n════════════════════════════════════════');
console.log('  Creando archivos base...');
console.log('════════════════════════════════════════\n');

// .env.example
writeFile('.env.example', `# ════════════════════════════════════════
# XIMVID — Variables de entorno
# Copiar este archivo como .env y rellenar los valores reales
# NUNCA subir .env a git (ya está en .gitignore)
# ════════════════════════════════════════

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# El precio Premium se gestiona desde el panel de administración en Firestore
# No se define aquí — el admin lo actualiza desde la app

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@ximvid.com
SENDGRID_FROM_NAME=Ximvid

# ManyChat
MANYCHAT_API_KEY=

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_ACCOUNT_ID=

# App
EXPO_PUBLIC_APP_URL=https://ximvid.com
EXPO_PUBLIC_APP_NAME=Ximvid
EXPO_PUBLIC_CDN_URL=https://cdn.ximvid.com
`);

// .gitignore
writeFile('.gitignore', `.env
node_modules/
.expo/
dist/
web-build/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
yarn-error.*
.idea/
.vscode/
*.log
`);

// babel.config.js — con module-resolver para imports limpios
writeFile('babel.config.js', `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Permite imports como: import X from '@screens/HomeScreen'
      ['module-resolver', {
        root: ['./src'],
        alias: {
          '@screens':    './src/screens',
          '@components': './src/components',
          '@navigation': './src/navigation',
          '@services':   './src/services',
          '@i18n':       './src/i18n',
          '@constants':  './src/constants',
          '@hooks':      './src/hooks',
          '@assets':     './src/assets',
        },
      }],
      // Necesario para react-native-reanimated (siempre al final)
      'react-native-reanimated/plugin',
    ],
  };
};
`);

// package.json scripts adicionales
const pkgPath = path.join(APP_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = {
  ...pkg.scripts,
  'start':           'expo start',
  'android':         'expo start --android',
  'ios':             'expo start --ios',
  'build:android':   'eas build --platform android --profile production',
  'build:ios':       'eas build --platform ios --profile production',
  'deploy:hosting':  'firebase deploy --only hosting',
  'deploy:functions':'firebase deploy --only functions',
  'deploy:all':      'firebase deploy',
  'lint':            'eslint src/',
};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

console.log('✅ package.json actualizado con scripts');

// ─── RESUMEN FINAL ─────────────────────────────────────────────────
console.log(`
════════════════════════════════════════
  ✅ PASO 1 COMPLETADO
════════════════════════════════════════

  Proyecto: ${APP_DIR}
  
  Siguientes pasos:
  1. cd ${APP_NAME}
  2. Copia .env.example → .env y rellena las credenciales
  3. Ejecuta: node ../setup-firestore.js
  
  ⚠️  IMPORTANTE:
  - Nunca subas .env a git
  - Las credenciales de Firebase van en .env
  - El precio Premium se configura desde el panel admin
════════════════════════════════════════
`);
