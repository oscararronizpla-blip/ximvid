/**
 * XIMVID — src/screens/SocialLinksScreen.js
 * PANTALLA 5: Añadir redes sociales
 *
 * Elementos:
 *  - 29 redes organizadas en 3 grupos (social, contacto, enlaces)
 *  - Por cada red activa: campo URL + campo seguidores
 *  - Drag & drop para reordenar iconos activos
 *  - Al guardar >= 1 red: dispara Email 2 (perfil completo)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Image, Alert, FlatList,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import { LinearGradient }  from 'expo-linear-gradient';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db }        from '@services/firebase';
import { colors }          from '@constants/colors';
import { SOCIAL_NETWORKS, SOCIAL_GROUPS, formatFollowers } from '@constants/socialNetworks';
import AppBackground       from '@components/AppBackground';

// ─── Fila de red social activa (con campos URL y seguidores) ──────
function ActiveNetworkRow({ item, data, onChange, onRemove }) {
  return (
    <View style={r.wrap}>
      <View style={r.header}>
        <Image source={{uri:item.iconUrl}} style={r.icon} tintColor="#001e3c"/>
        <Text style={r.label}>{item.label}</Text>
        <TouchableOpacity onPress={() => onRemove(item.id)} style={r.removeBtn}>
          <Text style={r.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={r.fields}>
        <View style={r.fieldWrap}>
          <Text style={r.fieldLabel}>URL</Text>
          <TextInput
            style={r.input}
            value={data?.url || ''}
            onChangeText={v => onChange(item.id,'url',v)}
            placeholder={item.placeholder}
            placeholderTextColor="rgba(0,40,80,0.3)"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={[r.fieldWrap,{width:100}]}>
          <Text style={r.fieldLabel}>Seguidores</Text>
          <TextInput
            style={r.input}
            value={data?.followers ? String(data.followers) : ''}
            onChangeText={v => onChange(item.id,'followers',parseInt(v)||0)}
            placeholder="0"
            placeholderTextColor="rgba(0,40,80,0.3)"
            keyboardType="numeric"
          />
        </View>
      </View>
    </View>
  );
}

const r = StyleSheet.create({
  wrap:      { backgroundColor:'rgba(255,255,255,0.45)', borderRadius:12, marginBottom:10, borderWidth:1, borderColor:'rgba(0,60,120,0.18)', overflow:'hidden' },
  header:    { flexDirection:'row', alignItems:'center', gap:10, padding:12, borderBottomWidth:1, borderBottomColor:'rgba(0,60,120,0.1)' },
  icon:      { width:22, height:22, resizeMode:'contain' },
  label:     { flex:1, fontSize:14, fontWeight:'600', color:'#001428' },
  removeBtn: { padding:4 },
  removeText:{ color:'rgba(200,0,30,0.6)', fontSize:14, fontWeight:'700' },
  fields:    { flexDirection:'row', gap:8, padding:10, paddingTop:8 },
  fieldWrap: { flex:1 },
  fieldLabel:{ fontSize:11, color:'rgba(0,40,80,0.55)', fontWeight:'600', marginBottom:4 },
  input:     { backgroundColor:'rgba(255,255,255,0.6)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)', borderRadius:8, paddingHorizontal:10, paddingVertical:Platform.OS==='ios'?8:6, fontSize:13, color:'#001428' },
});

// ─── Pantalla principal ───────────────────────────────────────────
export default function SocialLinksScreen({ navigation }) {
  const { t } = useTranslation();

  // Redes activas: { [networkId]: { url, followers, order } }
  const [activeNetworks, setActiveNetworks] = useState({});
  // Orden de las redes activas para el drag & drop
  const [orderedActive, setOrderedActive]   = useState([]);
  // Grupo expandido en el selector
  const [expandedGroup, setExpandedGroup]   = useState('social');
  const [loading, setLoading]               = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim,{toValue:1,duration:380,useNativeDriver:true}).start();
  },[]);

  // ── Activar una red ──────────────────────────────────────────
  const activateNetwork = useCallback((networkId) => {
    if (activeNetworks[networkId]) return; // Ya activa
    setActiveNetworks(prev => ({
      ...prev,
      [networkId]: { url:'', followers:0, order: Object.keys(prev).length },
    }));
    setOrderedActive(prev => [...prev, networkId]);
  }, [activeNetworks]);

  // ── Desactivar una red ───────────────────────────────────────
  const removeNetwork = useCallback((networkId) => {
    setActiveNetworks(prev => {
      const next = {...prev};
      delete next[networkId];
      return next;
    });
    setOrderedActive(prev => prev.filter(id => id !== networkId));
  }, []);

  // ── Actualizar campo de una red ──────────────────────────────
  const updateNetwork = useCallback((networkId, field, value) => {
    setActiveNetworks(prev => ({
      ...prev,
      [networkId]: { ...prev[networkId], [field]: value },
    }));
  }, []);

  // ── Reordenar tras drag & drop ───────────────────────────────
  const onDragEnd = useCallback(({ data }) => {
    setOrderedActive(data);
    const updated = {};
    data.forEach((id, index) => {
      updated[id] = { ...activeNetworks[id], order: index };
    });
    setActiveNetworks(updated);
  }, [activeNetworks]);

  // ── Guardar y continuar ──────────────────────────────────────
  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const hasAtLeastOne = Object.keys(activeNetworks).length > 0;

    setLoading(true);
    try {
      // Construir array de socialLinks en el orden correcto
      const socialLinks = orderedActive
        .filter(id => activeNetworks[id]?.url?.trim())
        .map((id, index) => ({
          network:   id,
          url:       activeNetworks[id].url.trim(),
          followers: activeNetworks[id].followers || 0,
          order:     index,
        }));

      await updateDoc(doc(db,'users',uid), {
        socialLinks,
        updatedAt: serverTimestamp(),
      });
      // Email 2 (perfil completo) se dispara automáticamente
      // desde onProfileComplete en sendgrid-triggers.js
      // cuando socialLinks pasa de 0 a >= 1

      navigation.navigate('Feed');
    } catch (err) {
      Alert.alert('Error', 'No se pudieron guardar las redes. Inténtalo de nuevo.');
      console.error('SocialLinks:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Redes del grupo expandido ────────────────────────────────
  const groupNetworks = SOCIAL_NETWORKS.filter(n => n.group === expandedGroup);

  return (
    <AppBackground>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <Animated.View style={{flex:1, opacity:fadeAnim}}>

            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                <Text style={s.backIcon}>‹</Text>
              </TouchableOpacity>
              <View style={s.progressWrap}>
                {[1,2,3,4].map(i => (
                  <View key={i} style={[s.progressDot, i<=4 && s.progressDotActive]}/>
                ))}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Feed')}>
                <Text style={s.skipText}>{t('socialLinks.skipButton')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Título */}
              <View style={s.titleWrap}>
                <Text style={s.title}>{t('socialLinks.title')}</Text>
                <Text style={s.subtitle}>{t('socialLinks.subtitle')}</Text>
              </View>

              {/* ── Selector de grupos ── */}
              <View style={s.groupTabs}>
                {SOCIAL_GROUPS.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[s.groupTab, expandedGroup===g.id && s.groupTabActive]}
                    onPress={() => setExpandedGroup(g.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.groupTabText, expandedGroup===g.id && s.groupTabTextActive]}>
                      {t(`socialLinks.group${g.id.charAt(0).toUpperCase()+g.id.slice(1)}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Grid de iconos del grupo ── */}
              <View style={s.iconsGrid}>
                {groupNetworks.map(network => {
                  const isActive = !!activeNetworks[network.id];
                  return (
                    <TouchableOpacity
                      key={network.id}
                      style={[s.iconItem, isActive && s.iconItemActive]}
                      onPress={() => isActive ? removeNetwork(network.id) : activateNetwork(network.id)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{uri:network.iconUrl}}
                        style={s.iconImg}
                        tintColor={isActive ? colors.primary : '#002850'}
                      />
                      <Text style={[s.iconLabel, isActive && s.iconLabelActive]}>
                        {network.label}
                      </Text>
                      {isActive && (
                        <View style={s.iconCheck}>
                          <Text style={s.iconCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── Redes activas con drag & drop ── */}
              {orderedActive.length > 0 && (
                <View style={s.activeSection}>
                  <Text style={s.activeSectionTitle}>
                    Tus redes activas
                    <Text style={s.activeSectionSub}> — arrastra para reordenar</Text>
                  </Text>

                  <DraggableFlatList
                    data={orderedActive}
                    keyExtractor={item => item}
                    onDragEnd={onDragEnd}
                    scrollEnabled={false}
                    renderItem={({ item: networkId, drag, isActive: isDragging }) => {
                      const network = SOCIAL_NETWORKS.find(n => n.id === networkId);
                      if (!network) return null;
                      return (
                        <ScaleDecorator>
                          <View style={[
                            { opacity: isDragging ? 0.85 : 1 },
                          ]}>
                            {/* Handle de drag */}
                            <TouchableOpacity
                              onLongPress={drag}
                              style={s.dragHandle}
                              delayLongPress={150}
                            >
                              <Text style={s.dragHandleIcon}>⠿</Text>
                            </TouchableOpacity>
                            <View style={{marginLeft:28}}>
                              <ActiveNetworkRow
                                item={network}
                                data={activeNetworks[networkId]}
                                onChange={updateNetwork}
                                onRemove={removeNetwork}
                              />
                            </View>
                          </View>
                        </ScaleDecorator>
                      );
                    }}
                  />
                </View>
              )}

              {/* Botón guardar */}
              <View style={s.btnWrap}>
                <TouchableOpacity
                  style={s.btn}
                  onPress={handleSave}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#ff4d6d','#e8003d']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={s.btnGradient}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff"/>
                      : <Text style={s.btnText}>
                          {orderedActive.length > 0
                            ? t('socialLinks.saveButton')
                            : t('socialLinks.skipButton')}
                        </Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {orderedActive.length === 0 && (
                  <Text style={s.skipHint}>
                    Puedes añadir tus redes más tarde desde tu perfil
                  </Text>
                )}
              </View>

            </ScrollView>
          </Animated.View>
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
  title:     { fontSize:22, fontWeight:'700', color:'#001428', marginBottom:6, letterSpacing:-0.3 },
  subtitle:  { fontSize:13, color:'rgba(0,40,80,0.6)', fontWeight:'500' },

  // Tabs de grupo
  groupTabs: { flexDirection:'row', paddingHorizontal:24, gap:8, marginBottom:16 },
  groupTab:  { flex:1, paddingVertical:8, borderRadius:10, alignItems:'center', backgroundColor:'rgba(255,255,255,0.35)', borderWidth:1, borderColor:'rgba(0,60,120,0.18)' },
  groupTabActive: { backgroundColor:'rgba(0,60,120,0.15)', borderColor:'rgba(0,80,160,0.4)' },
  groupTabText:   { fontSize:11, fontWeight:'600', color:'rgba(0,40,80,0.6)' },
  groupTabTextActive: { color:'#001e3c' },

  // Grid de iconos
  iconsGrid: {
    flexDirection:'row', flexWrap:'wrap',
    paddingHorizontal:20, gap:8, marginBottom:20,
  },
  iconItem: {
    width:'22%', alignItems:'center', paddingVertical:12, paddingHorizontal:4,
    borderRadius:12, backgroundColor:'rgba(255,255,255,0.35)',
    borderWidth:1, borderColor:'rgba(0,60,120,0.15)',
    position:'relative',
  },
  iconItemActive: {
    backgroundColor:'rgba(255,77,109,0.08)',
    borderColor:'rgba(255,77,109,0.4)',
  },
  iconImg:   { width:28, height:28, resizeMode:'contain', marginBottom:4 },
  iconLabel: { fontSize:9, color:'rgba(0,40,80,0.65)', textAlign:'center', fontWeight:'500' },
  iconLabelActive: { color:colors.primary, fontWeight:'700' },
  iconCheck: {
    position:'absolute', top:4, right:4,
    width:14, height:14, borderRadius:7,
    backgroundColor:colors.primary,
    alignItems:'center', justifyContent:'center',
  },
  iconCheckText: { color:'#fff', fontSize:9, fontWeight:'700' },

  // Sección de redes activas
  activeSection:      { paddingHorizontal:24, marginBottom:8 },
  activeSectionTitle: { fontSize:14, fontWeight:'700', color:'#001428', marginBottom:12 },
  activeSectionSub:   { fontSize:12, fontWeight:'400', color:'rgba(0,40,80,0.5)' },

  // Drag handle
  dragHandle: {
    position:'absolute', left:0, top:0, bottom:0,
    width:28, justifyContent:'center', alignItems:'center', zIndex:10,
  },
  dragHandleIcon: { fontSize:18, color:'rgba(0,60,120,0.4)' },

  // Botón
  btnWrap: { paddingHorizontal:24, paddingTop:16, paddingBottom:24 },
  btn: {
    borderRadius:14, overflow:'hidden',
    shadowColor:colors.primary, shadowOffset:{width:0,height:6},
    shadowOpacity:0.38, shadowRadius:14, elevation:8,
  },
  btnGradient: { paddingVertical:17, alignItems:'center' },
  btnText:     { color:'#fff', fontSize:16, fontWeight:'600' },
  skipHint:    { textAlign:'center', fontSize:12, color:'rgba(0,40,80,0.45)', marginTop:12 },
});
