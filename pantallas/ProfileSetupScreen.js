/**
 * XIMVID — src/screens/ProfileSetupScreen.js
 * PANTALLA 4: Configurar perfil
 *
 * Elementos:
 *  - Foto de perfil (expo-image-picker → Firebase Storage)
 *  - Descripción corta (contador 150 chars)
 *  - Botón de acción: texto + URL
 *  - Landing: "Tengo web" → campo URL / "No tengo" → landing interna
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import * as ImagePicker    from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp }  from 'firebase/firestore';
import { auth, db, storage } from '@services/firebase';
import { colors }            from '@constants/colors';
import AppBackground         from '@components/AppBackground';

const MAX_DESC = 150;

// ─── Campo de texto reutilizable ──────────────────────────────────
function Field({ label, value, onChangeText, placeholder, multiline, maxLength, keyboardType, right }) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => { setFocused(true);  Animated.timing(anim,{toValue:1,duration:180,useNativeDriver:false}).start(); };
  const onBlur  = () => { setFocused(false); Animated.timing(anim,{toValue:0,duration:180,useNativeDriver:false}).start(); };

  const borderColor = anim.interpolate({ inputRange:[0,1], outputRange:['rgba(0,60,120,0.25)','rgba(0,100,200,0.7)'] });

  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <Animated.View style={[f.field, { borderColor }, multiline && { height:80, alignItems:'flex-start' }]}>
        <TextInput
          style={[f.input, multiline && { textAlignVertical:'top', paddingTop:10 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(0,40,80,0.35)"
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType || 'default'}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {right}
      </Animated.View>
      {maxLength && (
        <Text style={f.counter}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
}

const f = StyleSheet.create({
  wrap:    { marginBottom:16 },
  label:   { color:'#002040', fontSize:13, fontWeight:'600', marginBottom:8 },
  field:   { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderRadius:12, backgroundColor:'rgba(255,255,255,0.45)', paddingHorizontal:14 },
  input:   { flex:1, color:'#001428', fontSize:14, paddingVertical:Platform.OS==='ios'?13:11 },
  counter: { fontSize:11, color:'rgba(0,40,80,0.45)', textAlign:'right', marginTop:4 },
});

// ─── Pantalla principal ───────────────────────────────────────────
export default function ProfileSetupScreen({ navigation }) {
  const { t } = useTranslation();

  const [photo,       setPhoto]       = useState(null);
  const [description, setDescription] = useState('');
  const [btnText,     setBtnText]     = useState('');
  const [btnUrl,      setBtnUrl]      = useState('');
  const [landingType, setLandingType] = useState('internal'); // 'internal' | 'external'
  const [externalUrl, setExternalUrl] = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [loading,     setLoading]     = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim,{toValue:1,duration:380,useNativeDriver:true}).start();
  },[]);

  // ── Seleccionar foto de perfil ────────────────────────────────
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para elegir una foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled) {
      // Comprimir antes de subir — máx 500KB, 400x400px
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width:400, height:400 } }],
        { compress:0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhoto(compressed.uri);
    }
  };

  // ── Subir foto a Firebase Storage ────────────────────────────
  const uploadPhoto = async (uid) => {
    if (!photo) return null;
    setUploading(true);
    try {
      const response = await fetch(photo);
      const blob     = await response.blob();
      const photoRef = ref(storage, `profilePhotos/${uid}/photo.jpg`);
      await uploadBytes(photoRef, blob, { contentType:'image/jpeg' });
      return await getDownloadURL(photoRef);
    } finally {
      setUploading(false);
    }
  };

  // ── Guardar y continuar ───────────────────────────────────────
  const handleContinue = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const photoURL = await uploadPhoto(uid);
      await updateDoc(doc(db,'users',uid), {
        profilePhoto:       photoURL || '',
        shortDescription:   description.trim(),
        actionButtonText:   btnText.trim(),
        actionButtonURL:    btnUrl.trim(),
        landingType,
        externalLandingURL: landingType === 'external' ? externalUrl.trim() : '',
        updatedAt:          serverTimestamp(),
      });
      navigation.navigate('SocialLinks');
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el perfil. Inténtalo de nuevo.');
      console.error('ProfileSetup:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{opacity:fadeAnim}}>

              {/* Header */}
              <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                  <Text style={s.backIcon}>‹</Text>
                </TouchableOpacity>
                <View style={s.progressWrap}>
                  {[1,2,3,4].map(i => (
                    <View key={i} style={[s.progressDot, i<=3 && s.progressDotActive]}/>
                  ))}
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('SocialLinks')}>
                  <Text style={s.skipText}>{t('profileSetup.skipButton')}</Text>
                </TouchableOpacity>
              </View>

              {/* Título */}
              <View style={s.titleWrap}>
                <Text style={s.title}>{t('profileSetup.title')}</Text>
              </View>

              {/* ── Foto de perfil ── */}
              <View style={s.photoSection}>
                <TouchableOpacity style={s.photoWrap} onPress={pickPhoto} activeOpacity={0.8}>
                  {photo ? (
                    <Image source={{uri:photo}} style={s.photo}/>
                  ) : (
                    <View style={s.photoPlaceholder}>
                      <Text style={s.photoIcon}>📷</Text>
                      <Text style={s.photoLabel}>{t('profileSetup.addPhoto')}</Text>
                    </View>
                  )}
                  {/* Badge de edición */}
                  <View style={s.photoBadge}>
                    <Text style={s.photoBadgeText}>+</Text>
                  </View>
                </TouchableOpacity>
                {uploading && <ActivityIndicator color={colors.primary} style={{marginTop:8}}/>}
              </View>

              {/* ── Descripción corta ── */}
              <View style={s.section}>
                <Field
                  label={t('profileSetup.descriptionLabel')}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('profileSetup.descriptionPlaceholder')}
                  multiline
                  maxLength={MAX_DESC}
                />
              </View>

              {/* ── Botón de acción ── */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('profileSetup.actionButtonTitle')}</Text>
                <Text style={s.sectionSub}>{t('profileSetup.actionButtonSubtitle')}</Text>

                <Field
                  label={t('profileSetup.buttonTextLabel')}
                  value={btnText}
                  onChangeText={setBtnText}
                  placeholder={t('profileSetup.buttonTextPlaceholder')}
                />
                <Field
                  label={t('profileSetup.buttonUrlLabel')}
                  value={btnUrl}
                  onChangeText={setBtnUrl}
                  placeholder={t('profileSetup.buttonUrlPlaceholder')}
                  keyboardType="url"
                />

                {/* Preview del botón */}
                {btnText.trim() !== '' && (
                  <View style={s.btnPreviewWrap}>
                    <Text style={s.btnPreviewLabel}>Vista previa:</Text>
                    <View style={s.btnPreview}>
                      <LinearGradient
                        colors={['#ff4d6d','#e8003d']}
                        start={{x:0,y:0}} end={{x:1,y:0}}
                        style={s.btnPreviewGradient}
                      >
                        <Text style={s.btnPreviewText}>{btnText}</Text>
                      </LinearGradient>
                    </View>
                  </View>
                )}
              </View>

              {/* ── Landing page ── */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('profileSetup.landingTitle')}</Text>

                <View style={s.landingOptions}>
                  {/* Opción: No tengo web */}
                  <TouchableOpacity
                    style={[s.landingOption, landingType==='internal' && s.landingOptionActive]}
                    onPress={() => setLandingType('internal')}
                    activeOpacity={0.8}
                  >
                    <View style={[s.landingRadio, landingType==='internal' && s.landingRadioActive]}>
                      {landingType==='internal' && <View style={s.landingRadioDot}/>}
                    </View>
                    <View style={s.landingOptionText}>
                      <Text style={s.landingOptionLabel}>{t('profileSetup.landingNoWeb')}</Text>
                      <Text style={s.landingOptionSub}>Ximvid crea tu página automáticamente</Text>
                    </View>
                    <Text style={s.landingBadge}>✨ Gratis</Text>
                  </TouchableOpacity>

                  {/* Opción: Tengo web */}
                  <TouchableOpacity
                    style={[s.landingOption, landingType==='external' && s.landingOptionActive]}
                    onPress={() => setLandingType('external')}
                    activeOpacity={0.8}
                  >
                    <View style={[s.landingRadio, landingType==='external' && s.landingRadioActive]}>
                      {landingType==='external' && <View style={s.landingRadioDot}/>}
                    </View>
                    <View style={s.landingOptionText}>
                      <Text style={s.landingOptionLabel}>{t('profileSetup.landingHasWeb')}</Text>
                      <Text style={s.landingOptionSub}>Linktree, web propia, Carrd...</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Campo URL externa */}
                {landingType === 'external' && (
                  <Animated.View style={{marginTop:12}}>
                    <Field
                      label="URL de tu web o landing"
                      value={externalUrl}
                      onChangeText={setExternalUrl}
                      placeholder={t('profileSetup.externalUrlPlaceholder')}
                      keyboardType="url"
                    />
                  </Animated.View>
                )}
              </View>

              {/* Botón continuar */}
              <View style={s.btnWrap}>
                <TouchableOpacity
                  style={s.btn}
                  onPress={handleContinue}
                  disabled={loading || uploading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#ff4d6d','#e8003d']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={s.btnGradient}
                  >
                    {(loading || uploading)
                      ? <ActivityIndicator color="#fff"/>
                      : <Text style={s.btnText}>{t('profileSetup.continueButton')}</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
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
  skipText: { color:'rgba(0,50,100,0.55)', fontSize:13, fontWeight:'500' },

  progressWrap:      { flexDirection:'row', gap:6 },
  progressDot:       { width:8, height:8, borderRadius:4, backgroundColor:'rgba(0,60,120,0.2)' },
  progressDotActive: { backgroundColor:colors.primary, width:20 },

  titleWrap: { paddingHorizontal:24, paddingTop:8, paddingBottom:20 },
  title:     { fontSize:22, fontWeight:'700', color:'#001428', letterSpacing:-0.3 },

  // Foto
  photoSection: { alignItems:'center', marginBottom:24 },
  photoWrap:    { position:'relative' },
  photo:        { width:100, height:100, borderRadius:50, borderWidth:3, borderColor:'rgba(0,100,200,0.4)' },
  photoPlaceholder: {
    width:100, height:100, borderRadius:50,
    backgroundColor:'rgba(255,255,255,0.4)',
    borderWidth:2, borderColor:'rgba(0,80,160,0.3)',
    borderStyle:'dashed',
    alignItems:'center', justifyContent:'center', gap:4,
  },
  photoIcon:  { fontSize:28 },
  photoLabel: { fontSize:10, color:'#002850', fontWeight:'600' },
  photoBadge: {
    position:'absolute', bottom:2, right:2,
    width:26, height:26, borderRadius:13,
    backgroundColor:colors.primary,
    alignItems:'center', justifyContent:'center',
    borderWidth:2, borderColor:'rgba(255,255,255,0.8)',
  },
  photoBadgeText: { color:'#fff', fontSize:16, lineHeight:18, fontWeight:'700' },

  // Secciones
  section:      { paddingHorizontal:24, marginBottom:8 },
  sectionTitle: { fontSize:15, fontWeight:'700', color:'#001428', marginBottom:4 },
  sectionSub:   { fontSize:12, color:'rgba(0,40,80,0.58)', marginBottom:14 },

  // Preview botón
  btnPreviewWrap:     { marginTop:4, marginBottom:8 },
  btnPreviewLabel:    { fontSize:11, color:'rgba(0,40,80,0.5)', marginBottom:6 },
  btnPreview:         { borderRadius:10, overflow:'hidden', alignSelf:'flex-start' },
  btnPreviewGradient: { paddingVertical:10, paddingHorizontal:20 },
  btnPreviewText:     { color:'#fff', fontSize:14, fontWeight:'600' },

  // Landing options
  landingOptions: { gap:10 },
  landingOption: {
    flexDirection:'row', alignItems:'center', gap:12,
    padding:14, borderRadius:12,
    backgroundColor:'rgba(255,255,255,0.38)',
    borderWidth:1.5, borderColor:'rgba(0,60,120,0.2)',
  },
  landingOptionActive: { borderColor:colors.primary, backgroundColor:'rgba(255,77,109,0.06)' },
  landingRadio:        { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'rgba(0,60,120,0.3)', alignItems:'center', justifyContent:'center' },
  landingRadioActive:  { borderColor:colors.primary },
  landingRadioDot:     { width:10, height:10, borderRadius:5, backgroundColor:colors.primary },
  landingOptionText:   { flex:1 },
  landingOptionLabel:  { fontSize:13, fontWeight:'600', color:'#001428', marginBottom:2 },
  landingOptionSub:    { fontSize:11, color:'rgba(0,40,80,0.55)' },
  landingBadge:        { fontSize:11, color:colors.primary, fontWeight:'600' },

  // Botón
  btnWrap: { paddingHorizontal:24, paddingTop:16, paddingBottom:24 },
  btn: {
    borderRadius:14, overflow:'hidden',
    shadowColor:colors.primary, shadowOffset:{width:0,height:6},
    shadowOpacity:0.38, shadowRadius:14, elevation:8,
  },
  btnGradient: { paddingVertical:17, alignItems:'center' },
  btnText:     { color:'#fff', fontSize:16, fontWeight:'600' },
});
