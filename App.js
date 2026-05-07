/**
 * XIMVID — App.js
 * Punto de entrada de la app.
 * Inicializa i18n, providers y el navegador principal.
 */

import React, { useEffect, useState } from 'react';
import { StatusBar }      from 'expo-status-bar';
import * as SplashScreen  from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider }       from 'react-native-safe-area-context';
import { I18nextProvider }        from 'react-i18next';
import { StripeProvider }         from '@stripe/stripe-react-native';
import { initI18n }        from './src/i18n/index';
import AppNavigator        from './src/navigation/AppNavigator';

// Mantener el splash screen visible hasta que la app esté lista
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [i18nInstance, setI18nInstance] = useState(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Inicializar i18n con el idioma guardado o del dispositivo
        const i18n = await initI18n();
        setI18nInstance(i18n);
        setI18nReady(true);
      } catch (err) {
        console.warn('App init error:', err);
        setI18nReady(true); // Continuar aunque falle i18n
      } finally {
        await SplashScreen.hideAsync();
      }
    };
    prepare();
  }, []);

  if (!i18nReady) return null;

  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
          <I18nextProvider i18n={i18nInstance}>
            <StatusBar style="auto"/>
            <AppNavigator/>
          </I18nextProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
