/**
 * XIMVID — src/screens/RegisterScreen.js
 * PANTALLA 2: Registro
 * Fondo: azul tecnológico + círculos + código binario (AppBackground)
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, OAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@services/firebase';
import { colors }   from '@constants/colors';
import AppBackground from '@components/AppBackground';

function isEmail(str) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim()); }

// ─── Campo de texto ───────────────────────────────────────────────
function InputField({ label, placeholder, value, onChangeText, error, secureTextEntry, keyboardType, autoCapitalize, rightElement }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => { setFocused(true);  Animated.timing(borderAnim, { toValue:1, duration:200, useNativeDriver:false }).start(); };
  const onBlur  = () => { setFocused(false); Animated.timing(borderAnim, { toValue:0, duration:200, useNativeDriver:false }).start(); };

  const borderColor = borderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      error ? 'rgba(200,0,30,0.5)' : 'rgba(0,60,120,0.25)',
      error ? '#c0001e'            : 'rgba(0,80,180,0.7)',
    ],
  });

  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <Animated.View style={[f.field, { borderColor }]}>
        <TextInput
          style={f.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(0,40,80,0.35)"
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
        />
        {rightElement}
      </Animated.View>
      {error ? <Text style={f.error}>{error}</Text> : null}
    </View>
  );
}

const f = StyleSheet.create({
  wrap:  { marginBottom:16 },
  label: { color:'#002040', fontSize:13, marginBottom:8, fontWeight:'600' },
  field: {
    flexDirection:'row', alignItems:'center',
    borderWidth:1.5, borderRadius:12,
    backgroundColor:'rgba(255,255,255,0.45)',
    paddingHorizontal:16,
  },
  input: { flex:1, color:'#001428', fontSize:15, paddingVertical:Platform.OS==='ios'?14:12 },
  error: { color:'#c0001e', fontSize:12, marginTop:6, fontWeight:'500' },
});

// ─── Pantalla ─────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue:1, duration:380, useNativeDriver:true }).start();
  }, []);

  const validate = useCallback(() => {
    const errs = {};
    if (!name.trim())                          errs.name     = t('errors.generic');
    if (!isEmail(email) && email.length < 7)   errs.email    = t('errors.invalidEmail');
    if (password.length < 8)                   errs.password = t('errors.weakPassword');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, email, password, t]);

  const createUserDoc = async (uid, data) => {
    await setDoc(doc(db, 'users', uid), {
      uid, email:data.email||'', phone:'', name:data.name, username:'',
      profilePhoto:data.photoURL||'', bannerPhoto:'', category:'',
      shortDescription:'', longDescription:'', language:'en',
      additionalLanguages:[], timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',
      actionButtonText:'', actionButtonURL:'', landingType:'internal',
      externalLandingURL:'', socialLinks:[], isPremium:false,
      premiumSince:null, premiumUntil:null, stripeCustomerId:'',
      emailNotifications:true, whatsappNotifications:false, whatsappPhone:'',
      isBanned:false, isVerified:false, isAdmin:false,
      reportCount:0, totalVideos:0, totalFollowers:0, totalFollowing:0,
      createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
    });
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await createUserDoc(cred.user.uid, { email:email.trim(), name:name.trim() });
      navigation.navigate('UserType');
    } catch (err) {
      setErrors({ submit: err.code==='auth/email-already-in-use' ? t('errors.emailInUse') : t('errors.generic') });
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const cred  = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNew = cred._tokenResponse?.isNewUser;
      if (isNew) await createUserDoc(cred.user.uid, { email:cred.user.email, name:cred.user.displayName||'', photoURL:cred.user.photoURL||'' });
      navigation.navigate(isNew ? 'UserType' : 'Feed');
    } catch { setErrors({ submit: t('errors.generic') }); }
    finally { setLoading(false); }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email'); provider.addScope('name');
      const cred  = await signInWithPopup(auth, provider);
      const isNew = cred._tokenResponse?.isNewUser;
      if (isNew) await createUserDoc(cred.user.uid, { email:cred.user.email, name:cred.user.displayName||'' });
      navigation.navigate(isNew ? 'UserType' : 'Feed');
    } catch { setErrors({ submit: t('errors.generic') }); }
    finally { setLoading(false); }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View style={{opacity:fadeAnim}}>

              {/* Header */}
              <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                  <Text style={s.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={s.headerTitle}>Ximvid</Text>
                <View style={{width:40}}/>
              </View>

              {/* Título */}
              <View style={s.titleWrap}>
                <Text style={s.title}>Crea tu cuenta</Text>
                <Text style={s.subtitle}>Empieza a conseguir clientes desde el primer día</Text>
              </View>

              {/* Social buttons */}
              <View style={s.socialButtons}>
                <TouchableOpacity style={s.socialBtn} onPress={handleGoogle} disabled={loading} activeOpacity={0.8}>
                  <Text style={s.socialBtnText}>{t('register.googleButton')}</Text>
                </TouchableOpacity>
                {Platform.OS==='ios' && (
                  <TouchableOpacity style={[s.socialBtn, s.appleBtn]} onPress={handleApple} disabled={loading} activeOpacity={0.8}>
                    <Text style={[s.socialBtnText, {color:'#001428'}]}>{t('register.appleButton')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Divisor */}
              <View style={s.divider}>
                <View style={s.dividerLine}/>
                <Text style={s.dividerText}>{t('register.orContinueWith')}</Text>
                <View style={s.dividerLine}/>
              </View>

              {/* Formulario */}
              <View style={s.form}>
                <InputField label={t('register.nameLabel')} placeholder={t('register.namePlaceholder')} value={name} onChangeText={setName} error={errors.name} autoCapitalize="words"/>
                <InputField label={t('register.emailLabel')} placeholder={t('register.emailPlaceholder')} value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address"/>
                <InputField
                  label={t('register.passwordLabel')} placeholder={t('register.passwordPlaceholder')}
                  value={password} onChangeText={setPassword} error={errors.password}
                  secureTextEntry={!showPass}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{padding:8}}>
                      <Text style={{color:'rgba(0,60,120,0.45)', fontSize:13, fontWeight:'500'}}>{showPass?'Ocultar':'Ver'}</Text>
                    </TouchableOpacity>
                  }
                />

                {errors.submit && (
                  <View style={s.submitError}>
                    <Text style={s.submitErrorText}>{errors.submit}</Text>
                  </View>
                )}

                <TouchableOpacity style={s.submitBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient colors={['#ff4d6d','#e8003d']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.submitBtnGrad}>
                    {loading ? <ActivityIndicator color="#fff"/> : <Text style={s.submitBtnText}>{t('register.continueButton')}</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={s.loginRow}>
                  <Text style={s.loginText}>{t('register.alreadyHaveAccount')} </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={s.loginLink}>{t('register.loginLink')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom:40 },

  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  backBtn: { width:40, height:40, alignItems:'center', justifyContent:'center', borderRadius:20, backgroundColor:'rgba(0,50,100,0.15)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)' },
  backIcon: { color:'#001e3c', fontSize:24, lineHeight:26 },
  headerTitle: { color:'#001428', fontSize:16, fontWeight:'700', letterSpacing:1 },

  titleWrap: { paddingHorizontal:24, paddingVertical:24 },
  title:     { fontSize:26, fontWeight:'700', color:'#001428', marginBottom:8, letterSpacing:-0.3 },
  subtitle:  { fontSize:14, color:'rgba(0,40,80,0.6)', fontWeight:'500' },

  socialButtons: { paddingHorizontal:24, gap:10 },
  socialBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
    paddingVertical:15, borderRadius:12,
    backgroundColor:'rgba(255,255,255,0.45)',
    borderWidth:1, borderColor:'rgba(0,60,120,0.2)',
  },
  appleBtn:     { backgroundColor:'rgba(255,255,255,0.75)', borderColor:'rgba(0,40,80,0.25)' },
  socialBtnText:{ color:'#001e3c', fontSize:15, fontWeight:'600' },

  divider:     { flexDirection:'row', alignItems:'center', paddingHorizontal:24, marginVertical:22, gap:12 },
  dividerLine: { flex:1, height:1, backgroundColor:'rgba(0,60,120,0.18)' },
  dividerText: { color:'rgba(0,50,100,0.5)', fontSize:12, fontWeight:'500' },

  form: { paddingHorizontal:24 },

  submitError:     { backgroundColor:'rgba(200,0,30,0.1)', borderWidth:1, borderColor:'rgba(200,0,30,0.3)', borderRadius:10, padding:12, marginBottom:16 },
  submitErrorText: { color:'#a00020', fontSize:13, textAlign:'center', fontWeight:'500' },

  submitBtn:     { borderRadius:12, overflow:'hidden', marginTop:8, shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.38, shadowRadius:14, elevation:8 },
  submitBtnGrad: { paddingVertical:17, alignItems:'center' },
  submitBtnText: { color:'#fff', fontSize:16, fontWeight:'600' },

  loginRow:  { flexDirection:'row', justifyContent:'center', marginTop:20 },
  loginText: { color:'rgba(0,40,80,0.55)', fontSize:14 },
  loginLink: { color:colors.primary, fontSize:14, fontWeight:'600' },
});
