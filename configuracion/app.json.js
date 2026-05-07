// ─────────────────────────────────────────────────────────────────
// XIMVID — app.json
// Configuración de Expo para la app móvil.
// Este archivo genera el Info.plist (iOS) y AndroidManifest.xml (Android).
//
// ⚠️  ANTES DE PUBLICAR:
//   1. Reemplaza REEMPLAZAR_APPLE_TEAM_ID con tu Apple Team ID
//   2. Reemplaza REEMPLAZAR_GOOGLE_SERVICES con el contenido real
//   3. Añade los iconos y splash screen en los paths indicados
// ─────────────────────────────────────────────────────────────────

const appJson = {
  expo: {
    name:        "Ximvid",
    slug:        "ximvid",
    version:     "1.0.0",
    orientation: "portrait",  // Solo vertical — igual que TikTok
    icon:        "./assets/icon.png",
    userInterfaceStyle: "automatic",

    // Splash screen
    splash: {
      image:           "./assets/splash.png",
      resizeMode:      "contain",
      backgroundColor: "#8ecaec",  // Azul de la app mientras carga
    },

    // Variables de entorno accesibles en la app
    extra: {
      eas: { projectId: "REEMPLAZAR_EAS_PROJECT_ID" },
    },

    // ── iOS ───────────────────────────────────────────────────────
    ios: {
      bundleIdentifier:   "com.ximvid.app",
      buildNumber:        "1",
      supportsTablet:     false,  // Solo móvil
      requiresFullScreen: true,
      backgroundColor:    "#8ecaec",

      // Permisos requeridos — deben coincidir con el uso real
      infoPlist: {
        NSCameraUsageDescription:
          "Ximvid necesita acceso a la cámara para grabar videos.",
        NSMicrophoneUsageDescription:
          "Ximvid necesita acceso al micrófono para grabar audio en los videos.",
        NSPhotoLibraryUsageDescription:
          "Ximvid necesita acceso a tu galería para seleccionar videos e imágenes.",
        NSPhotoLibraryAddUsageDescription:
          "Ximvid puede guardar imágenes en tu galería.",
        NSLocationWhenInUseUsageDescription:
          "Ximvid usa tu ubicación para mostrarte creadores cercanos (opcional).",
        NSUserNotificationsUsageDescription:
          "Ximvid envía notificaciones cuando alguien interactúa con tu contenido.",
      },

      // Deep linking — ximvid:// y https://app.ximvid.com
      associatedDomains: ["applinks:app.ximvid.com"],

      // Google Sign-In (requiere configuración en Google Cloud Console)
      googleServicesFile: "./GoogleService-Info.plist",

      // Apple Team ID
      appleTeamId: "REEMPLAZAR_APPLE_TEAM_ID",

      // App Store Connect
      appStoreUrl: "https://apps.apple.com/app/ximvid/idREEMPLAZAR",
    },

    // ── Android ───────────────────────────────────────────────────
    android: {
      package:      "com.ximvid.app",
      versionCode:  1,
      compileSdkVersion: 34,
      targetSdkVersion:  34,
      minSdkVersion:     21,  // Android 5.0+

      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#8ecaec",
      },

      // Permisos de Android
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.INTERNET",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
      ],

      // Deep linking
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "app.ximvid.com", pathPrefix: "/" },
            { scheme: "ximvid" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],

      // Firebase para Android
      googleServicesFile: "./google-services.json",

      // Google Play Store
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.ximvid.app",
    },

    // ── Plugins de Expo ──────────────────────────────────────────
    plugins: [
      // Cámara
      [
        "expo-camera",
        { cameraPermission: "Ximvid necesita acceso a la cámara para grabar videos." },
      ],
      // Galería
      [
        "expo-image-picker",
        {
          photosPermission: "Ximvid necesita acceso a tu galería para seleccionar videos.",
          cameraPermission: "Ximvid necesita acceso a la cámara para grabar videos.",
        },
      ],
      // Notificaciones push
      [
        "expo-notifications",
        {
          icon:  "./assets/notification-icon.png",
          color: "#ff4d6d",
          sounds: ["./assets/notification.wav"],
        },
      ],
      // Ubicación
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Ximvid usa tu ubicación para mostrarte creadores cercanos.",
        },
      ],
      // Stripe React Native
      [
        "@stripe/stripe-react-native",
        { merchantIdentifier: "merchant.com.ximvid.app", enableGooglePay: true },
      ],
    ],

    // ── Assets ───────────────────────────────────────────────────
    assetBundlePatterns: ["**/*"],

    // ── Updates OTA (actualizaciones sin pasar por las tiendas) ──
    updates: {
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/REEMPLAZAR_EAS_PROJECT_ID",
    },
    runtimeVersion: { policy: "appVersion" },
  },
};

// Exportar como JSON limpio
module.exports = appJson;

/*
 * ─────────────────────────────────────────────────────────────────
 * INSTRUCCIONES PARA GENERAR app.json FINAL:
 *
 * node -e "const c=require('./app.json.js'); console.log(JSON.stringify(c,null,2))" > app.json
 *
 * O simplemente renombra este archivo a app.json y
 * elimina el module.exports = al principio y al final.
 * ─────────────────────────────────────────────────────────────────
 */
