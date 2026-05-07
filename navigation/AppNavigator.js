/**
 * XIMVID — src/navigation/AppNavigator.js
 * Navegación principal de la app.
 * Decide qué stack mostrar según el estado de autenticación.
 */

import React          from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth }    from '@hooks/useAuth';
import { colors }     from '@constants/colors';

// Pantallas de autenticación
import WelcomeScreen      from '@screens/WelcomeScreen';
import RegisterScreen     from '@screens/RegisterScreen';
import UserTypeScreen     from '@screens/UserTypeScreen';
import ProfileSetupScreen from '@screens/ProfileSetupScreen';
import SocialLinksScreen  from '@screens/SocialLinksScreen';

// Pantallas principales
import FeedScreen         from '@screens/FeedScreen';
import VideoScreen        from '@screens/VideoScreen';
import UploadScreen       from '@screens/UploadScreen';
import LandingPageScreen  from '@screens/LandingPageScreen';
import ProfileScreen      from '@screens/ProfileScreen';
import StatsScreen        from '@screens/StatsScreen';
import SettingsScreen     from '@screens/SettingsScreen';
import SearchScreen       from '@screens/SearchScreen';

const Stack = createStackNavigator();

// ─── Stack de autenticación ───────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false, gestureEnabled:true }}>
      <Stack.Screen name="Welcome"      component={WelcomeScreen}/>
      <Stack.Screen name="Register"     component={RegisterScreen}/>
      <Stack.Screen name="Login"        component={RegisterScreen}/>
      <Stack.Screen name="UserType"     component={UserTypeScreen}/>
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen}/>
      <Stack.Screen name="SocialLinks"  component={SocialLinksScreen}/>
    </Stack.Navigator>
  );
}

// ─── Stack principal ──────────────────────────────────────────────
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown:    false,
        gestureEnabled: true,
        // Transición nativa para mejor rendimiento
        cardStyleInterpolator: ({ current: { progress } }) => ({
          cardStyle: { opacity: progress },
        }),
      }}
    >
      <Stack.Screen name="Feed"         component={FeedScreen}/>
      <Stack.Screen name="Video"        component={VideoScreen}/>
      <Stack.Screen name="Upload"       component={UploadScreen}/>
      <Stack.Screen name="LandingPage"  component={LandingPageScreen}/>
      <Stack.Screen name="Profile"      component={ProfileScreen}/>
      <Stack.Screen name="Stats"        component={StatsScreen}/>
      <Stack.Screen name="Settings"     component={SettingsScreen}/>
      <Stack.Screen name="Search"       component={SearchScreen}/>
      {/* Estas pantallas también accesibles desde el stack principal */}
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen}/>
      <Stack.Screen name="SocialLinks"  component={SocialLinksScreen}/>
    </Stack.Navigator>
  );
}

// ─── Navegador raíz ───────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, loading, userProfile } = useAuth();

  // Mientras carga el estado de auth, mostrar splash
  if (loading) {
    return (
      <View style={s.splash}>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>
    );
  }

  // Deep linking configuration
  const linking = {
    prefixes: ['ximvid://', 'https://app.ximvid.com'],
    config: {
      screens: {
        Feed:        'feed',
        Video:       'video/:videoId',
        LandingPage: ':username',
        Profile:     'profile',
        Settings:    'settings/:scrollTo?',
        Upload:      'upload',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? <AppStack/> : <AuthStack/>}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  splash: {
    flex:1,
    backgroundColor:'#8ecaec',
    alignItems:'center',
    justifyContent:'center',
  },
});
