/**
 * XIMVID — src/screens/VideoScreen.js
 * PANTALLA 7: Detalle de un video específico
 *
 * Se abre al llegar por enlace externo: app.ximvid.com/video/videoId
 * Igual que FeedScreen pero para un solo video.
 * Incluye botón de volver y carga los datos del video desde Firestore.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import { doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { db }            from '@services/firebase';
import { colors }        from '@constants/colors';
import VideoPlayer       from '@components/VideoPlayer';
import RightColumn       from '@components/RightColumn';
import ActionButton      from '@components/ActionButton';

const { width, height } = Dimensions.get('window');

export default function VideoScreen({ route, navigation }) {
  const { t }    = useTranslation();
  const insets   = useSafeAreaInsets();
  const { videoId } = route.params || {};

  const [video,   setVideo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Cargar datos del video ────────────────────────────────────
  useEffect(() => {
    if (!videoId) { setError(true); setLoading(false); return; }

    const loadVideo = async () => {
      try {
        const snap = await getDoc(doc(db, 'videos', videoId));
        if (!snap.exists() || !snap.data().isActive) {
          setError(true);
          return;
        }
        const data = { videoId: snap.id, ...snap.data() };

        // Cargar datos adicionales del creador (socialLinks, landingType...)
        const userSnap = await getDoc(doc(db, 'users', data.userId));
        if (userSnap.exists()) {
          const user = userSnap.data();
          data.socialLinks       = user.socialLinks || [];
          data.shortDescription  = user.shortDescription || '';
          data.landingType       = user.landingType || 'internal';
          data.externalLandingURL= user.externalLandingURL || '';
          data.profilePhoto      = user.profilePhoto || '';
        }

        setVideo(data);

        // Incrementar visualizaciones
        updateDoc(doc(db,'videos',videoId), {
          views: increment(1),
        }).catch(() => {});

        // Animación de entrada
        Animated.timing(fadeAnim, {
          toValue:1, duration:300, useNativeDriver:true,
        }).start();

      } catch (err) {
        console.error('VideoScreen:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  // ── Ir al perfil del creador ──────────────────────────────────
  const handleProfilePress = () => {
    if (!video) return;
    if (video.landingType === 'external' && video.externalLandingURL) {
      navigation.navigate('LandingPage', { type:'external', url: video.externalLandingURL });
    } else {
      navigation.navigate('LandingPage', { type:'internal', userId: video.userId, username: video.username });
    }
  };

  // ── Estados de carga y error ──────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor="#000"/>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>
    );
  }

  if (error || !video) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor="#000"/>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorText}>{t('moderation.contentRemoved')}</Text>
        <TouchableOpacity style={styles.backBtnCenter} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnCenterText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>

      {/* Video a pantalla completa */}
      <Animated.View style={[styles.videoWrap, { opacity: fadeAnim }]}>
        <VideoPlayer
          videoUrl={video.hlsURL || video.videoURL}
          thumbnailUrl={video.thumbnailURL}
          thumbnailBlurUrl={video.thumbnailBlurURL}
          isActive={true}
        />

        {/* Gradiente inferior */}
        <LinearGradient
          colors={['transparent','rgba(0,0,0,0.6)']}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        {/* Columna derecha */}
        <RightColumn
          userId={video.userId}
          username={video.username}
          socialLinks={video.socialLinks || []}
          isPremium={video.isPremiumUser}
          videoId={video.videoId}
          onAvatarPress={handleProfilePress}
        />

        {/* Info del creador */}
        <View style={styles.creatorInfo} pointerEvents="none">
          <Text style={styles.creatorName}>@{video.username}</Text>
          {video.shortDescription ? (
            <Text style={styles.creatorDesc} numberOfLines={2}>
              {video.shortDescription}
            </Text>
          ) : null}
        </View>

        {/* Botón CTA */}
        {video.actionButtonText && video.actionButtonURL && (
          <View style={[styles.ctaWrap, { bottom: insets.bottom + 70 }]}>
            <ActionButton
              text={video.actionButtonText}
              url={video.actionButtonURL}
              videoId={video.videoId}
              videoOwnerId={video.userId}
            />
          </View>
        )}
      </Animated.View>

      {/* Botón volver */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Video</Text>
        <View style={{ width: 40 }}/>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#000' },

  centered: {
    flex:1, backgroundColor:'#000',
    alignItems:'center', justifyContent:'center', gap:16,
  },
  errorEmoji: { fontSize:48 },
  errorText:  { color:'rgba(255,255,255,0.7)', fontSize:16, textAlign:'center' },
  backBtnCenter: {
    marginTop:8, paddingHorizontal:24, paddingVertical:12,
    backgroundColor:colors.primary, borderRadius:12,
  },
  backBtnCenterText: { color:'#fff', fontSize:15, fontWeight:'600' },

  videoWrap:      { position:'absolute', top:0, left:0, right:0, bottom:0 },
  bottomGradient: { position:'absolute', bottom:0, left:0, right:0, height:height*0.35 },

  creatorInfo: {
    position:'absolute', bottom:130, left:16, right:90,
  },
  creatorName: {
    fontSize:15, fontWeight:'700', color:'#fff', marginBottom:4,
    textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4,
  },
  creatorDesc: {
    fontSize:13, color:'rgba(255,255,255,0.85)', lineHeight:18,
    textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4,
  },

  ctaWrap: { position:'absolute', left:16, right:90 },

  topBar: {
    position:'absolute', top:0, left:0, right:0,
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:16, paddingBottom:12,
  },
  backBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(0,0,0,0.4)',
    alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:'rgba(255,255,255,0.2)',
  },
  backIcon:  { color:'#fff', fontSize:24, lineHeight:26 },
  topTitle:  {
    color:'#fff', fontSize:15, fontWeight:'600',
    textShadowColor:'rgba(0,0,0,0.5)', textShadowOffset:{width:0,height:1}, textShadowRadius:3,
  },
});
