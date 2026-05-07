/**
 * XIMVID — src/screens/SettingsScreen.js
 * PANTALLA 12: Configuración
 *
 * - Selector de idioma (26 idiomas)
 * - Notificaciones: email / WhatsApp
 * - Plan Premium (activar con Stripe)
 * - Privacidad y cambio de contraseña
 * - Eliminar cuenta (GDPR)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, ActivityIndicator,
  Animated, FlatList, Modal, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import {
  updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, deleteUser,
} from 'firebase/auth';
import { doc, updateDoc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@services/firebase';
import { colors }              from '@constants/colors';
import { SUPPORTED_LANGUAGES, changeLanguage } from '@i18n/index';
import { startPremiumSubscription, getPremiumPriceConfig } from '@services/stripe';
import AppBackground from '@components/AppBackground';

const { height } = Dimensions.get('window');

export default function SettingsScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const insets      = useSafeAreaInsets();

  const [user,              setUser]              = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [savingLang,        setSavingLang]         = useState(false);
  const [langModalOpen,     setLangModalOpen]      = useState(false);
  const [emailNotif,        setEmailNotif]         = useState(true);
  const [whatsappNotif,     setWhatsappNotif]      = useState(false);
  const [whatsappPhone,     setWhatsappPhone]      = useState('');
  const [showWhatsappField, setShowWhatsappField]  = useState(false);
  const [currentPass,       setCurrentPass]        = useState('');
  const [newPass,           setNewPass]            = useState('');
  const [confirmPass,       setConfirmPass]        = useState('');
  const [premiumConfig,     setPremiumConfig]      = useState(null);
  const [premiumLoading,    setPremiumLoading]     = useState(false);
  const [deleteConfirm,     setDeleteConfirm]      = useState('');

  const scrollRef = useRef(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  // Scroll a sección específica si viene del ProfileScreen
  useEffect(() => {
    if (route.params?.scrollTo && scrollRef.current) {
      setTimeout(() => {
        // El scroll automático se implementa con refs en secciones específicas
      }, 500);
    }
  }, [route.params]);

  const loadData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const [userSnap, premConfig] = await Promise.all([
        getDoc(doc(db,'users',uid)),
        getPremiumPriceConfig().catch(() => null),
      ]);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUser(data);
        setEmailNotif(data.emailNotifications ?? true);
        setWhatsappNotif(data.whatsappNotifications ?? false);
        setWhatsappPhone(data.whatsappPhone || '');
      }
      if (premConfig) setPremiumConfig(premConfig);
      Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}).start();
    } catch (err) {
      console.error('SettingsScreen:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Cambiar idioma ────────────────────────────────────────────
  const handleLanguageChange = async (code) => {
    setSavingLang(true);
    try {
      await changeLanguage(code);
      const uid = auth.currentUser?.uid;
      if (uid) await updateDoc(doc(db,'users',uid), { language:code, updatedAt:serverTimestamp() });
    } catch (err) {
      Alert.alert('Error', t('errors.generic'));
    } finally {
      setSavingLang(false);
      setLangModalOpen(false);
    }
  };

  // ── Guardar notificaciones ────────────────────────────────────
  const saveNotifications = async (emailVal, waVal, waPhone) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await updateDoc(doc(db,'users',uid), {
        emailNotifications:    emailVal,
        whatsappNotifications: waVal,
        whatsappPhone:         waPhone || '',
        updatedAt:             serverTimestamp(),
      });
      if (waVal && waPhone) {
        // Activar notificaciones WhatsApp via Firebase Function
        const activateFn = httpsCallable(functions, 'activateWhatsAppNotifications');
        await activateFn({ phoneNumber: waPhone });
      }
    } catch (err) {
      console.error('Settings notifications:', err);
    }
  };

  // ── Toggle email ──────────────────────────────────────────────
  const toggleEmail = (val) => {
    setEmailNotif(val);
    saveNotifications(val, whatsappNotif, whatsappPhone);
  };

  // ── Toggle WhatsApp ───────────────────────────────────────────
  const toggleWhatsapp = (val) => {
    setWhatsappNotif(val);
    setShowWhatsappField(val);
    if (!val) saveNotifications(emailNotif, false, '');
  };

  // ── Guardar número WhatsApp ───────────────────────────────────
  const saveWhatsappPhone = () => {
    if (!whatsappPhone.trim()) {
      Alert.alert('Error', 'Introduce un número de WhatsApp válido.');
      return;
    }
    saveNotifications(emailNotif, true, whatsappPhone.trim());
    setShowWhatsappField(false);
    Alert.alert('✅', 'Notificaciones de WhatsApp activadas.');
  };

  // ── Cambiar contraseña ────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPass !== confirmPass) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }
    if (newPass.length < 8) {
      Alert.alert('Error', t('errors.weakPassword'));
      return;
    }
    try {
      const user       = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      Alert.alert('✅', 'Contraseña actualizada correctamente.');
    } catch (err) {
      Alert.alert('Error', err.code==='auth/wrong-password'
        ? 'Contraseña actual incorrecta.'
        : t('errors.generic'));
    }
  };

  // ── Activar Premium ───────────────────────────────────────────
  const handleActivatePremium = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setPremiumLoading(true);
    try {
      const result = await startPremiumSubscription(uid);
      if (result.canceled) return;
      Alert.alert('⭐ ¡Premium activado!', 'Tu plan Premium está activo. Tus videos ahora tienen mayor visibilidad.');
      await loadData();
    } catch (err) {
      Alert.alert('Error', err.message || t('errors.generic'));
    } finally {
      setPremiumLoading(false);
    }
  };

  // ── Cancelar Premium ──────────────────────────────────────────
  const handleCancelPremium = async () => {
    Alert.alert(
      t('premium.cancelButton'),
      '¿Seguro que quieres cancelar? Tu plan seguirá activo hasta el final del período pagado.',
      [
        { text:'Mantener Premium', style:'cancel' },
        {
          text:'Cancelar suscripción',
          style:'destructive',
          onPress: async () => {
            try {
              const cancelFn = httpsCallable(functions, 'cancelStripeSubscription');
              const { data } = await cancelFn({ userId: auth.currentUser?.uid });
              Alert.alert('✅', `Plan cancelado. Activo hasta: ${new Date(data.cancelAt).toLocaleDateString()}`);
              await loadData();
            } catch (err) {
              Alert.alert('Error', t('errors.generic'));
            }
          },
        },
      ]
    );
  };

  // ── Eliminar cuenta (GDPR) ────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'ELIMINAR') {
      Alert.alert('Error', 'Escribe exactamente ELIMINAR para confirmar.');
      return;
    }
    Alert.alert(
      '⚠️ Eliminar cuenta',
      'Esta acción es irreversible. Se borrarán todos tus videos, estadísticas y datos.',
      [
        { text:'Cancelar', style:'cancel' },
        {
          text:'Eliminar definitivamente',
          style:'destructive',
          onPress: async () => {
            try {
              const uid = auth.currentUser?.uid;
              // Crear solicitud de eliminación (GDPR — la Function la procesa)
              await addDoc(collection(db,'deletionRequests'), {
                userId:      uid,
                email:       auth.currentUser?.email || '',
                status:      'pending',
                requestedAt: serverTimestamp(),
                deletedData: { firestoreUser:false, firestoreVideos:false, storageFiles:false, authAccount:false, stripeCustomer:false },
              });
              await deleteUser(auth.currentUser);
              navigation.reset({ index:0, routes:[{ name:'Welcome' }] });
            } catch (err) {
              Alert.alert('Error', 'Inicia sesión de nuevo antes de eliminar tu cuenta.');
            }
          },
        },
      ]
    );
  };

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language);

  if (loading) {
    return (
      <AppBackground>
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} size="large"/>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={{flex:1}}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Configuración</Text>
          <View style={{width:40}}/>
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          style={{opacity:fadeAnim}}
          contentContainerStyle={[s.scroll, {paddingBottom:insets.bottom+30}]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── IDIOMA ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('settings.languageTitle')}</Text>
            <TouchableOpacity style={s.langRow} onPress={() => setLangModalOpen(true)} activeOpacity={0.8}>
              <Text style={s.langFlag}>{currentLang?.flag}</Text>
              <View style={s.langInfo}>
                <Text style={s.langName}>{currentLang?.nativeName}</Text>
                <Text style={s.langEnglish}>{currentLang?.name}</Text>
              </View>
              {savingLang
                ? <ActivityIndicator color={colors.primary} size="small"/>
                : <Text style={s.rowArrow}>›</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── NOTIFICACIONES ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('settings.notifications')}</Text>

            <View style={s.card}>
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>{t('settings.emailNotifications')}</Text>
                <Switch
                  value={emailNotif}
                  onValueChange={toggleEmail}
                  trackColor={{false:'rgba(0,60,120,0.15)', true:colors.primary}}
                  thumbColor="#fff"
                />
              </View>

              <View style={[s.switchRow, s.switchRowBorder]}>
                <View style={{flex:1}}>
                  <Text style={s.switchLabel}>{t('settings.whatsappNotifications')}</Text>
                  {whatsappNotif && whatsappPhone && (
                    <Text style={s.switchSub}>{whatsappPhone}</Text>
                  )}
                </View>
                <Switch
                  value={whatsappNotif}
                  onValueChange={toggleWhatsapp}
                  trackColor={{false:'rgba(0,60,120,0.15)', true:colors.primary}}
                  thumbColor="#fff"
                />
              </View>

              {showWhatsappField && (
                <View style={s.whatsappField}>
                  <TextInput
                    style={s.waInput}
                    value={whatsappPhone}
                    onChangeText={setWhatsappPhone}
                    placeholder={t('settings.whatsappPhonePlaceholder')}
                    placeholderTextColor="rgba(0,40,80,0.35)"
                    keyboardType="phone-pad"
                    autoFocus
                  />
                  <TouchableOpacity style={s.waSaveBtn} onPress={saveWhatsappPhone}>
                    <Text style={s.waSaveBtnText}>{t('settings.saveButton')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ── PLAN PREMIUM ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('profile.premiumPlan')}</Text>
            <View style={s.card}>
              {user?.isPremium ? (
                <>
                  <View style={s.premiumActiveRow}>
                    <Text style={s.premiumActiveEmoji}>⭐</Text>
                    <View style={{flex:1}}>
                      <Text style={s.premiumActiveTitle}>{t('premium.activeLabel', {
                        date: user.premiumUntil?.toDate?.()?.toLocaleDateString() || '—'
                      })}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={s.premiumCancelBtn} onPress={handleCancelPremium}>
                    <Text style={s.premiumCancelText}>{t('premium.cancelButton')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.premiumDesc}>{t('premium.description')}</Text>
                  {premiumConfig && (
                    <Text style={s.premiumPrice}>
                      {t('premium.price', { price: premiumConfig.monthlyLabel || '9.99€' })}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={s.premiumBtn}
                    onPress={handleActivatePremium}
                    disabled={premiumLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={['#ff4d6d','#e8003d']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.premiumBtnGrad}>
                      {premiumLoading
                        ? <ActivityIndicator color="#fff"/>
                        : <Text style={s.premiumBtnText}>{t('premium.activateButton')} ⭐</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* ── CONTRASEÑA ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('settings.changePassword')}</Text>
            <View style={s.card}>
              {[
                { label:t('settings.currentPassword'), value:currentPass, setter:setCurrentPass },
                { label:t('settings.newPassword'),     value:newPass,     setter:setNewPass },
                { label:t('settings.confirmPassword'), value:confirmPass, setter:setConfirmPass },
              ].map((field,i) => (
                <View key={i} style={[s.passField, i>0 && s.passFieldBorder]}>
                  <Text style={s.passFieldLabel}>{field.label}</Text>
                  <TextInput
                    style={s.passInput}
                    value={field.value}
                    onChangeText={field.setter}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="rgba(0,40,80,0.3)"
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <TouchableOpacity style={s.passBtn} onPress={handleChangePassword}>
                <Text style={s.passBtnText}>{t('settings.saveButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── ELIMINAR CUENTA ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('settings.deleteAccountTitle')}</Text>
            <View style={[s.card, s.deleteCard]}>
              <Text style={s.deleteWarning}>{t('settings.deleteAccountWarning')}</Text>
              <TextInput
                style={s.deleteInput}
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder={t('settings.deleteAccountConfirm')}
                placeholderTextColor="rgba(180,0,20,0.4)"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[s.deleteBtn, deleteConfirm!=='ELIMINAR' && s.deleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirm !== 'ELIMINAR'}
              >
                <Text style={s.deleteBtnText}>{t('settings.deleteAccountButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Animated.ScrollView>

        {/* Modal selector de idioma */}
        <Modal visible={langModalOpen} transparent animationType="slide" onRequestClose={() => setLangModalOpen(false)}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setLangModalOpen(false)}>
            <View style={[s.langSheet, {paddingBottom: insets.bottom+16}]}>
              <View style={s.langHandle}/>
              <Text style={s.langSheetTitle}>{t('settings.languageTitle')}</Text>
              <FlatList
                data={SUPPORTED_LANGUAGES}
                keyExtractor={item => item.code}
                showsVerticalScrollIndicator={false}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[s.langItem, i18n.language===item.code && s.langItemActive]}
                    onPress={() => handleLanguageChange(item.code)}
                  >
                    <Text style={s.langItemFlag}>{item.flag}</Text>
                    <View style={{flex:1}}>
                      <Text style={s.langItemNative}>{item.nativeName}</Text>
                      <Text style={s.langItemEnglish}>{item.name}</Text>
                    </View>
                    {i18n.language===item.code && (
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

      </SafeAreaView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  centered:    { flex:1, alignItems:'center', justifyContent:'center' },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  backBtn:     { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,50,100,0.15)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)', alignItems:'center', justifyContent:'center' },
  backIcon:    { color:'#001e3c', fontSize:24, lineHeight:26 },
  headerTitle: { fontSize:17, fontWeight:'700', color:'#001428' },

  scroll:      { paddingTop:8 },
  section:     { paddingHorizontal:16, marginBottom:20 },
  sectionTitle:{ fontSize:12, fontWeight:'700', color:'rgba(0,40,80,0.5)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:8, paddingHorizontal:4 },
  card:        { backgroundColor:'rgba(255,255,255,0.55)', borderRadius:14, borderWidth:1, borderColor:'rgba(0,60,120,0.12)', overflow:'hidden' },

  // Idioma
  langRow:      { flexDirection:'row', alignItems:'center', padding:16, gap:12 },
  langFlag:     { fontSize:24 },
  langInfo:     { flex:1 },
  langName:     { fontSize:15, fontWeight:'600', color:'#001428' },
  langEnglish:  { fontSize:12, color:'rgba(0,40,80,0.5)', marginTop:1 },
  rowArrow:     { color:'rgba(0,40,80,0.3)', fontSize:20 },

  // Switches
  switchRow:       { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:16 },
  switchRowBorder: { borderTopWidth:1, borderTopColor:'rgba(0,60,120,0.08)' },
  switchLabel:     { flex:1, fontSize:14, fontWeight:'600', color:'#001428' },
  switchSub:       { fontSize:12, color:'rgba(0,40,80,0.5)', marginTop:2 },
  whatsappField:   { padding:14, paddingTop:0, gap:10 },
  waInput:         { backgroundColor:'rgba(255,255,255,0.7)', borderWidth:1.5, borderColor:'rgba(0,60,120,0.25)', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#001428' },
  waSaveBtn:       { backgroundColor:colors.primary, borderRadius:10, paddingVertical:11, alignItems:'center' },
  waSaveBtnText:   { color:'#fff', fontSize:14, fontWeight:'700' },

  // Premium
  premiumActiveRow:  { flexDirection:'row', alignItems:'center', padding:16, gap:12 },
  premiumActiveEmoji:{ fontSize:24 },
  premiumActiveTitle:{ fontSize:14, fontWeight:'600', color:'#001428' },
  premiumCancelBtn:  { margin:14, marginTop:0, paddingVertical:11, borderRadius:10, borderWidth:1.5, borderColor:'rgba(0,60,120,0.2)', alignItems:'center' },
  premiumCancelText: { fontSize:14, fontWeight:'600', color:'rgba(0,50,100,0.6)' },
  premiumDesc:       { fontSize:13, color:'rgba(0,40,80,0.65)', padding:16, paddingBottom:6, lineHeight:19 },
  premiumPrice:      { fontSize:18, fontWeight:'700', color:'#001428', paddingHorizontal:16, paddingBottom:12 },
  premiumBtn:        { margin:14, marginTop:0, borderRadius:12, overflow:'hidden' },
  premiumBtnGrad:    { paddingVertical:14, alignItems:'center' },
  premiumBtnText:    { color:'#fff', fontSize:15, fontWeight:'700' },

  // Contraseña
  passField:       { paddingHorizontal:16, paddingVertical:12 },
  passFieldBorder: { borderTopWidth:1, borderTopColor:'rgba(0,60,120,0.08)' },
  passFieldLabel:  { fontSize:12, fontWeight:'600', color:'rgba(0,40,80,0.55)', marginBottom:6 },
  passInput:       { fontSize:14, color:'#001428', paddingVertical:0 },
  passBtn:         { margin:14, marginTop:6, backgroundColor:'rgba(0,60,120,0.12)', borderRadius:10, paddingVertical:12, alignItems:'center' },
  passBtnText:     { fontSize:14, fontWeight:'700', color:'#001428' },

  // Eliminar cuenta
  deleteCard:    { borderColor:'rgba(200,0,30,0.2)' },
  deleteWarning: { fontSize:13, color:'rgba(0,40,80,0.65)', padding:16, paddingBottom:12, lineHeight:19 },
  deleteInput:   { margin:14, marginTop:0, backgroundColor:'rgba(255,255,255,0.7)', borderWidth:1.5, borderColor:'rgba(200,0,30,0.3)', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#a00020' },
  deleteBtn:     { margin:14, marginTop:0, backgroundColor:'rgba(200,0,30,0.85)', borderRadius:10, paddingVertical:12, alignItems:'center' },
  deleteBtnDisabled:{ backgroundColor:'rgba(200,0,30,0.25)' },
  deleteBtnText: { color:'#fff', fontSize:14, fontWeight:'700' },

  // Modal idioma
  modalOverlay:    { flex:1, backgroundColor:'rgba(0,15,40,0.65)', justifyContent:'flex-end' },
  langSheet:       { backgroundColor:'#e4f2fc', borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:height*0.75 },
  langHandle:      { width:40, height:4, borderRadius:2, backgroundColor:'rgba(0,60,120,0.22)', alignSelf:'center', marginTop:12, marginBottom:14 },
  langSheetTitle:  { fontSize:16, fontWeight:'700', color:'#001e3c', textAlign:'center', marginBottom:10, paddingHorizontal:20 },
  langItem:        { flexDirection:'row', alignItems:'center', paddingVertical:13, paddingHorizontal:20, gap:14, borderBottomWidth:1, borderBottomColor:'rgba(0,60,120,0.07)' },
  langItemActive:  { backgroundColor:'rgba(0,80,160,0.08)' },
  langItemFlag:    { fontSize:22 },
  langItemNative:  { fontSize:15, fontWeight:'600', color:'#001428' },
  langItemEnglish: { fontSize:12, color:'rgba(0,40,80,0.48)', marginTop:1 },
  langCheck:       { width:22, height:22, borderRadius:11, backgroundColor:colors.primary, alignItems:'center', justifyContent:'center' },
  langCheckText:   { color:'#fff', fontSize:12, fontWeight:'700' },
});
