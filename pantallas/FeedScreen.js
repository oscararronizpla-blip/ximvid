/**
 * XIMVID — src/screens/FeedScreen.js
 * PANTALLA 6: Feed principal
 *
 * Elementos:
 *  - Video a pantalla completa (VideoPlayer.js)
 *  - Barra superior: Para ti / Siguiendo / Categorías / Cerca
 *  - Columna derecha: RightColumn.js (avatar fijo + iconos scrollables)
 *  - Texto usuario flotante (solo sombra en letras, sin fondo)
 *  - Botón CTA sobre la barra de navegación
 *  - Barra navegación inferior semitransparente
 *  - Feed filtrado por idioma del usuario
 *  - Scroll vertical con snap entre videos
 *  - Algoritmo: Premium primero, luego por fecha
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, StatusBar, Platform,
  ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import {
  collection, query, where, orderBy,
  limit, getDocs, startAfter, doc, getDoc,
} from 'firebase/firestore';
import { auth, db }      from '@services/firebase';
import { colors }        from '@constants/colors';
import VideoPlayer       from '@components/VideoPlayer';
import RightColumn       from '@components/RightColumn';
import ActionButton      from '@components/ActionButton';
import CategoryFilter    from '@components/CategoryFilter';

const { width, height } = Dimensions.get('window');
const VIDEOS_PER_PAGE   = 8;

// ─── Pestañas del feed ────────────────────────────────────────────
const FEED_TABS = [
  { id:'forYou',    labelKey:'feed.forYou' },
  { id:'following', labelKey:'feed.following' },
  { id:'categories',labelKey:'feed.categories' },
  { id:'nearby',    labelKey:'feed.nearby' },
];

// ─── Item de video (una pantalla completa) ────────────────────────
const VideoItem = React.memo(({
  item, isActive, currentTab, onProfilePress,
}) => {
  const { t } = useTranslation();

  return (
    <View style={{ width, height }}>
      {/* Video de fondo */}
      <VideoPlayer
        videoUrl={item.hlsURL || item.videoURL}
        thumbnailUrl={item.thumbnailURL}
        thumbnailBlurUrl={item.thumbnailBlurURL}
        isActive={isActive}
      />

      {/* Overlay gradiente inferior para legibilidad del texto */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Columna derecha — avatar + iconos de redes */}
      <RightColumn
        userId={item.userId}
        username={item.username}
        socialLinks={item.socialLinks || []}
        isPremium={item.isPremiumUser}
        videoId={item.videoId}
        onAvatarPress={() => onProfilePress(item)}
      />

      {/* Texto del creador flotante */}
      <View style={styles.creatorInfo} pointerEvents="none">
        <View style={styles.creatorNameRow}>
          <Text style={styles.creatorName}>@{item.username}</Text>
          {item.isPremiumUser && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>⭐ Premium</Text>
            </View>
          )}
        </View>
        {item.shortDescription ? (
          <Text style={styles.creatorDesc} numberOfLines={2}>
            {item.shortDescription}
          </Text>
        ) : null}
      </View>

      {/* Botón CTA — solo si el video tiene venta activa */}
      {item.actionButtonText && item.actionButtonURL ? (
        <View style={styles.ctaWrap}>
          <ActionButton
            text={item.actionButtonText}
            url={item.actionButtonURL}
            videoId={item.videoId}
            videoOwnerId={item.userId}
          />
        </View>
      ) : null}
    </View>
  );
});

