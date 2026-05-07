/**
 * XIMVID — src/screens/UploadScreen.js
 * PANTALLA 8: Subir video
 *
 * Tres opciones:
 *  1. Galería del móvil
 *  2. Grabar con cámara
 *  3. Importar URL (TikTok / Instagram) ← diferencial clave
 *
 * Flujo tras seleccionar:
 *  Paso 1: Elegir intención (vender producto / servicio / compartir)
 *  Paso 2: Confirmar botón de acción
 *  → Subir a Firebase Storage → guardar en Firestore
 *  → Si es el primer video: Email 10 (via onFirstVideo trigger)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker    from 'expo-image-picker';
import * as Camera         from 'expo-camera';
import {
  ref, uploadBytesResumable, getDownloadURL,
} from 'firebase/storage';
import {
  addDoc, collection, doc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db, storage } from '@services/firebase';
import { colors }            from '@constants/colors';
import AppBackground         from '@components/AppBackground';

const { width, height } = Dimensions.get('window');

const INTENTIONS = [
  { id:'selling_product',  emoji:'📦', labelKey:'upload.sellingProduct',  color:'#e05a1a' },
  { id:'selling_service',  emoji:'💼', labelKey:'upload.sellingService',  color:'#5b28c4' },
  { id:'sharing_content',  emoji:'🎬', labelKey:'upload.sharingContent',  color:'#0775a8' },
];

export default function UploadScreen({ navigation }) {
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();

  // Estado del flujo
  const [step,         setStep]         = useState(0); // 0=opciones, 1=intención, 2=botón, 3=subiendo
  const [videoUri,     setVideoUri]     = useState(null);
  const [importUrl,    setImportUrl]    = useState('');
  const [showImport,   setShowImport]   = useState(false);
  const [intention,    setIntention]    = useState(null);
  const [btnText,      setBtnText]      = useState('');
  const [btnUrl,       setBtnUrl]       = useState('');
  const [useProfileBtn,setUseProfileBtn]= useState(true);
  const [progress,     setProgress]     = useState(0);
  const [loading,      setLoading]      = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Cargar botón de acción del perfil como valor por defecto
    const loadProfileBtn = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const snap = await getDoc(doc(db,'users',uid));
      if (snap.exists()) {
        setBtnText(snap.data().actionButtonText || '');
        setBtnUrl(snap.data().actionButtonURL   || '');
      }
    };
    loadProfileBtn();

    Animated.parallel([
      Animated.timing(fadeAnim,  {toValue:1,  duration:350, useNativeDriver:true}),
      Animated.timing(slideAnim, {toValue:0,  duration:350, useNativeDriver:true}),
    ]).start();
  }, []);

  // ── Animación entre pasos ─────────────────────────────────────
  const animateStep = (nextStep) => {
    Animated.timing(slideAnim, {toValue:30, duration:150, useNativeDriver:true}).start(() => {
      setStep(nextStep);
      Animated.timing(slideAnim, {toValue:0, duration:200, useNativeDriver:true}).start();
    });
  };

  // ── Seleccionar de galería ────────────────────────────────────
  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality:       1,
      videoMaxDuration: 90, // Máx 90 segundos
    });
    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      animateStep(1);
    }
  };

  // ── Grabar con cámara ─────────────────────────────────────────
  const recordWithCamera = async () => {
    const perm = await Camera.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes:       ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 90,
      quality:          1,
    });
    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      animateStep(1);
    }
  };

  // ── Importar desde URL ────────────────────────────────────────
  const handleImportUrl = () => {
    if (!importUrl.trim()) {
      Alert.alert('Error', 'Pega la URL del video primero.');
      return;
    }
    // Guardamos la URL directamente — Firebase Function la procesará
    // La Function descargará el video y lo subirá al Storage
    setVideoUri(importUrl.trim());
    setShowImport(false);
    animateStep(1);
  };

  // ── Subir video a Firebase Storage ───────────────────────────
  const uploadVideo = async (uid) => {
    // Si es URL externa, la Firebase Function la procesa — aquí solo guardamos la URL
    const isExternalUrl = videoUri.startsWith('http');

    if (isExternalUrl) {
      // La URL se guarda directamente — Firebase Function onVideoUploaded
      // descargará y comprimirá el video automáticamente
      return {
        videoURL:    videoUri,
        isImported:  true,
        isProcessing:true,
      };
    }

    // Subida de archivo local
    const videoId  = `${uid}_${Date.now()}`;
    const videoRef = ref(storage, `videos/${uid}/${videoId}/original.mp4`);
    const response = await fetch(videoUri);
    const blob     = await response.blob();

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(videoRef, blob, {
        contentType: 'video/mp4',
      });

      uploadTask.on('state_changed',
        (snapshot) => {
          const prog = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(prog);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            videoURL:     url,
            videoId,
            isProcessing: true, // Firebase Function comprimirá y generará HLS
          });
        }
      );
    });
  };

  // ── Publicar video ────────────────────────────────────────────
  const handlePublish = async () => {
    if (!intention) {
      Alert.alert('Selecciona', 'Elige la intención del video antes de publicar.');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setLoading(true);
    setStep(3);

    try {
      const uploadResult = await uploadVideo(uid);

      // Obtener datos del usuario para el video
      const userSnap = await getDoc(doc(db,'users',uid));
      const user     = userSnap.data();

      // Crear documento del video en Firestore
      await addDoc(collection(db,'videos'), {
        userId:           uid,
        username:         user.username || '',
        userLanguage:     user.language || 'en',
        userCategory:     user.category || '',
        isPremiumUser:    user.isPremium || false,
        videoURL:         uploadResult.videoURL,
        videoURLOriginal: uploadResult.videoURL,
        thumbnailURL:     '',  // La Function lo genera
        thumbnailBlurURL: '',  // La Function lo genera
        hlsURL:           '',  // La Function lo genera
        duration:         0,
        fileSizeMB:       0,
        resolution:       '',
        intention,
        actionButtonText: useProfileBtn ? user.actionButtonText : btnText.trim(),
        actionButtonURL:  useProfileBtn ? user.actionButtonURL  : btnUrl.trim(),
        views:            0,
        uniqueViews:      0,
        actionClicks:     0,
        shareClicks:      0,
        isActive:         true,
        isProcessing:     uploadResult.isProcessing || false,
        processingError:  '',
        reportCount:      0,
        isReported:       false,
        isSuspended:      false,
        createdAt:        serverTimestamp(),
        updatedAt:        serverTimestamp(),
      });

      // Email 10 (primer video) se dispara desde onFirstVideo en sendgrid-triggers.js

      Alert.alert(
        '¡Publicado! 🎉',
        t('upload.successMessage'),
        [{ text: 'Ver feed', onPress: () => navigation.navigate('Feed') }]
      );

    } catch (err) {
      console.error('UploadScreen publish:', err);
      Alert.alert('Error', t('errors.uploadFailed'));
      setStep(2);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // ── PASO 0: Opciones de origen ────────────────────────────────
  const renderStep0 = () => (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>{t('upload.title')}</Text>

      {/* Galería */}
      <TouchableOpacity style={s.optionCard} onPress={pickFromGallery} activeOpacity={0.8}>
        <LinearGradient colors={['rgba(0,80,160,0.15)','rgba(0,60,120,0.08)']} style={s.optionGrad}>
          <Text style={s.optionEmoji}>🖼️</Text>
          <View style={s.optionText}>
            <Text style={s.optionTitle}>{t('upload.fromGallery')}</Text>
            <Text style={s.optionSub}>Sube un video que ya tienes en tu móvil</Text>
          </View>
          <Text style={s.optionArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Cámara */}
      <TouchableOpacity style={s.optionCard} onPress={recordWithCamera} activeOpacity={0.8}>
        <LinearGradient colors={['rgba(0,80,160,0.15)','rgba(0,60,120,0.08)']} style={s.optionGrad}>
          <Text style={s.optionEmoji}>🎥</Text>
          <View style={s.optionText}>
            <Text style={s.optionTitle}>{t('upload.recordNow')}</Text>
            <Text style={s.optionSub}>Graba directamente con tu cámara</Text>
          </View>
          <Text style={s.optionArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Importar URL — el gran diferencial */}
      <TouchableOpacity
        style={[s.optionCard, s.optionCardStar]}
        onPress={() => setShowImport(!showImport)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={['rgba(255,77,109,0.12)','rgba(232,0,61,0.06)']} style={s.optionGrad}>
          <Text style={s.optionEmoji}>✨</Text>
          <View style={s.optionText}>
            <Text style={[s.optionTitle, {color:colors.primary}]}>
              {t('upload.importFromNetwork')}
            </Text>
            <Text style={s.optionSub}>
              Pega el link de tu TikTok o Instagram — sin volver a subir nada
            </Text>
          </View>
          <Text style={[s.optionArrow, {color:colors.primary}]}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Campo de URL de importación */}
      {showImport && (
        <View style={s.importWrap}>
          <TextInput
            style={s.importInput}
            value={importUrl}
            onChangeText={setImportUrl}
            placeholder={t('upload.importPlaceholder')}
            placeholderTextColor="rgba(0,40,80,0.35)"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity style={s.importBtn} onPress={handleImportUrl} activeOpacity={0.85}>
            <LinearGradient colors={['#ff4d6d','#e8003d']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.importBtnGrad}>
              <Text style={s.importBtnText}>{t('upload.importButton')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Info de límites */}
      <View style={s.limitsWrap}>
        <Text style={s.limitText}>⏱ {t('upload.maxDuration')}</Text>
        <Text style={s.limitText}>📦 {t('upload.maxSize')}</Text>
      </View>
    </View>
  );

  // ── PASO 1: Intención del video ───────────────────────────────
  const renderStep1 = () => (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>{t('upload.intentionTitle')}</Text>

      {/* Preview del video seleccionado */}
      {videoUri && !videoUri.startsWith('http') && (
        <View style={s.previewWrap}>
          <Video
            source={{ uri: videoUri }}
            style={s.preview}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            useNativeControls={false}
          />
          <View style={s.previewOverlay}>
            <Text style={s.previewLabel}>Vista previa</Text>
          </View>
        </View>
      )}

      {videoUri?.startsWith('http') && (
        <View style={s.importedBadge}>
          <Text style={s.importedBadgeText}>🔗 Video importado desde URL</Text>
        </View>
      )}

      {/* Opciones de intención */}
      {INTENTIONS.map(int => (
        <TouchableOpacity
          key={int.id}
          style={[s.intentionCard, intention===int.id && {borderColor:int.color, backgroundColor:`${int.color}12`}]}
          onPress={() => setIntention(int.id)}
          activeOpacity={0.8}
        >
          <Text style={s.intentionEmoji}>{int.emoji}</Text>
          <Text style={[s.intentionLabel, intention===int.id && {color:int.color, fontWeight:'700'}]}>
            {t(int.labelKey)}
          </Text>
          {intention===int.id && (
            <View style={[s.intentionCheck, {backgroundColor:int.color}]}>
              <Text style={s.intentionCheckText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[s.nextBtn, !intention && s.nextBtnDisabled]}
        onPress={() => intention && animateStep(2)}
        disabled={!intention}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={intention ? ['#ff4d6d','#e8003d'] : ['rgba(0,50,100,0.2)','rgba(0,50,100,0.2)']}
          start={{x:0,y:0}} end={{x:1,y:0}}
          style={s.nextBtnGrad}
        >
          <Text style={[s.nextBtnText, !intention && s.nextBtnTextDisabled]}>Siguiente</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── PASO 2: Botón de acción ───────────────────────────────────
  const renderStep2 = () => (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>{t('upload.actionButtonLabel')}</Text>

      {/* Opción: usar el del perfil */}
      <TouchableOpacity
        style={[s.intentionCard, useProfileBtn && {borderColor:colors.primary, backgroundColor:'rgba(255,77,109,0.06)'}]}
        onPress={() => setUseProfileBtn(true)}
        activeOpacity={0.8}
      >
        <Text style={s.intentionEmoji}>👤</Text>
        <View style={{flex:1}}>
          <Text style={[s.intentionLabel, useProfileBtn && {color:colors.primary, fontWeight:'700'}]}>
            {t('upload.actionButtonSameAsProfile')}
          </Text>
          {btnText ? <Text style={s.profileBtnPreview}>{btnText}</Text> : null}
        </View>
        {useProfileBtn && <View style={[s.intentionCheck,{backgroundColor:colors.primary}]}><Text style={s.intentionCheckText}>✓</Text></View>}
      </TouchableOpacity>

      {/* Opción: personalizar */}
      <TouchableOpacity
        style={[s.intentionCard, !useProfileBtn && {borderColor:'#0775a8', backgroundColor:'rgba(7,117,168,0.06)'}]}
        onPress={() => setUseProfileBtn(false)}
        activeOpacity={0.8}
      >
        <Text style={s.intentionEmoji}>✏️</Text>
        <Text style={[s.intentionLabel, !useProfileBtn && {color:'#0775a8', fontWeight:'700'}]}>
          {t('upload.actionButtonCustomise')}
        </Text>
        {!useProfileBtn && <View style={[s.intentionCheck,{backgroundColor:'#0775a8'}]}><Text style={s.intentionCheckText}>✓</Text></View>}
      </TouchableOpacity>

      {/* Campos personalizados */}
      {!useProfileBtn && (
        <View style={s.customBtnFields}>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Texto del botón</Text>
            <TextInput
              style={s.fieldInput}
              value={btnText}
              onChangeText={setBtnText}
              placeholder="Ej: Ver mi tienda, Reservar..."
              placeholderTextColor="rgba(0,40,80,0.35)"
              autoCapitalize="sentences"
            />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>URL destino</Text>
            <TextInput
              style={s.fieldInput}
              value={btnUrl}
              onChangeText={setBtnUrl}
              placeholder="https://"
              placeholderTextColor="rgba(0,40,80,0.35)"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </View>
      )}

      {/* Botón publicar */}
      <TouchableOpacity style={s.publishBtn} onPress={handlePublish} activeOpacity={0.85}>
        <LinearGradient colors={['#ff4d6d','#e8003d']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.publishBtnGrad}>
          <Text style={s.publishBtnText}>{t('upload.publishButton')} 🚀</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── PASO 3: Subiendo ──────────────────────────────────────────
  const renderStep3 = () => (
    <View style={s.uploadingWrap}>
      <ActivityIndicator color={colors.primary} size="large"/>
      <Text style={s.uploadingText}>
        {progress > 0 && progress < 100
          ? t('upload.uploadingProgress', { percent: progress })
          : t('upload.processing')}
      </Text>
      {progress > 0 && progress < 100 && (
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width:`${progress}%` }]}/>
        </View>
      )}
    </View>
  );

  return (
    <AppBackground>
      <SafeAreaView style={{flex:1}}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => step > 0 ? animateStep(step-1) : navigation.goBack()}
            >
              <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>

            {/* Steps indicator */}
            <View style={s.stepsRow}>
              {['Origen','Intención','Botón'].map((label,i) => (
                <View key={i} style={s.stepIndicator}>
                  <View style={[s.stepDot, step >= i && s.stepDotActive]}>
                    <Text style={[s.stepDotNum, step >= i && s.stepDotNumActive]}>{i+1}</Text>
                  </View>
                  {i < 2 && <View style={[s.stepLine, step > i && s.stepLineActive]}/>}
                </View>
              ))}
            </View>

            <View style={{width:40}}/>
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{opacity:fadeAnim, transform:[{translateY:slideAnim}]}}>
              {step === 0 && renderStep0()}
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </Animated.View>
          </ScrollView>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  scroll:   { paddingBottom:40 },
  stepWrap: { paddingHorizontal:24, paddingTop:16 },

  header: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:16, paddingVertical:12,
  },
  backBtn:  { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,50,100,0.15)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)', alignItems:'center', justifyContent:'center' },
  backIcon: { color:'#001e3c', fontSize:24, lineHeight:26 },

  stepsRow:        { flexDirection:'row', alignItems:'center' },
  stepIndicator:   { flexDirection:'row', alignItems:'center' },
  stepDot:         { width:24, height:24, borderRadius:12, backgroundColor:'rgba(0,60,120,0.15)', borderWidth:1.5, borderColor:'rgba(0,60,120,0.25)', alignItems:'center', justifyContent:'center' },
  stepDotActive:   { backgroundColor:colors.primary, borderColor:colors.primary },
  stepDotNum:      { fontSize:11, fontWeight:'700', color:'rgba(0,60,120,0.5)' },
  stepDotNumActive:{ color:'#fff' },
  stepLine:        { width:20, height:2, backgroundColor:'rgba(0,60,120,0.15)', marginHorizontal:2 },
  stepLineActive:  { backgroundColor:colors.primary },

  stepTitle: { fontSize:20, fontWeight:'700', color:'#001428', marginBottom:20, letterSpacing:-0.3 },

  // Opciones de origen
  optionCard: { marginBottom:12, borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:'rgba(0,60,120,0.18)' },
  optionCardStar: { borderColor:'rgba(255,77,109,0.3)' },
  optionGrad: { flexDirection:'row', alignItems:'center', padding:16, gap:14 },
  optionEmoji:{ fontSize:28 },
  optionText: { flex:1 },
  optionTitle:{ fontSize:15, fontWeight:'700', color:'#001428', marginBottom:3 },
  optionSub:  { fontSize:12, color:'rgba(0,40,80,0.58)', lineHeight:16 },
  optionArrow:{ fontSize:22, color:'rgba(0,60,120,0.4)', fontWeight:'300' },

  // Importar URL
  importWrap: { marginBottom:12, gap:10 },
  importInput:{ backgroundColor:'rgba(255,255,255,0.5)', borderWidth:1.5, borderColor:'rgba(0,80,160,0.35)', borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:14, color:'#001428' },
  importBtn:  { borderRadius:12, overflow:'hidden' },
  importBtnGrad:{ paddingVertical:13, alignItems:'center' },
  importBtnText:{ color:'#fff', fontSize:15, fontWeight:'700' },

  // Límites
  limitsWrap: { marginTop:8, gap:4 },
  limitText:  { fontSize:12, color:'rgba(0,40,80,0.5)', fontWeight:'500' },

  // Preview video
  previewWrap:    { height:180, borderRadius:12, overflow:'hidden', marginBottom:20, backgroundColor:'#000' },
  preview:        { width:'100%', height:'100%' },
  previewOverlay: { position:'absolute', bottom:8, left:12 },
  previewLabel:   { color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:'600' },
  importedBadge:  { backgroundColor:'rgba(255,77,109,0.12)', borderRadius:10, padding:12, marginBottom:16, borderWidth:1, borderColor:'rgba(255,77,109,0.3)' },
  importedBadgeText:{ color:'#001428', fontSize:13, fontWeight:'600', textAlign:'center' },

  // Intención
  intentionCard:  { flexDirection:'row', alignItems:'center', padding:16, borderRadius:12, borderWidth:1.5, borderColor:'rgba(0,60,120,0.2)', backgroundColor:'rgba(255,255,255,0.38)', marginBottom:10, gap:12 },
  intentionEmoji: { fontSize:24 },
  intentionLabel: { flex:1, fontSize:14, fontWeight:'600', color:'#001428' },
  intentionCheck: { width:22, height:22, borderRadius:11, alignItems:'center', justifyContent:'center' },
  intentionCheckText:{ color:'#fff', fontSize:12, fontWeight:'700' },
  profileBtnPreview: { fontSize:11, color:'rgba(0,40,80,0.55)', marginTop:2 },

  // Botón siguiente / publicar
  nextBtn:         { marginTop:16, borderRadius:14, overflow:'hidden', shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.35, shadowRadius:14, elevation:8 },
  nextBtnDisabled: { shadowOpacity:0, elevation:0 },
  nextBtnGrad:     { paddingVertical:17, alignItems:'center' },
  nextBtnText:     { color:'#fff', fontSize:16, fontWeight:'700' },
  nextBtnTextDisabled: { color:'rgba(0,50,100,0.4)' },

  // Campos personalizados
  customBtnFields:{ marginTop:12, gap:12 },
  fieldWrap:      { gap:6 },
  fieldLabel:     { fontSize:13, fontWeight:'600', color:'#002040' },
  fieldInput:     { backgroundColor:'rgba(255,255,255,0.5)', borderWidth:1.5, borderColor:'rgba(0,60,120,0.25)', borderRadius:10, paddingHorizontal:12, paddingVertical:Platform.OS==='ios'?12:10, fontSize:14, color:'#001428' },

  // Publicar
  publishBtn:     { marginTop:20, borderRadius:14, overflow:'hidden', shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:14, elevation:8 },
  publishBtnGrad: { paddingVertical:17, alignItems:'center' },
  publishBtnText: { color:'#fff', fontSize:16, fontWeight:'700' },

  // Subiendo
  uploadingWrap:  { flex:1, alignItems:'center', justifyContent:'center', padding:40, gap:20 },
  uploadingText:  { fontSize:15, color:'#002040', fontWeight:'600', textAlign:'center' },
  progressBar:    { width:'100%', height:6, backgroundColor:'rgba(0,60,120,0.15)', borderRadius:3, overflow:'hidden' },
  progressFill:   { height:'100%', backgroundColor:colors.primary, borderRadius:3 },
});
