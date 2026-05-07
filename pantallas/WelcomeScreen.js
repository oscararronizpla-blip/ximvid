/**
 * XIMVID — src/screens/WelcomeScreen.js
 * PANTALLA 1: Bienvenida
 * Fondo: azul tecnológico + círculos + código binario (AppBackground)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, FlatList, Modal, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { colors }         from '@constants/colors';
import { SUPPORTED_LANGUAGES, changeLanguage, getDeviceLanguageSuggestion } from '@i18n/index';
import AppBackground      from '@components/AppBackground';

const { height } = Dimensions.get('window');

// ─── Selector de idioma (bottom sheet) ───────────────────────────
function LanguageSelector({ currentLang, onSelect, visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={s.langSheet}>
          <View style={s.langHandle} />
          <Text style={s.langSheetTitle}>Select language</Text>
          <FlatList
            data={SUPPORTED_LANGUAGES}
            keyExtractor={item => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.langItem, currentLang === item.code && s.langItemActive]}
                onPress={() => { onSelect(item.code); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={s.langFlag}>{item.flag}</Text>
                <View style={s.langNames}>
                  <Text style={s.langNative}>{item.nativeName}</Text>
                  <Text style={s.langEnglish}>{item.name}</Text>
                </View>
                {currentLang === item.code && (
                  <View style={s.langCheck}>
                    <Text style={s.langCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────
export default function WelcomeScreen({ navigation }) {
  const { t, i18n }  = useTranslation();
  const [currentLang,         setCurrentLang]         = useState(i18n.language || 'en');
  const [langModalOpen,       setLangModalOpen]       = useState(false);
  const [deviceSuggestion,    setDeviceSuggestion]    = useState(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const topBarAnim   = useRef(new Animated.Value(0)).current;
  const logoAnim     = useRef(new Animated.Value(0)).current;
  const titleAnim    = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const buttonsAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.spring(topBarAnim,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(logoAnim,     { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.spring(titleAnim,    { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.spring(subtitleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.spring(buttonsAnim,  { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
    const suggestion = getDeviceLanguageSuggestion();
    if (suggestion) setDeviceSuggestion(suggestion);
  }, []);

  const handleLanguageSelect = useCallback(async (code) => {
    setCurrentLang(code);
    await changeLanguage(code);
  }, []);

  const entry = (anim) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [22,0] }) }],
  });

  const langData = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={s.safeArea}>

        {/* Barra superior — selector de idioma */}
        <Animated.View style={[s.topBar, entry(topBarAnim)]}>
          <TouchableOpacity style={s.langBtn} onPress={() => setLangModalOpen(true)} activeOpacity={0.7}>
            <Text style={s.langBtnFlag}>{langData?.flag}</Text>
            <Text style={s.langBtnText}>{langData?.nativeName}</Text>
            <Text style={s.langBtnChevron}>›</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Sugerencia de idioma del dispositivo */}
        {deviceSuggestion && !suggestionDismissed && (
          <View style={s.suggestion}>
            <Text style={s.suggestionText}>
              {t('welcome.languageDetected', { lang: deviceSuggestion.nativeName })}
            </Text>
            <TouchableOpacity
              style={s.suggestionBtn}
              onPress={() => { handleLanguageSelect(deviceSuggestion.code); setSuggestionDismissed(true); }}
            >
              <Text style={s.suggestionBtnText}>Switch</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSuggestionDismissed(true)}>
              <Text style={s.suggestionX}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contenido central */}
        <View style={s.center}>

          {/* Logo */}
          <Animated.View style={[s.logoWrap, entry(logoAnim)]}>
            <View style={s.logoCircle}>
              <Text style={s.logoLetter}>X</Text>
            </View>
            <Text style={s.logoText}>ximvid</Text>
          </Animated.View>

          {/* Título */}
          <Animated.Text style={[s.title, entry(titleAnim)]}>
            {t('welcome.title')}
          </Animated.Text>

          {/* Subtítulo */}
          <Animated.Text style={[s.subtitle, entry(subtitleAnim)]}>
            {t('welcome.subtitle')}
          </Animated.Text>

          {/* Pills */}
          <Animated.View style={[s.pillsRow, entry(subtitleAnim)]}>
            {['📱 TikTok', '📸 Instagram', '🎯 Clientes'].map((pill, i) => (
              <View key={i} style={s.pill}>
                <Text style={s.pillText}>{pill}</Text>
              </View>
            ))}
          </Animated.View>

        </View>

        {/* Botones */}
        <Animated.View style={[s.buttons, entry(buttonsAnim)]}>

          <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('Register')} activeOpacity={0.85}>
            <LinearGradient colors={['#ff4d6d','#e8003d']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnGradient}>
              <Text style={s.btnPrimaryText}>{t('welcome.register')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
            <Text style={s.btnSecondaryText}>{t('welcome.login')}</Text>
          </TouchableOpacity>

          <Text style={s.legalText}>
            {t('register.termsText')}{' '}
            <Text style={s.legalLink} onPress={() => navigation.navigate('Terms')}>{t('register.termsLink')}</Text>
            {' '}{t('register.andText')}{' '}
            <Text style={s.legalLink} onPress={() => navigation.navigate('Privacy')}>{t('register.privacyLink')}</Text>
          </Text>

        </Animated.View>
      </SafeAreaView>

      <LanguageSelector currentLang={currentLang} onSelect={handleLanguageSelect} visible={langModalOpen} onClose={() => setLangModalOpen(false)} />
    </AppBackground>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection:'row', justifyContent:'flex-end', paddingHorizontal:20, paddingTop:8 },
  langBtn: {
    flexDirection:'row', alignItems:'center', gap:6,
    paddingVertical:8, paddingHorizontal:14, borderRadius:20,
    backgroundColor:'rgba(0,40,80,0.15)', borderWidth:1, borderColor:'rgba(0,40,80,0.2)',
  },
  langBtnFlag:    { fontSize:16 },
  langBtnText:    { color:'#002850', fontSize:13, fontWeight:'600' },
  langBtnChevron: { color:'rgba(0,50,90,0.45)', fontSize:16 },

  suggestion: {
    flexDirection:'row', alignItems:'center', gap:8,
    marginHorizontal:20, marginTop:8, padding:12, borderRadius:10,
    backgroundColor:'rgba(0,60,120,0.12)', borderWidth:1, borderColor:'rgba(0,80,160,0.22)',
  },
  suggestionText:    { flex:1, color:'#002850', fontSize:12, fontWeight:'500' },
  suggestionBtn:     { paddingHorizontal:12, paddingVertical:5, borderRadius:6, backgroundColor:colors.primary },
  suggestionBtnText: { color:'#fff', fontSize:12, fontWeight:'600' },
  suggestionX:       { color:'rgba(0,50,90,0.4)', fontSize:14, padding:4 },

  center: { flex:1, justifyContent:'center', alignItems:'center', paddingHorizontal:32 },

  logoWrap:   { alignItems:'center', marginBottom:32 },
  logoCircle: {
    width:72, height:72, borderRadius:36,
    backgroundColor:'rgba(0,60,120,0.18)',
    borderWidth:2, borderColor:'rgba(0,100,180,0.35)',
    alignItems:'center', justifyContent:'center', marginBottom:12,
  },
  logoLetter: { fontSize:32, fontWeight:'300', color:'#002040' },
  logoText:   { fontSize:26, fontWeight:'300', color:'#001e3c', letterSpacing:8 },

  title:    { fontSize:24, fontWeight:'700', color:'#001428', textAlign:'center', lineHeight:32, marginBottom:14, letterSpacing:-0.3 },
  subtitle: { fontSize:15, fontWeight:'400', color:'rgba(0,35,70,0.72)', textAlign:'center', lineHeight:22, maxWidth:280, marginBottom:24 },

  pillsRow: { flexDirection:'row', gap:8, flexWrap:'wrap', justifyContent:'center' },
  pill:     { paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:'rgba(0,50,100,0.14)', borderWidth:1, borderColor:'rgba(0,80,160,0.22)' },
  pillText: { color:'#002850', fontSize:12, fontWeight:'500' },

  buttons: { paddingHorizontal:24, paddingBottom:24, gap:12 },
  btnPrimary: {
    borderRadius:14, overflow:'hidden',
    shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:14, elevation:8,
  },
  btnGradient:      { paddingVertical:17, alignItems:'center' },
  btnPrimaryText:   { color:'#fff', fontSize:16, fontWeight:'600' },
  btnSecondary:     { paddingVertical:17, alignItems:'center', borderRadius:14, borderWidth:1.5, borderColor:'rgba(0,60,120,0.28)', backgroundColor:'rgba(255,255,255,0.38)' },
  btnSecondaryText: { color:'#002040', fontSize:16, fontWeight:'500' },

  legalText: { textAlign:'center', fontSize:11, color:'rgba(0,40,80,0.42)', lineHeight:16, marginTop:4 },
  legalLink: { color:'#003f7f', textDecorationLine:'underline' },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,15,40,0.65)', justifyContent:'flex-end' },
  langSheet: {
    backgroundColor:'#e4f2fc', borderTopLeftRadius:20, borderTopRightRadius:20,
    maxHeight:height*0.75, paddingBottom:Platform.OS==='ios'?34:20,
  },
  langHandle:     { width:40, height:4, borderRadius:2, backgroundColor:'rgba(0,60,120,0.22)', alignSelf:'center', marginTop:12, marginBottom:16 },
  langSheetTitle: { fontSize:16, fontWeight:'600', color:'#001e3c', textAlign:'center', marginBottom:12, paddingHorizontal:20 },
  langItem:       { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:20, gap:14, borderBottomWidth:1, borderBottomColor:'rgba(0,60,120,0.08)' },
  langItemActive: { backgroundColor:'rgba(0,80,160,0.09)' },
  langFlag:       { fontSize:22 },
  langNames:      { flex:1 },
  langNative:     { color:'#001428', fontSize:15, fontWeight:'600' },
  langEnglish:    { color:'rgba(0,40,80,0.48)', fontSize:12, marginTop:1 },
  langCheck:      { width:22, height:22, borderRadius:11, backgroundColor:colors.primary, alignItems:'center', justifyContent:'center' },
  langCheckText:  { color:'#fff', fontSize:12, fontWeight:'700' },
});
