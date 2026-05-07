/**
 * XIMVID — src/screens/SearchScreen.js
 * PANTALLA 13: Búsqueda
 *
 * - Campo de búsqueda libre
 * - Búsqueda por nombre, username, categoría
 * - Resultados filtrados por idioma del usuario por defecto
 * - Toggle para ver todos los idiomas
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Image, ActivityIndicator, Animated,
  Dimensions, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import {
  collection, query, where, orderBy,
  limit, getDocs, or,
} from 'firebase/firestore';
import { auth, db } from '@services/firebase';
import { colors }   from '@constants/colors';
import { formatFollowers } from '@constants/socialNetworks';
import AppBackground from '@components/AppBackground';

const { width } = Dimensions.get('window');

// ─── Tarjeta de resultado de usuario ─────────────────────────────
function UserCard({ user, onPress }) {
  return (
    <TouchableOpacity style={uc.card} onPress={onPress} activeOpacity={0.8}>
      {user.profilePhoto ? (
        <Image source={{uri:user.profilePhoto}} style={uc.avatar}/>
      ) : (
        <View style={[uc.avatar, uc.avatarPlaceholder]}>
          <Text style={uc.avatarInitial}>{user.name?.charAt(0)?.toUpperCase()||'X'}</Text>
        </View>
      )}
      <View style={uc.info}>
        <View style={uc.nameRow}>
          <Text style={uc.name} numberOfLines={1}>{user.name}</Text>
          {user.isPremium && <Text style={uc.premiumBadge}>⭐</Text>}
        </View>
        <Text style={uc.username}>@{user.username}</Text>
        {user.shortDescription ? (
          <Text style={uc.desc} numberOfLines={1}>{user.shortDescription}</Text>
        ) : null}
      </View>
      <View style={uc.stats}>
        <Text style={uc.statNum}>{formatFollowers(user.totalFollowers||0)}</Text>
        <Text style={uc.statLabel}>seguidores</Text>
      </View>
    </TouchableOpacity>
  );
}

const uc = StyleSheet.create({
  card:            { flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:16, gap:12, borderBottomWidth:1, borderBottomColor:'rgba(0,60,120,0.08)', backgroundColor:'rgba(255,255,255,0.4)' },
  avatar:          { width:52, height:52, borderRadius:26, borderWidth:2, borderColor:'rgba(0,100,200,0.2)' },
  avatarPlaceholder:{ backgroundColor:'rgba(0,60,120,0.12)', alignItems:'center', justifyContent:'center' },
  avatarInitial:   { fontSize:22, fontWeight:'300', color:'#002040' },
  info:            { flex:1 },
  nameRow:         { flexDirection:'row', alignItems:'center', gap:6, marginBottom:2 },
  name:            { fontSize:15, fontWeight:'700', color:'#001428', flex:1 },
  premiumBadge:    { fontSize:14 },
  username:        { fontSize:12, color:'rgba(0,40,80,0.55)', marginBottom:3 },
  desc:            { fontSize:12, color:'rgba(0,40,80,0.55)' },
  stats:           { alignItems:'center' },
  statNum:         { fontSize:14, fontWeight:'700', color:'#001428' },
  statLabel:       { fontSize:10, color:'rgba(0,40,80,0.5)' },
});

// ─── Pantalla principal ───────────────────────────────────────────
export default function SearchScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets       = useSafeAreaInsets();

  const [query_,       setQuery_]       = useState('');
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [searched,     setSearched]     = useState(false);
  const [allLanguages, setAllLanguages] = useState(false);
  const [userLanguage, setUserLanguage] = useState(i18n.language || 'en');

  const inputRef  = useRef(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const searchTimeout = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}).start();
    // Cargar idioma del usuario
    const uid = auth.currentUser?.uid;
    if (uid) {
      getDocs(query(collection(db,'users'), where('uid','==',uid), limit(1)))
        .then(snap => {
          if (!snap.empty) setUserLanguage(snap.docs[0].data().language || i18n.language);
        }).catch(()=>{});
    }
  }, []);

  // ── Búsqueda con debounce ─────────────────────────────────────
  const handleSearch = useCallback((text) => {
    setQuery_(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim() || text.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    searchTimeout.current = setTimeout(() => doSearch(text.trim()), 400);
  }, [allLanguages, userLanguage]);

  const doSearch = async (text) => {
    setLoading(true);
    setSearched(true);
    try {
      const textLower = text.toLowerCase();

      // Firestore no soporta búsqueda de texto completo.
      // Buscamos por username (campo indexado) y complementamos con name.
      // Para producción se recomienda Algolia o Firebase Extensions: Search.
      const constraints = [
        where('isBanned', '==', false),
        limit(20),
      ];
      if (!allLanguages) {
        constraints.push(where('language', '==', userLanguage));
      }

      // Búsqueda por username (prefijo)
      const usernameQ = query(
        collection(db,'users'),
        ...constraints,
        where('username', '>=', textLower),
        where('username', '<=', textLower + '\uf8ff'),
        orderBy('username'),
      );

      // Búsqueda por categoría
      const categoryQ = query(
        collection(db,'users'),
        ...constraints,
        where('category', '==', text),
      );

      const [usernameSnap, categorySnap] = await Promise.all([
        getDocs(usernameQ),
        getDocs(categoryQ),
      ]);

      // Combinar y deduplicar resultados
      const seen = new Set();
      const combined = [];

      [...usernameSnap.docs, ...categorySnap.docs].forEach(d => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          const data = d.data();
          // Filtrar por nombre también (cliente-side para el campo name)
          const nameMatch = data.name?.toLowerCase().includes(textLower);
          const usernameMatch = data.username?.toLowerCase().includes(textLower);
          const catMatch = data.category?.toLowerCase().includes(textLower);
          if (nameMatch || usernameMatch || catMatch) {
            combined.push({ uid:d.id, ...data });
          }
        }
      });

      // Ordenar: Premium primero, luego por seguidores
      combined.sort((a,b) => {
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        return (b.totalFollowers||0) - (a.totalFollowers||0);
      });

      setResults(combined);
    } catch (err) {
      console.error('SearchScreen:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (user) => {
    navigation.navigate('LandingPage', {
      type:     user.landingType === 'external' ? 'external' : 'internal',
      url:      user.externalLandingURL || '',
      userId:   user.uid,
      username: user.username,
    });
  };

  return (
    <AppBackground>
      <SafeAreaView style={{flex:1}}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={s.searchBar}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              value={query_}
              onChangeText={handleSearch}
              placeholder="Buscar creadores, marcas..."
              placeholderTextColor="rgba(0,40,80,0.38)"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => query_.trim().length >= 2 && doSearch(query_.trim())}
            />
            {query_.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery_(''); setResults([]); setSearched(false); }}>
                <Text style={s.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Toggle idioma */}
        <View style={s.filterRow}>
          <Text style={s.filterLabel}>
            {allLanguages ? 'Todos los idiomas' : `Solo en ${i18n.language.toUpperCase()}`}
          </Text>
          <TouchableOpacity
            style={[s.filterToggle, allLanguages && s.filterToggleActive]}
            onPress={() => {
              setAllLanguages(!allLanguages);
              if (query_.trim().length >= 2) doSearch(query_.trim());
            }}
          >
            <Text style={[s.filterToggleText, allLanguages && s.filterToggleTextActive]}>
              {allLanguages ? 'Ver mi idioma' : 'Ver todos'}
            </Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{flex:1, opacity:fadeAnim}}>

          {/* Estado: cargando */}
          {loading && (
            <View style={s.centered}>
              <ActivityIndicator color={colors.primary} size="large"/>
            </View>
          )}

          {/* Estado: sin resultados */}
          {!loading && searched && results.length === 0 && (
            <View style={s.centered}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>Sin resultados</Text>
              <Text style={s.emptyText}>
                Prueba con otro nombre o activa "Ver todos" para buscar en todos los idiomas.
              </Text>
            </View>
          )}

          {/* Estado: inicial (antes de buscar) */}
          {!loading && !searched && (
            <View style={s.centered}>
              <Text style={s.emptyEmoji}>✨</Text>
              <Text style={s.emptyTitle}>Descubre creadores</Text>
              <Text style={s.emptyText}>
                Busca por nombre, usuario o categoría.
              </Text>
            </View>
          )}

          {/* Resultados */}
          {!loading && results.length > 0 && (
            <>
              <Text style={s.resultsCount}>{results.length} resultado{results.length!==1?'s':''}</Text>
              <FlatList
                data={results}
                keyExtractor={item => item.uid}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => Keyboard.dismiss()}
                contentContainerStyle={{paddingBottom: insets.bottom + 20}}
                renderItem={({item}) => (
                  <UserCard user={item} onPress={() => handleUserPress(item)}/>
                )}
              />
            </>
          )}

        </Animated.View>
      </SafeAreaView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  header:    { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10, gap:10 },
  backBtn:   { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,50,100,0.15)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)', alignItems:'center', justifyContent:'center' },
  backIcon:  { color:'#001e3c', fontSize:24, lineHeight:26 },

  searchBar: {
    flex:1, flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.55)',
    borderWidth:1.5, borderColor:'rgba(0,60,120,0.22)',
    borderRadius:14, paddingHorizontal:12, gap:8,
  },
  searchIcon:  { fontSize:16 },
  searchInput: { flex:1, fontSize:15, color:'#001428', paddingVertical:Platform.OS==='ios'?12:10 },
  clearBtn:    { color:'rgba(0,50,100,0.4)', fontSize:14, padding:4 },

  filterRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:8 },
  filterLabel: { fontSize:12, color:'rgba(0,40,80,0.55)', fontWeight:'500' },
  filterToggle:{ paddingHorizontal:12, paddingVertical:6, borderRadius:12, backgroundColor:'rgba(0,60,120,0.1)', borderWidth:1, borderColor:'rgba(0,60,120,0.18)' },
  filterToggleActive:    { backgroundColor:'rgba(0,80,160,0.15)', borderColor:'rgba(0,80,160,0.35)' },
  filterToggleText:      { fontSize:12, fontWeight:'600', color:'rgba(0,40,80,0.6)' },
  filterToggleTextActive:{ color:'#001e3c' },

  resultsCount: { fontSize:12, color:'rgba(0,40,80,0.5)', paddingHorizontal:16, paddingVertical:6, fontWeight:'500' },

  centered:   { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:40, gap:12 },
  emptyEmoji: { fontSize:48 },
  emptyTitle: { fontSize:17, fontWeight:'700', color:'#001428', textAlign:'center' },
  emptyText:  { fontSize:13, color:'rgba(0,40,80,0.55)', textAlign:'center', lineHeight:19 },
});
