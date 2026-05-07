/**
 * XIMVID — src/screens/LandingPageScreen.js
 * PANTALLA 9: Landing page del creador
 *
 * Se abre al pulsar el avatar del creador en la columna derecha.
 * Dos modos:
 *  - external: abre URL externa directamente (Linking.openURL)
 *  - internal: muestra la landing generada por la app con:
 *    banner, foto, nombre, descripción, botón CTA,
 *    iconos de redes, galería de últimos 6 videos
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Linking, Dimensions, ActivityIndicator,
  Animated, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import {
  doc, getDoc, collection, query,
  where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db }           from '@services/firebase';
import { colors }       from '@constants/colors';
import { getSocialNetwork, formatFollowers } from '@constants/socialNetworks';
import { creatorUrl }   from '@constants/domains';
import ActionButton     from '@components/ActionButton';

const { width, height } = Dimensions.get('window');
const VIDEO_THUMB_SIZE  = (width - 52) / 3;

export default function LandingPageScreen({ route, navigation }) {
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();
  const { type, url, userId, username } = route.params || {};

  const [user,    setUser]    = useState(null);
  const [videos,  setVideos]  = useState([]);
  const [loading, setLoading] = useState(true);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // ── Modo externo — redirigir y volver ───────────────────────
  useEffect(() => {
    if (type === 'external' && url) {
      Linking.openURL(url).catch(() => {});
      navigation.goBack();
      return;
    }
    loadCreatorData();
  }, [type, url, userId]);

  // ── Cargar datos del creador ─────────────────────────────────
  const loadCreatorData = async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [userSnap, videosSnap] = await Promise.all([
        getDoc(doc(db, 'users', userId)),
        getDocs(query(
          collection(db, 'videos'),
          where('userId',   '==', userId),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(6)
        )),
      ]);

      if (userSnap.exists()) setUser({ uid:userSnap.id, ...userSnap.data() });
      setVideos(videosSnap.docs.map(d => ({ videoId:d.id, ...d.data() })));

      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:350, useNativeDriver:true }),
        Animated.timing(slideAnim, { toValue:0, duration:350, useNativeDriver:true }),
      ]).start();
    } catch (err) {
      console.error('LandingPageScreen:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Carga ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Perfil no encontrado</Text>
        <TouchableOpacity style={s.backBtnCenter} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnCenterText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeLinks = (user.socialLinks || []).filter(l => l.url?.trim());

  return (
    <View style={s.container}>

      {/* Botón volver flotante */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >

        {/* ── Banner ── */}
        <View style={s.bannerWrap}>
          {user.bannerPhoto ? (
            <Image source={{uri:user.bannerPhoto}} style={s.banner} resizeMode="cover"/>
          ) : (
            <LinearGradient
              colors={['#b8dff5','#6ab5e2','#4a9fd4']}
              start={{x:0,y:0}} end={{x:1,y:1}}
              style={s.banner}
            />
          )}
          {/* Gradiente inferior del banner */}
          <LinearGradient
            colors={['transparent','rgba(248,252,255,1)']}
            style={s.bannerGrad}
          />
        </View>

        {/* ── Header del perfil ── */}
        <View style={s.profileHeader}>
          {/* Foto de perfil */}
          <View style={s.avatarWrap}>
            {user.profilePhoto ? (
              <Image source={{uri:user.profilePhoto}} style={s.avatar}/>
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={s.avatarInitial}>
                  {user.name?.charAt(0)?.toUpperCase() || 'X'}
                </Text>
              </View>
            )}
            {user.isPremium && (
              <View style={s.premiumBadge}>
                <Text style={s.premiumBadgeText}>⭐</Text>
              </View>
            )}
          </View>

          {/* Nombre y categoría */}
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user.name}</Text>
            {user.category && (
              <Text style={s.profileCategory}>
                {t(`categories.${user.category}`) || user.category}
              </Text>
            )}
            <Text style={s.profileUrl}>
              ximvid.com/{user.username}
            </Text>
          </View>
        </View>

        {/* ── Descripción corta ── */}
        {user.shortDescription ? (
          <Text style={s.shortDesc}>{user.shortDescription}</Text>
        ) : null}

        {/* ── Descripción larga ── */}
        {user.longDescription ? (
          <Text style={s.longDesc}>{user.longDescription}</Text>
        ) : null}

        {/* ── Botón de acción principal ── */}
        {user.actionButtonText && user.actionButtonURL && (
          <View style={s.ctaWrap}>
            <ActionButton
              text={user.actionButtonText}
              url={user.actionButtonURL}
              videoId="landing"
              videoOwnerId={userId}
            />
          </View>
        )}

        {/* ── Redes sociales ── */}
        {activeLinks.length > 0 && (
          <View style={s.socialSection}>
            <Text style={s.sectionTitle}>Redes y contacto</Text>
            <View style={s.socialGrid}>
              {activeLinks.map((link, i) => {
                const network = getSocialNetwork(link.network);
                if (!network) return null;
                return (
                  <TouchableOpacity
                    key={i}
                    style={s.socialItem}
                    onPress={() => Linking.openURL(link.url)}
                    activeOpacity={0.7}
                  >
                    <View style={s.socialIconWrap}>
                      <Image
                        source={{ uri: network.iconUrl }}
                        style={s.socialIcon}
                        tintColor="#002850"
                      />
                    </View>
                    <Text style={s.socialLabel}>{network.label}</Text>
                    {link.followers > 0 && (
                      <Text style={s.socialFollowers}>
                        {formatFollowers(link.followers)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Galería de últimos videos ── */}
        {videos.length > 0 && (
          <View style={s.videosSection}>
            <Text style={s.sectionTitle}>{t('landing.latestVideos')}</Text>
            <View style={s.videosGrid}>
              {videos.map((video, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.videoThumb}
                  onPress={() => navigation.navigate('Video', { videoId: video.videoId })}
                  activeOpacity={0.85}
                >
                  {video.thumbnailURL ? (
                    <Image
                      source={{ uri: video.thumbnailURL }}
                      style={s.videoThumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.videoThumbImg, s.videoThumbPlaceholder]}>
                      <Text style={s.videoThumbEmoji}>🎬</Text>
                    </View>
                  )}
                  {/* Overlay con visualizaciones */}
                  <LinearGradient
                    colors={['transparent','rgba(0,0,0,0.55)']}
                    style={s.videoThumbGrad}
                  >
                    <Text style={s.videoViews}>
                      {formatFollowers(video.views || 0)} views
                    </Text>
                  </LinearGradient>
                  {/* Botón CTA si tiene */}
                  {video.actionButtonText && (
                    <View style={s.videoCtaBadge}>
                      <Text style={s.videoCtaBadgeText}>🔥</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Banner de descarga de la app ── */}
        <View style={s.downloadBanner}>
          <Text style={s.downloadTitle}>{t('landing.downloadApp')}</Text>
          <View style={s.downloadButtons}>
            <TouchableOpacity
              style={s.downloadBtn}
              onPress={() => Linking.openURL('https://apps.apple.com/app/ximvid')}
            >
              <Text style={s.downloadBtnText}>🍎 {t('landing.appStore')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.downloadBtn}
              onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.ximvid.app')}
            >
              <Text style={s.downloadBtnText}>🤖 {t('landing.googlePlay')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: insets.bottom + 20 }}/>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f0f8ff' },
  centered:  { flex:1, backgroundColor:'#f0f8ff', alignItems:'center', justifyContent:'center', gap:16 },
  errorText: { fontSize:16, color:'#002850', fontWeight:'500' },
  backBtnCenter: { paddingHorizontal:24, paddingVertical:12, backgroundColor:colors.primary, borderRadius:12 },
  backBtnCenterText: { color:'#fff', fontSize:15, fontWeight:'600' },

  scroll: { paddingBottom:20 },

  // Top bar
  topBar: {
    position:'absolute', top:0, left:0, right:0,
    paddingHorizontal:16, paddingBottom:8,
    zIndex:10,
  },
  backBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.85)',
    alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:'rgba(0,60,120,0.15)',
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.1, shadowRadius:4, elevation:3,
  },
  backIcon: { color:'#001e3c', fontSize:24, lineHeight:26 },

  // Banner
  bannerWrap:  { height:200, position:'relative' },
  banner:      { width:'100%', height:'100%' },
  bannerGrad:  { position:'absolute', bottom:0, left:0, right:0, height:80 },

  // Header perfil
  profileHeader: { flexDirection:'row', alignItems:'flex-end', paddingHorizontal:20, marginTop:-30, gap:14, marginBottom:14 },
  avatarWrap:    { position:'relative' },
  avatar:        { width:80, height:80, borderRadius:40, borderWidth:3, borderColor:'#fff', backgroundColor:'rgba(0,60,120,0.12)' },
  avatarPlaceholder: { alignItems:'center', justifyContent:'center' },
  avatarInitial: { fontSize:32, fontWeight:'300', color:'#002040' },
  premiumBadge:  { position:'absolute', top:-4, right:-4, backgroundColor:colors.primary, borderRadius:10, padding:3 },
  premiumBadgeText:{ fontSize:12 },
  profileInfo:   { flex:1, paddingBottom:4 },
  profileName:   { fontSize:20, fontWeight:'700', color:'#001428', marginBottom:2 },
  profileCategory:{ fontSize:13, color:colors.primary, fontWeight:'600', marginBottom:3 },
  profileUrl:    { fontSize:11, color:'rgba(0,40,80,0.45)' },

  // Descripciones
  shortDesc: { fontSize:14, color:'#002850', lineHeight:21, paddingHorizontal:20, marginBottom:10, fontWeight:'500' },
  longDesc:  { fontSize:13, color:'rgba(0,40,80,0.65)', lineHeight:20, paddingHorizontal:20, marginBottom:14 },

  // CTA
  ctaWrap: { paddingHorizontal:20, marginBottom:24 },

  // Secciones
  sectionTitle: { fontSize:16, fontWeight:'700', color:'#001428', marginBottom:14, paddingHorizontal:20 },

  // Redes sociales
  socialSection: { marginBottom:24 },
  socialGrid:    { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:10 },
  socialItem:    { width:(width-52)/4, alignItems:'center', gap:5 },
  socialIconWrap:{ width:48, height:48, borderRadius:14, backgroundColor:'rgba(0,60,120,0.08)', borderWidth:1, borderColor:'rgba(0,60,120,0.15)', alignItems:'center', justifyContent:'center' },
  socialIcon:    { width:26, height:26, resizeMode:'contain' },
  socialLabel:   { fontSize:10, color:'#002850', fontWeight:'600', textAlign:'center' },
  socialFollowers:{ fontSize:10, color:'rgba(0,40,80,0.5)', textAlign:'center' },

  // Videos
  videosSection:      { marginBottom:24 },
  videosGrid:         { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:4 },
  videoThumb:         { width:VIDEO_THUMB_SIZE, height:VIDEO_THUMB_SIZE*1.6, borderRadius:8, overflow:'hidden', backgroundColor:'rgba(0,60,120,0.1)' },
  videoThumbImg:      { width:'100%', height:'100%' },
  videoThumbPlaceholder:{ alignItems:'center', justifyContent:'center' },
  videoThumbEmoji:    { fontSize:24 },
  videoThumbGrad:     { position:'absolute', bottom:0, left:0, right:0, height:40, justifyContent:'flex-end', padding:5 },
  videoViews:         { color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:'600' },
  videoCtaBadge:      { position:'absolute', top:5, right:5 },
  videoCtaBadgeText:  { fontSize:12 },

  // Banner descarga
  downloadBanner:  { marginHorizontal:20, padding:18, borderRadius:16, backgroundColor:'rgba(0,60,120,0.08)', borderWidth:1, borderColor:'rgba(0,60,120,0.15)', marginBottom:10 },
  downloadTitle:   { fontSize:14, fontWeight:'700', color:'#001428', textAlign:'center', marginBottom:12 },
  downloadButtons: { flexDirection:'row', gap:10 },
  downloadBtn:     { flex:1, paddingVertical:11, borderRadius:10, backgroundColor:'rgba(255,255,255,0.7)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)', alignItems:'center' },
  downloadBtnText: { fontSize:13, fontWeight:'600', color:'#001e3c' },
});