// ─── Pantalla principal ───────────────────────────────────────────
export default function FeedScreen({ navigation }) {
  const { t, i18n }  = useTranslation();
  const insets       = useSafeAreaInsets();

  const [activeTab,        setActiveTab]        = useState('forYou');
  const [videos,           setVideos]           = useState([]);
  const [currentIndex,     setCurrentIndex]     = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [loadingMore,      setLoadingMore]      = useState(false);
  const [lastDoc,          setLastDoc]          = useState(null);
  const [hasMore,          setHasMore]          = useState(true);
  const [showCategories,   setShowCategories]   = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [userLanguage,     setUserLanguage]     = useState(i18n.language || 'en');
  const [followingIds,     setFollowingIds]     = useState([]);

  const flatListRef  = useRef(null);
  const headerAnim   = useRef(new Animated.Value(1)).current;
  const lastScrollY  = useRef(0);

  // ── Cargar idioma y seguidos del usuario ──────────────────────
  useEffect(() => {
    const loadUserData = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          setUserLanguage(userDoc.data().language || i18n.language || 'en');
        }
        // Cargar IDs de usuarios que sigue
        const followSnap = await getDocs(
          query(collection(db,'followers'), where('followerId','==',uid))
        );
        setFollowingIds(followSnap.docs.map(d => d.data().followingId));
      } catch (err) {
        console.error('FeedScreen loadUserData:', err);
      }
    };
    loadUserData();
  }, []);

  // ── Construir query según pestaña activa ──────────────────────
  const buildQuery = useCallback((afterDoc = null) => {
    let q;

    if (activeTab === 'forYou') {
      // Para ti: mismo idioma, Premium primero, luego por fecha
      q = query(
        collection(db, 'videos'),
        where('userLanguage', '==', userLanguage),
        where('isActive', '==', true),
        orderBy('isPremiumUser', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(VIDEOS_PER_PAGE)
      );
    } else if (activeTab === 'following') {
      // Siguiendo: solo videos de usuarios que sigo
      if (followingIds.length === 0) return null;
      q = query(
        collection(db, 'videos'),
        where('userId', 'in', followingIds.slice(0, 10)), // Firestore max 10 en 'in'
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(VIDEOS_PER_PAGE)
      );
    } else if (activeTab === 'categories' && selectedCategory) {
      // Categorías: filtro por categoría + idioma
      q = query(
        collection(db, 'videos'),
        where('userCategory', '==', selectedCategory),
        where('userLanguage', '==', userLanguage),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(VIDEOS_PER_PAGE)
      );
    } else {
      // Cerca / default: todos del idioma
      q = query(
        collection(db, 'videos'),
        where('userLanguage', '==', userLanguage),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(VIDEOS_PER_PAGE)
      );
    }

    if (afterDoc) {
      q = query(q, startAfter(afterDoc));
    }

    return q;
  }, [activeTab, userLanguage, followingIds, selectedCategory]);

  // ── Cargar videos ─────────────────────────────────────────────
  const loadVideos = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setVideos([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      const q = buildQuery(reset ? null : lastDoc);
      if (!q) {
        setVideos([]);
        setLoading(false);
        return;
      }

      const snap = await getDocs(q);
      const newVideos = snap.docs.map(d => ({ videoId: d.id, ...d.data() }));

      if (reset) {
        setVideos(newVideos);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }

      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === VIDEOS_PER_PAGE);
    } catch (err) {
      console.error('FeedScreen loadVideos:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery, hasMore, loadingMore, lastDoc]);

  // Recargar al cambiar pestaña o categoría
  useEffect(() => {
    loadVideos(true);
  }, [activeTab, selectedCategory, userLanguage]);

  // ── Detectar video activo al hacer scroll ────────────────────
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 60,
  }), []);

  // ── Abrir perfil del creador ──────────────────────────────────
  const handleProfilePress = useCallback((item) => {
    if (item.landingType === 'external' && item.externalLandingURL) {
      navigation.navigate('LandingPage', {
        type: 'external',
        url:  item.externalLandingURL,
      });
    } else {
      navigation.navigate('LandingPage', {
        type:     'internal',
        userId:   item.userId,
        username: item.username,
      });
    }
  }, [navigation]);

  // ── Auto-ocultar header al hacer scroll ──────────────────────
  const onScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    // El header siempre visible — el snap hace que el scroll sea entre videos completos
  }, []);

  // ── Render de cada video ──────────────────────────────────────
  const renderItem = useCallback(({ item, index }) => (
    <VideoItem
      item={item}
      isActive={index === currentIndex}
      currentTab={activeTab}
      onProfilePress={handleProfilePress}
    />
  ), [currentIndex, activeTab, handleProfilePress]);

  const keyExtractor = useCallback((item) => item.videoId, []);

  // ── Pantalla de carga ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>
    );
  }

  // ── Sin videos ────────────────────────────────────────────────
  if (!loading && videos.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent"/>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={styles.emptyText}>
          {activeTab === 'following'
            ? t('feed.noVideosFollowing')
            : t('feed.noVideos')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>

      {/* ── Feed de videos (FlatList con snap) ── */}
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={() => loadVideos(false)}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        scrollEventThrottle={16}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        getItemLayout={(_, index) => ({
          length: height, offset: height * index, index,
        })}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator color={colors.primary}/>
            </View>
          ) : null
        }
      />

      {/* ── Barra superior (pestañas) ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {FEED_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabBtn}
            onPress={() => {
              if (tab.id === 'categories') {
                setShowCategories(!showCategories);
              } else {
                setShowCategories(false);
                setActiveTab(tab.id);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive,
            ]}>
              {t(tab.labelKey)}
            </Text>
            {activeTab === tab.id && <View style={styles.tabIndicator}/>}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Filtro de categorías (dropdown) ── */}
      {showCategories && (
        <View style={[styles.categoriesDropdown, { top: insets.top + 52 }]}>
          <CategoryFilter
            selected={selectedCategory}
            onSelect={(cat) => {
              setSelectedCategory(cat);
              setActiveTab('categories');
              setShowCategories(false);
            }}
          />
        </View>
      )}

      {/* ── Barra de navegación inferior ── */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 4 }]}>
        {[
          { icon:'🏠', route:'Feed',    id:'home' },
          { icon:'🔍', route:'Search',  id:'search' },
          { icon:'+',  route:'Upload',  id:'upload', special:true },
          { icon:'💬', route:'Messages',id:'messages' },
          { icon:'👤', route:'Profile', id:'profile' },
        ].map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.navItem, item.special && styles.navItemSpecial]}
            onPress={() => navigation.navigate(item.route)}
            activeOpacity={0.7}
          >
            {item.special ? (
              <LinearGradient
                colors={['#ff4d6d','#e8003d']}
                style={styles.navItemSpecialGradient}
              >
                <Text style={styles.navItemSpecialIcon}>{item.icon}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.navIcon}>{item.icon}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1, backgroundColor:'#000',
  },

  // Carga
  loadingScreen: {
    flex:1, backgroundColor:'#000',
    alignItems:'center', justifyContent:'center',
  },
  loadingMore: {
    height:80, alignItems:'center', justifyContent:'center',
  },

  // Sin videos
  emptyScreen: {
    flex:1, backgroundColor:'#f0f8ff',
    alignItems:'center', justifyContent:'center', gap:16,
  },
  emptyEmoji: { fontSize:60 },
  emptyText:  { fontSize:16, color:'#002850', textAlign:'center', paddingHorizontal:40, fontWeight:'500' },

  // Gradiente inferior sobre el video
  bottomGradient: {
    position:'absolute', bottom:0, left:0, right:0,
    height:height * 0.35,
  },

  // Info del creador
  creatorInfo: {
    position:'absolute',
    bottom:    Platform.OS==='ios' ? 140 : 120,
    left:      16,
    right:     90, // Espacio para la columna derecha
  },
  creatorNameRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  creatorName: {
    fontSize:      15,
    fontWeight:    '700',
    color:         '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset:{ width:0, height:1 },
    textShadowRadius: 4,
  },
  premiumBadge: {
    backgroundColor: 'rgba(255,77,109,0.85)',
    paddingHorizontal:6, paddingVertical:2,
    borderRadius:6,
  },
  premiumBadgeText: { color:'#fff', fontSize:10, fontWeight:'700' },
  creatorDesc: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.85)',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset:{ width:0, height:1 },
    textShadowRadius: 4,
  },

  // CTA
  ctaWrap: {
    position:'absolute',
    bottom:    Platform.OS==='ios' ? 88 : 72,
    left:      16,
    right:     90,
  },

  // Barra superior
  topBar: {
    position:       'absolute',
    top:            0, left:0, right:0,
    flexDirection:  'row',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom:  12,
    gap:            4,
  },
  tabBtn: {
    alignItems:  'center',
    paddingHorizontal: 10,
    paddingVertical:    4,
    gap: 4,
  },
  tabText: {
    fontSize:   13,
    fontWeight: '500',
    color:      'rgba(255,255,255,0.6)',
    textShadowColor:  'rgba(0,0,0,0.6)',
    textShadowOffset: { width:0, height:1 },
    textShadowRadius: 3,
  },
  tabTextActive: {
    color:      '#fff',
    fontWeight: '700',
  },
  tabIndicator: {
    width:16, height:2, borderRadius:1,
    backgroundColor: colors.primary,
  },

  // Dropdown categorías
  categoriesDropdown: {
    position:  'absolute',
    left:      0, right:0,
    zIndex:    100,
  },

  // Barra navegación inferior
  bottomNav: {
    position:       'absolute',
    bottom:         0, left:0, right:0,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-around',
    paddingTop:     10,
    backgroundColor:'rgba(0,0,0,0.55)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  navItem: {
    alignItems:  'center',
    justifyContent:'center',
    padding:     8,
    minWidth:    44,
    minHeight:   44,
  },
  navItemSpecial: {
    marginTop: -16,
  },
  navItemSpecialGradient: {
    width:  46, height:32,
    borderRadius:10,
    alignItems:'center', justifyContent:'center',
    shadowColor:  colors.primary,
    shadowOffset: {width:0,height:4},
    shadowOpacity:0.5, shadowRadius:8, elevation:6,
  },
  navItemSpecialIcon: { fontSize:20, color:'#fff', fontWeight:'700' },
  navIcon:            { fontSize:22 },
});
