/**
 * XIMVID — src/components/RightColumn.js
 * Columna derecha del feed: avatar fijo + iconos de redes scrollables.
 *
 * Especificación exacta:
 * - Avatar 38px, circular, borde blanco 2.5px, FUERA del scroll (sticky)
 * - Al pulsar avatar: navegar a LandingPageScreen
 * - Lista scrollable de iconos debajo del avatar
 * - Icono: logo blanco puro, trazo 2.2px, tamaño 28-30px
 * - Sombra gris (no negra): shadowColor '#888'
 * - Debajo de cada icono: número de seguidores en blanco 10px con sombra
 * - Al pulsar icono: Linking.openURL directo, sin confirmación
 * - Degradado al final de la lista
 * - Botón compartir al final
 * - Solo iconos con URL configurada
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Linking, FlatList, Dimensions, Animated,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import * as Sharing        from 'expo-sharing';
import { doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { db, auth }        from '@services/firebase';
import { colors }          from '@constants/colors';
import { getSocialNetwork, formatFollowers } from '@constants/socialNetworks';
import { videoUrl }        from '@constants/domains';

const { height } = Dimensions.get('window');

// ─── Icono de red social individual ──────────────────────────────
function SocialIcon({ link, videoId, videoOwnerId }) {
  const network  = getSocialNetwork(link.network);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (!network || !link.url) return null;

  const handlePress = async () => {
    // Animación de feedback
    Animated.sequence([
      Animated.timing(scaleAnim,{toValue:0.82,duration:80,useNativeDriver:true}),
      Animated.timing(scaleAnim,{toValue:1,duration:120,useNativeDriver:true}),
    ]).start();

    // Abrir URL directamente — sin confirmación
    try {
      await Linking.openURL(link.url);
    } catch {
      // Si la URL falla, intentar en el navegador
      await Linking.openURL(link.url.startsWith('http') ? link.url : `https://${link.url}`);
    }

    // Registrar el click en Firestore (sin await — no bloquear la UI)
    try {
      const uid = auth.currentUser?.uid;
      // Escribir en socialClicks — el trigger onSocialClick lo recoge
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db,'socialClicks'), {
        videoId,
        videoOwnerId,
        network:   link.network,
        clickedAt: serverTimestamp(),
        visitorId: uid || `anonymous_${Date.now()}`,
      });
    } catch (err) {
      // Silencioso — el click en la red ya se realizó
    }
  };

  return (
    <Animated.View style={[styles.iconWrap, { transform:[{scale:scaleAnim}] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.iconBtn}>
        <Image
          source={{ uri: network.iconUrl }}
          style={styles.iconImg}
          tintColor="#ffffff"
        />
        {link.followers > 0 && (
          <Text style={styles.iconFollowers}>
            {formatFollowers(link.followers)}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Componente principal ─────────────────────────────────────────
export default function RightColumn({
  userId, username, socialLinks, isPremium,
  videoId, onAvatarPress,
}) {
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showGradient, setShowGradient] = useState(false);
  const listRef = useRef(null);

  // Cargar foto de perfil del creador
  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db,'users',userId))
      .then(snap => {
        if (snap.exists()) setProfilePhoto(snap.data().profilePhoto || null);
      })
      .catch(() => {});
  }, [userId]);

  // Solo mostrar iconos con URL configurada
  const activeLinks = (socialLinks || []).filter(l => l.url?.trim());

  // Compartir el video
  const handleShare = async () => {
    const url = videoUrl(videoId);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(url);
    } else {
      await Linking.openURL(url);
    }
    // Registrar share click
    try {
      await updateDoc(doc(db,'videos',videoId), {
        shareClicks: increment(1),
      });
    } catch {}
  };

  const maxIconsVisible = Math.floor((height * 0.5) / 64); // ~64px por icono

  return (
    <View style={styles.container}>

      {/* ── Avatar (sticky, fuera del scroll) ── */}
      <TouchableOpacity
        style={styles.avatarWrap}
        onPress={onAvatarPress}
        activeOpacity={0.85}
      >
        {profilePhoto ? (
          <Image source={{uri:profilePhoto}} style={styles.avatar}/>
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {username?.charAt(0)?.toUpperCase() || 'X'}
            </Text>
          </View>
        )}
        {/* Badge + de seguir */}
        <View style={styles.avatarPlusBadge}>
          <Text style={styles.avatarPlusText}>+</Text>
        </View>
        {/* Badge Premium */}
        {isPremium && (
          <View style={styles.avatarPremiumBadge}>
            <Text style={styles.avatarPremiumText}>⭐</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Lista scrollable de iconos ── */}
      <View style={styles.iconsContainer}>
        <FlatList
          ref={listRef}
          data={activeLinks}
          keyExtractor={(item, i) => `${item.network}_${i}`}
          showsVerticalScrollIndicator={false}
          scrollEnabled={activeLinks.length > maxIconsVisible}
          onScroll={({nativeEvent}) => {
            const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
            const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
            setShowGradient(!isAtBottom && activeLinks.length > maxIconsVisible);
          }}
          renderItem={({ item }) => (
            <SocialIcon
              link={item}
              videoId={videoId}
              videoOwnerId={userId}
            />
          )}
          ListFooterComponent={
            // Botón compartir al final de la lista
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Image
                source={{ uri: 'https://cdn.ximvid.com/assets/icons/share.png' }}
                style={styles.shareIcon}
                tintColor="#ffffff"
              />
              <Text style={styles.shareLabel}>Share</Text>
            </TouchableOpacity>
          }
        />

        {/* Degradado al final — indica que hay más iconos */}
        {showGradient && (
          <LinearGradient
            colors={['transparent','rgba(0,0,0,0.6)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:  'absolute',
    right:     10,
    bottom:    Platform.OS === 'ios' ? 130 : 110,
    alignItems:'center',
    zIndex:    10,
  },

  // Avatar
  avatarWrap: {
    position:   'relative',
    marginBottom: 16,
  },
  avatar: {
    width:        38,
    height:       38,
    borderRadius: 19,
    borderWidth:  2.5,
    borderColor:  '#ffffff',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '700',
  },
  avatarPlusBadge: {
    position:        'absolute',
    bottom:          -6,
    left:            '50%',
    marginLeft:      -9,
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     '#fff',
  },
  avatarPlusText:    { color:'#fff', fontSize:12, fontWeight:'700', lineHeight:14 },
  avatarPremiumBadge:{ position:'absolute', top:-4, right:-4 },
  avatarPremiumText: { fontSize:12 },

  // Contenedor de iconos
  iconsContainer: {
    maxHeight:  height * 0.45,
    position:   'relative',
  },

  // Icono individual
  iconWrap: {
    alignItems:   'center',
    marginBottom: 16,
  },
  iconBtn: {
    alignItems: 'center',
    gap:        4,
  },
  iconImg: {
    width:       28,
    height:      28,
    resizeMode:  'contain',
    // Sombra gris (no negra) — efecto de profundidad
    shadowColor:   '#888',
    shadowOffset:  { width:0, height:3 },
    shadowOpacity: 0.5,
    shadowRadius:  6,
  },
  iconFollowers: {
    color:       '#ffffff',
    fontSize:    10,
    fontWeight:  '600',
    textShadowColor:  'rgba(0,0,0,0.8)',
    textShadowOffset: { width:0, height:1 },
    textShadowRadius: 3,
  },

  // Botón compartir
  shareBtn: {
    alignItems:   'center',
    marginBottom: 8,
    gap:          4,
    marginTop:    4,
  },
  shareIcon:  { width:28, height:28, resizeMode:'contain' },
  shareLabel: {
    color:       '#fff',
    fontSize:    10,
    fontWeight:  '600',
    textShadowColor:  'rgba(0,0,0,0.8)',
    textShadowOffset: { width:0, height:1 },
    textShadowRadius: 3,
  },

  // Degradado inferior
  bottomGradient: {
    position: 'absolute',
    bottom:   0, left:0, right:0,
    height:   40,
  },
});
