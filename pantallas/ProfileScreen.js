/**
 * XIMVID — src/screens/ProfileScreen.js
 * PANTALLA 10: Perfil personal del usuario (panel de control)
 *
 * Secciones:
 *  1. Mi perfil (editar, foto, botón acción, redes)
 *  2. Mi contenido (videos, subir, borradores)
 *  3. Mis estadísticas
 *  4. Configuración (idioma, notificaciones, privacidad)
 *  5. Comunidad (invitar amigo, valorar app, novedades)
 *  6. Soporte (FAQ, reportar, contacto)
 *  + Cerrar sesión (rojo, separado)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Linking, Alert, Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import { signOut }         from 'firebase/auth';
import {
  doc, getDoc, collection, query,
  where, orderBy, getDocs,
} from 'firebase/firestore';
import { auth, db } from '@services/firebase';
import { colors }   from '@constants/colors';
import { creatorUrl } from '@constants/domains';
import { formatFollowers } from '@constants/socialNetworks';

const { width } = Dimensions.get('window');
const VIDEO_THUMB_SIZE = (width - 52) / 3;

// ─── Fila de opción del menú ──────────────────────────────────────
function MenuRow({ icon, label, sublabel, onPress, danger, badge }) {
  return (
    <TouchableOpacity style={[m.row, danger && m.rowDanger]} onPress={onPress} activeOpacity={0.7}>
      <Text style={m.icon}>{icon}</Text>
      <View style={m.rowText}>
        <Text style={[m.label, danger && m.labelDanger]}>{label}</Text>
        {sublabel ? <Text style={m.sublabel}>{sublabel}</Text> : null}
      </View>
      {badge ? <View style={m.badge}><Text style={m.badgeText}>{badge}</Text></View> : null}
      {!danger && <Text style={m.arrow}>›</Text>}
    </TouchableOpacity>
  );
}

const m = StyleSheet.create({
  row:        { flexDirection:'row', alignItems:'center', paddingVertical:13, paddingHorizontal:20, gap:14, backgroundColor:'rgba(255,255,255,0.5)' },
  rowDanger:  { backgroundColor:'rgba(255,255,255,0.5)' },
  icon:       { fontSize:20, width:28, textAlign:'center' },
  rowText:    { flex:1 },
  label:      { fontSize:14, fontWeight:'600', color:'#001428' },
  labelDanger:{ color:'#c0001e' },
  sublabel:   { fontSize:12, color:'rgba(0,40,80,0.5)', marginTop:1 },
  arrow:      { color:'rgba(0,40,80,0.3)', fontSize:18 },
  badge:      { backgroundColor:colors.primary, borderRadius:10, paddingHorizontal:8, paddingVertical:2 },
  badgeText:  { color:'#fff', fontSize:11, fontWeight:'700' },
});

// ─── Sección de menú ──────────────────────────────────────────────
function MenuSection({ title, children }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

const sec = StyleSheet.create({
  wrap:  { marginBottom:16 },
  title: { fontSize:12, fontWeight:'700', color:'rgba(0,40,80,0.5)', letterSpacing:0.5, textTransform:'uppercase', paddingHorizontal:20, marginBottom:6 },
  card:  { backgroundColor:'transparent', borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:'rgba(0,60,120,0.12)', marginHorizontal:16 },
});

// ─── Pantalla principal ───────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();

  const [user,    setUser]    = useState(null);
  const [videos,  setVideos]  = useState([]);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const [userSnap, videosSnap] = await Promise.all([
        getDoc(doc(db,'users',uid)),
        getDocs(query(
          collection(db,'videos'),
          where('userId','==',uid),
          where('isActive','==',true),
          orderBy('createdAt','desc'),
        )),
      ]);
      if (userSnap.exists()) setUser({ uid, ...userSnap.data() });
      setVideos(videosSnap.docs.map(d => ({ videoId:d.id, ...d.data() })));
      Animated.timing(fadeAnim,{toValue:1,duration:350,useNativeDriver:true}).start();
    } catch (err) {
      console.error('ProfileScreen:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Cerrar sesión ─────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      '¿Seguro que quieres cerrar sesión?',
      [
        { text:'Cancelar', style:'cancel' },
        {
          text: t('profile.logout'),
          style:'destructive',
          onPress: async () => {
            await signOut(auth);
            navigation.reset({ index:0, routes:[{ name:'Welcome' }] });
          },
        },
      ]
    );
  };

  // ── Invitar amigo ─────────────────────────────────────────────
  const handleInvite = (platform) => {
    const url  = creatorUrl(user?.username || '');
    const text = t('invite.message', { url });
    if (platform === 'whatsapp') {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`);
    } else {
      Linking.openURL(`line://msg/text/${encodeURIComponent(text)}`);
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={s.headerBar}>
          <Text style={s.headerTitle}>Ximvid</Text>
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={s.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        style={{ opacity:fadeAnim }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 20 }]}
      >

        {/* ── Cabecera del perfil ── */}
        <LinearGradient
          colors={['#b8dff5','#8ecaec','#6ab5e2']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={s.profileHeader}
        >
          {/* Foto de perfil */}
          <View style={s.avatarWrap}>
            {user?.profilePhoto ? (
              <Image source={{uri:user.profilePhoto}} style={s.avatar}/>
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={s.avatarInitial}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'X'}
                </Text>
              </View>
            )}
            {user?.isPremium && (
              <View style={s.premiumBadge}>
                <Text style={s.premiumBadgeText}>⭐ Premium</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <Text style={s.profileName}>{user?.name || 'Tu perfil'}</Text>
          <Text style={s.profileUsername}>@{user?.username}</Text>
          {user?.shortDescription ? (
            <Text style={s.profileDesc}>{user.shortDescription}</Text>
          ) : null}

          {/* Stats rápidas */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{videos.length}</Text>
              <Text style={s.statLabel}>{t('profile.videos')}</Text>
            </View>
            <View style={s.statDivider}/>
            <View style={s.statItem}>
              <Text style={s.statNum}>{formatFollowers(user?.totalFollowers || 0)}</Text>
              <Text style={s.statLabel}>{t('profile.followers')}</Text>
            </View>
            <View style={s.statDivider}/>
            <View style={s.statItem}>
              <Text style={s.statNum}>{formatFollowers(user?.totalFollowing || 0)}</Text>
              <Text style={s.statLabel}>{t('profile.following')}</Text>
            </View>
          </View>

          {/* Botón editar perfil */}
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => navigation.navigate('ProfileSetup')}
            activeOpacity={0.8}
          >
            <Text style={s.editBtnText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Cuadrícula de videos ── */}
        {videos.length > 0 && (
          <View style={s.videosSection}>
            <View style={s.videosGrid}>
              {videos.slice(0,9).map((video, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.videoThumb}
                  onPress={() => navigation.navigate('Video', { videoId:video.videoId })}
                  activeOpacity={0.85}
                >
                  {video.thumbnailURL ? (
                    <Image source={{uri:video.thumbnailURL}} style={s.videoImg} resizeMode="cover"/>
                  ) : (
                    <View style={[s.videoImg, s.videoImgPlaceholder]}>
                      <Text style={{fontSize:20}}>🎬</Text>
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent','rgba(0,0,0,0.5)']}
                    style={s.videoGrad}
                  >
                    <Text style={s.videoViews}>{formatFollowers(video.views||0)}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            {videos.length > 9 && (
              <TouchableOpacity style={s.seeAllBtn}>
                <Text style={s.seeAllText}>Ver todos mis videos</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Sección 1: Mi perfil ── */}
        <MenuSection title={t('profile.editProfile')}>
          <MenuRow icon="👤" label="Editar perfil y landing" onPress={() => navigation.navigate('ProfileSetup')}/>
          <MenuRow icon="🔗" label="Mis redes y enlaces"     onPress={() => navigation.navigate('SocialLinks')}/>
          <MenuRow icon="🎯" label="Mi botón de acción"      onPress={() => navigation.navigate('ProfileSetup')}/>
        </MenuSection>

        {/* ── Sección 2: Mi contenido ── */}
        <MenuSection title={t('profile.myVideos')}>
          <MenuRow icon="🎬" label={t('profile.myVideos')}    onPress={() => {}} sublabel={`${videos.length} videos`}/>
          <MenuRow icon="⬆️" label={t('profile.uploadVideo')} onPress={() => navigation.navigate('Upload')}/>
          <MenuRow icon="📝" label={t('profile.drafts')}      onPress={() => {}} sublabel="Próximamente"/>
        </MenuSection>

        {/* ── Sección 3: Estadísticas ── */}
        <MenuSection title={t('profile.myStats')}>
          <MenuRow icon="📊" label="Resumen general"           onPress={() => navigation.navigate('Stats')}/>
          <MenuRow icon="🎬" label={t('profile.statsByVideo')} onPress={() => navigation.navigate('Stats', { tab:'videos' })}/>
          <MenuRow icon="📱" label={t('profile.statsByNetwork')} onPress={() => navigation.navigate('Stats', { tab:'networks' })}/>
        </MenuSection>

        {/* ── Sección 4: Premium (si no tiene) ── */}
        {!user?.isPremium && (
          <MenuSection title={t('profile.premiumPlan')}>
            <MenuRow
              icon="⭐"
              label={t('premium.title')}
              sublabel="Mayor visibilidad en el feed"
              onPress={() => navigation.navigate('Settings', { scrollTo:'premium' })}
              badge="PRO"
            />
          </MenuSection>
        )}

        {/* ── Sección 5: Configuración ── */}
        <MenuSection title={t('profile.language')}>
          <MenuRow icon="🌐" label={t('profile.language')}        onPress={() => navigation.navigate('Settings')}/>
          <MenuRow icon="🔔" label={t('profile.notifications')}   onPress={() => navigation.navigate('Settings', { scrollTo:'notifications' })}/>
          <MenuRow icon="🔒" label={t('profile.privacy')}         onPress={() => navigation.navigate('Settings', { scrollTo:'privacy' })}/>
          <MenuRow icon="🔑" label={t('profile.changePassword')}  onPress={() => navigation.navigate('Settings', { scrollTo:'password' })}/>
        </MenuSection>

        {/* ── Sección 6: Comunidad ── */}
        <MenuSection title="Comunidad">
          <MenuRow
            icon="👥"
            label={t('profile.inviteFriend')}
            sublabel="Comparte tu perfil con un amigo"
            onPress={() => Alert.alert(
              t('invite.title'),
              '',
              [
                { text: 'WhatsApp', onPress: () => handleInvite('whatsapp') },
                { text: 'Line',     onPress: () => handleInvite('line') },
                { text: 'Cancelar', style:'cancel' },
              ]
            )}
          />
          <MenuRow icon="⭐" label={t('profile.rateApp')}  onPress={() => Linking.openURL('https://apps.apple.com/app/ximvid')}/>
          <MenuRow icon="🆕" label={t('profile.whatsNew')} onPress={() => {}}/>
        </MenuSection>

        {/* ── Sección 7: Soporte ── */}
        <MenuSection title="Soporte">
          <MenuRow icon="❓" label={t('profile.faq')}           onPress={() => Linking.openURL('https://ximvid.com/help')}/>
          <MenuRow icon="🐛" label={t('profile.reportProblem')} onPress={() => Linking.openURL('mailto:soporte@ximvid.com')}/>
          <MenuRow icon="✉️" label={t('profile.contactUs')}     onPress={() => Linking.openURL('mailto:hola@ximvid.com')}/>
        </MenuSection>

        {/* ── Cerrar sesión ── */}
        <View style={s.logoutSection}>
          <MenuRow icon="🚪" label={t('profile.logout')} onPress={handleLogout} danger/>
        </View>

        {/* ── Eliminar cuenta ── */}
        <TouchableOpacity
          style={s.deleteAccountBtn}
          onPress={() => navigation.navigate('Settings', { scrollTo:'deleteAccount' })}
        >
          <Text style={s.deleteAccountText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>

      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#eef6fc' },
  centered:  { flex:1, backgroundColor:'#eef6fc', alignItems:'center', justifyContent:'center' },
  safeTop:   { backgroundColor:'transparent' },
  scroll:    {},

  // Header bar
  headerBar:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:10 },
  headerTitle:  { fontSize:18, fontWeight:'700', color:'#001428', letterSpacing:1 },
  settingsBtn:  { padding:6 },
  settingsIcon: { fontSize:22 },

  // Perfil header
  profileHeader: { padding:24, paddingTop:20, alignItems:'center', marginBottom:16 },
  avatarWrap:    { position:'relative', marginBottom:12 },
  avatar:        { width:88, height:88, borderRadius:44, borderWidth:3, borderColor:'rgba(255,255,255,0.8)' },
  avatarPlaceholder: { backgroundColor:'rgba(0,60,120,0.18)', alignItems:'center', justifyContent:'center' },
  avatarInitial:     { fontSize:36, fontWeight:'300', color:'#002040' },
  premiumBadge:      { position:'absolute', bottom:-8, left:'50%', marginLeft:-30, backgroundColor:colors.primary, borderRadius:10, paddingHorizontal:8, paddingVertical:3, borderWidth:2, borderColor:'#fff' },
  premiumBadgeText:  { color:'#fff', fontSize:11, fontWeight:'700' },

  profileName:     { fontSize:22, fontWeight:'700', color:'#001428', marginBottom:3 },
  profileUsername: { fontSize:13, color:'rgba(0,40,80,0.6)', marginBottom:6 },
  profileDesc:     { fontSize:13, color:'rgba(0,40,80,0.7)', textAlign:'center', lineHeight:18, marginBottom:16, maxWidth:280 },

  // Stats rápidas
  statsRow:    { flexDirection:'row', alignItems:'center', gap:0, marginBottom:16, backgroundColor:'rgba(255,255,255,0.35)', borderRadius:12, paddingVertical:12, paddingHorizontal:20 },
  statItem:    { flex:1, alignItems:'center' },
  statNum:     { fontSize:18, fontWeight:'700', color:'#001428' },
  statLabel:   { fontSize:11, color:'rgba(0,40,80,0.6)', marginTop:2 },
  statDivider: { width:1, height:30, backgroundColor:'rgba(0,60,120,0.15)' },

  // Editar btn
  editBtn:     { paddingHorizontal:28, paddingVertical:10, borderRadius:12, backgroundColor:'rgba(255,255,255,0.55)', borderWidth:1.5, borderColor:'rgba(0,60,120,0.25)' },
  editBtnText: { fontSize:14, fontWeight:'600', color:'#001e3c' },

  // Videos grid
  videosSection: { marginBottom:16 },
  videosGrid:    { flexDirection:'row', flexWrap:'wrap', gap:3, paddingHorizontal:3 },
  videoThumb:    { width:VIDEO_THUMB_SIZE, height:VIDEO_THUMB_SIZE*1.5, borderRadius:6, overflow:'hidden', backgroundColor:'rgba(0,60,120,0.1)' },
  videoImg:      { width:'100%', height:'100%' },
  videoImgPlaceholder: { alignItems:'center', justifyContent:'center' },
  videoGrad:     { position:'absolute', bottom:0, left:0, right:0, height:32, justifyContent:'flex-end', padding:5 },
  videoViews:    { color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:'600' },
  seeAllBtn:     { alignItems:'center', paddingVertical:12 },
  seeAllText:    { color:colors.primary, fontSize:13, fontWeight:'600' },

  // Secciones
  logoutSection:   { marginHorizontal:16, marginBottom:8, borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:'rgba(200,0,30,0.2)' },
  deleteAccountBtn:{ alignItems:'center', paddingVertical:16 },
  deleteAccountText:{ color:'rgba(180,0,20,0.5)', fontSize:13 },
});
