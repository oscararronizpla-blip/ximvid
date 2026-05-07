/**
 * XIMVID — src/screens/StatsScreen.js
 * PANTALLA 11: Estadísticas del creador
 *
 * - Selector de período: hoy / semana / mes / 3 meses
 * - 4 métricas grandes: visualizaciones, clics CTA, visitas landing, seguidores
 * - Tabla de clics por red social
 * - Lista de videos ordenados por tasa de conversión
 * - Comparación con período anterior (flecha + porcentaje)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }  from 'react-i18next';
import {
  collection, query, where, getDocs,
  orderBy, Timestamp,
} from 'firebase/firestore';
import { auth, db }  from '@services/firebase';
import { colors }    from '@constants/colors';
import { getSocialNetwork, formatFollowers } from '@constants/socialNetworks';
import AppBackground from '@components/AppBackground';

const { width } = Dimensions.get('window');

// ─── Períodos disponibles ─────────────────────────────────────────
const PERIODS = [
  { id:'today',   labelKey:'stats.today',      days:1  },
  { id:'week',    labelKey:'stats.thisWeek',   days:7  },
  { id:'month',   labelKey:'stats.thisMonth',  days:30 },
  { id:'quarter', labelKey:'stats.last3Months',days:90 },
];

// ─── Tarjeta de métrica ───────────────────────────────────────────
function MetricCard({ label, value, trend, trendValue, color }) {
  const isUp = trendValue > 0;
  return (
    <View style={[mc.card, { borderTopColor: color, borderTopWidth:3 }]}>
      <Text style={mc.label}>{label}</Text>
      <Text style={mc.value}>{formatFollowers(value)}</Text>
      {trendValue !== 0 && (
        <View style={mc.trendRow}>
          <Text style={[mc.trendArrow, { color: isUp ? '#16a34a':'#dc2626' }]}>
            {isUp ? '▲' : '▼'}
          </Text>
          <Text style={[mc.trendText, { color: isUp ? '#16a34a':'#dc2626' }]}>
            {Math.abs(trendValue)}%
          </Text>
        </View>
      )}
    </View>
  );
}
const mc = StyleSheet.create({
  card:      { width:(width-52)/2, backgroundColor:'rgba(255,255,255,0.55)', borderRadius:12, padding:14, borderWidth:1, borderColor:'rgba(0,60,120,0.12)' },
  label:     { fontSize:11, fontWeight:'600', color:'rgba(0,40,80,0.55)', marginBottom:8, textTransform:'uppercase', letterSpacing:0.3 },
  value:     { fontSize:26, fontWeight:'700', color:'#001428', marginBottom:4 },
  trendRow:  { flexDirection:'row', alignItems:'center', gap:3 },
  trendArrow:{ fontSize:11, fontWeight:'700' },
  trendText: { fontSize:11, fontWeight:'600' },
});

// ─── Fila de red social ───────────────────────────────────────────
function NetworkRow({ networkId, clicks, total }) {
  const network = getSocialNetwork(networkId);
  if (!network) return null;
  const pct = total > 0 ? Math.round((clicks/total)*100) : 0;
  return (
    <View style={nr.row}>
      <Image source={{uri:network.iconUrl}} style={nr.icon} tintColor="#002850"/>
      <Text style={nr.label}>{network.label}</Text>
      <View style={nr.barWrap}>
        <View style={[nr.bar, {width:`${pct}%`}]}/>
      </View>
      <Text style={nr.count}>{clicks}</Text>
    </View>
  );
}
const nr = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', paddingVertical:10, gap:10 },
  icon:   { width:20, height:20, resizeMode:'contain' },
  label:  { width:80, fontSize:13, fontWeight:'600', color:'#001428' },
  barWrap:{ flex:1, height:6, backgroundColor:'rgba(0,60,120,0.12)', borderRadius:3, overflow:'hidden' },
  bar:    { height:'100%', backgroundColor:colors.primary, borderRadius:3 },
  count:  { width:30, fontSize:13, fontWeight:'700', color:'#001428', textAlign:'right' },
});

// ─── Fila de video ────────────────────────────────────────────────
function VideoRow({ video, navigation }) {
  const conversion = video.views > 0
    ? ((video.actionClicks||0) / video.views * 100).toFixed(1)
    : '0.0';
  return (
    <TouchableOpacity
      style={vr.row}
      onPress={() => navigation.navigate('Video', { videoId:video.videoId })}
      activeOpacity={0.8}
    >
      {video.thumbnailURL ? (
        <Image source={{uri:video.thumbnailURL}} style={vr.thumb} resizeMode="cover"/>
      ) : (
        <View style={[vr.thumb, vr.thumbPlaceholder]}>
          <Text style={{fontSize:16}}>🎬</Text>
        </View>
      )}
      <View style={vr.info}>
        <View style={vr.metaRow}>
          <Text style={vr.metaLabel}>Views</Text>
          <Text style={vr.metaValue}>{formatFollowers(video.views||0)}</Text>
        </View>
        <View style={vr.metaRow}>
          <Text style={vr.metaLabel}>Clics CTA</Text>
          <Text style={vr.metaValue}>{video.actionClicks||0}</Text>
        </View>
      </View>
      <View style={vr.convWrap}>
        <Text style={vr.convValue}>{conversion}%</Text>
        <Text style={vr.convLabel}>Conversión</Text>
      </View>
    </TouchableOpacity>
  );
}
const vr = StyleSheet.create({
  row:            { flexDirection:'row', alignItems:'center', paddingVertical:12, gap:12, borderBottomWidth:1, borderBottomColor:'rgba(0,60,120,0.08)' },
  thumb:          { width:54, height:80, borderRadius:8, backgroundColor:'rgba(0,60,120,0.1)' },
  thumbPlaceholder:{ alignItems:'center', justifyContent:'center' },
  info:           { flex:1, gap:6 },
  metaRow:        { flexDirection:'row', justifyContent:'space-between' },
  metaLabel:      { fontSize:12, color:'rgba(0,40,80,0.55)' },
  metaValue:      { fontSize:12, fontWeight:'700', color:'#001428' },
  convWrap:       { alignItems:'center', minWidth:60 },
  convValue:      { fontSize:18, fontWeight:'700', color:colors.primary },
  convLabel:      { fontSize:10, color:'rgba(0,40,80,0.5)', marginTop:2 },
});

// ─── Pantalla principal ───────────────────────────────────────────
export default function StatsScreen({ route, navigation }) {
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();

  const [period,    setPeriod]    = useState('week');
  const [stats,     setStats]     = useState(null);
  const [videos,    setVideos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState(route.params?.tab || 'overview');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);

    try {
      const days      = PERIODS.find(p => p.id === period)?.days || 7;
      const now       = new Date();
      const start     = new Date(now.getTime() - days * 86400000);
      const prevStart = new Date(start.getTime() - days * 86400000);

      const tsStart     = Timestamp.fromDate(start);
      const tsPrevStart = Timestamp.fromDate(prevStart);
      const tsNow       = Timestamp.fromDate(now);
      const tsPrevEnd   = Timestamp.fromDate(start);

      // Queries paralelas
      const [
        actionSnap, prevActionSnap,
        socialSnap, prevSocialSnap,
        landingSnap,
        followersSnap, prevFollowersSnap,
        videosSnap,
      ] = await Promise.all([
        getDocs(query(collection(db,'actionClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsStart))),
        getDocs(query(collection(db,'actionClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsPrevStart), where('clickedAt','<',tsPrevEnd))),
        getDocs(query(collection(db,'socialClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsStart))),
        getDocs(query(collection(db,'socialClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsPrevStart), where('clickedAt','<',tsPrevEnd))),
        getDocs(query(collection(db,'landingVisits'), where('profileUserId','==',uid), where('visitedAt','>=',tsStart))),
        getDocs(query(collection(db,'followers'), where('followingId','==',uid), where('createdAt','>=',tsStart))),
        getDocs(query(collection(db,'followers'), where('followingId','==',uid), where('createdAt','>=',tsPrevStart), where('createdAt','<',tsPrevEnd))),
        getDocs(query(collection(db,'videos'), where('userId','==',uid), where('isActive','==',true), orderBy('actionClicks','desc'))),
      ]);

      // Calcular clics por red
      const clicksByNetwork = {};
      socialSnap.docs.forEach(d => {
        const net = d.data().network;
        clicksByNetwork[net] = (clicksByNetwork[net]||0) + 1;
      });

      // Calcular tendencias
      const calcTrend = (curr, prev) => {
        if (!prev) return 0;
        return Math.round(((curr-prev)/prev)*100);
      };

      const actionClicks  = actionSnap.size;
      const prevAction    = prevActionSnap.size;
      const socialClicks  = socialSnap.size;
      const landingVisits = landingSnap.size;
      const newFollowers  = followersSnap.size;
      const prevFollowers = prevFollowersSnap.size;

      // Views totales (aproximación: suma de views de los videos del usuario)
      let totalViews = 0;
      videosSnap.docs.forEach(d => { totalViews += (d.data().views||0); });

      setStats({
        totalViews,     viewsTrend:     0,
        actionClicks,   actionTrend:    calcTrend(actionClicks, prevAction),
        socialClicks,   socialTrend:    0,
        landingVisits,  landingTrend:   0,
        newFollowers,   followersTrend: calcTrend(newFollowers, prevFollowers),
        clicksByNetwork,
        totalSocialClicks: socialClicks,
      });

      // Videos ordenados por tasa de conversión
      const videoList = videosSnap.docs
        .map(d => ({ videoId:d.id, ...d.data() }))
        .sort((a,b) => {
          const convA = a.views > 0 ? (a.actionClicks||0)/a.views : 0;
          const convB = b.views > 0 ? (b.actionClicks||0)/b.views : 0;
          return convB - convA;
        });
      setVideos(videoList);

      Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}).start();
    } catch (err) {
      console.error('StatsScreen:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  return (
    <AppBackground>
      <SafeAreaView style={{flex:1}}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('profile.myStats')}</Text>
          <View style={{width:40}}/>
        </View>

        {/* Selector de período */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.periodBtn, period===p.id && s.periodBtnActive]}
              onPress={() => { setPeriod(p.id); fadeAnim.setValue(0); }}
              activeOpacity={0.7}
            >
              <Text style={[s.periodText, period===p.id && s.periodTextActive]}>
                {t(p.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tabs */}
        <View style={s.tabRow}>
          {[
            { id:'overview',  label:'Resumen' },
            { id:'networks',  label:t('stats.byNetwork') },
            { id:'videos',    label:t('stats.byVideo') },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, activeTab===tab.id && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[s.tabText, activeTab===tab.id && s.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator color={colors.primary} size="large"/>
          </View>
        ) : (
          <Animated.ScrollView
            style={{opacity:fadeAnim}}
            contentContainerStyle={[s.scroll, {paddingBottom: insets.bottom+20}]}
            showsVerticalScrollIndicator={false}
          >

            {/* ── Tab: Resumen ── */}
            {activeTab === 'overview' && stats && (
              <>
                <View style={s.metricsGrid}>
                  <MetricCard label={t('stats.totalViews')}    value={stats.totalViews}    trendValue={stats.viewsTrend}     color="#0775a8"/>
                  <MetricCard label={t('stats.actionClicks')}  value={stats.actionClicks}  trendValue={stats.actionTrend}    color={colors.primary}/>
                  <MetricCard label={t('stats.landingVisits')} value={stats.landingVisits} trendValue={stats.landingTrend}   color="#059669"/>
                  <MetricCard label={t('stats.newFollowers')}  value={stats.newFollowers}  trendValue={stats.followersTrend} color="#7c3aed"/>
                </View>
                {stats.totalSocialClicks > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>{t('stats.byNetwork')}</Text>
                    {Object.entries(stats.clicksByNetwork)
                      .sort((a,b) => b[1]-a[1])
                      .slice(0,5)
                      .map(([net, clicks]) => (
                        <NetworkRow key={net} networkId={net} clicks={clicks} total={stats.totalSocialClicks}/>
                      ))
                    }
                  </View>
                )}
                {videos.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>{t('stats.topVideo')}</Text>
                    <VideoRow video={videos[0]} navigation={navigation}/>
                  </View>
                )}
              </>
            )}

            {/* ── Tab: Redes ── */}
            {activeTab === 'networks' && stats && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('stats.byNetwork')}</Text>
                {Object.keys(stats.clicksByNetwork).length === 0 ? (
                  <Text style={s.emptyText}>{t('stats.noData')}</Text>
                ) : (
                  Object.entries(stats.clicksByNetwork)
                    .sort((a,b) => b[1]-a[1])
                    .map(([net, clicks]) => (
                      <NetworkRow key={net} networkId={net} clicks={clicks} total={stats.totalSocialClicks}/>
                    ))
                )}
              </View>
            )}

            {/* ── Tab: Videos ── */}
            {activeTab === 'videos' && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('stats.byVideo')}</Text>
                <Text style={s.sectionSub}>Ordenados por tasa de conversión</Text>
                {videos.length === 0 ? (
                  <Text style={s.emptyText}>{t('stats.noData')}</Text>
                ) : (
                  videos.map(v => <VideoRow key={v.videoId} video={v} navigation={navigation}/>)
                )}
              </View>
            )}

          </Animated.ScrollView>
        )}

      </SafeAreaView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  backBtn:     { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,50,100,0.15)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)', alignItems:'center', justifyContent:'center' },
  backIcon:    { color:'#001e3c', fontSize:24, lineHeight:26 },
  headerTitle: { fontSize:17, fontWeight:'700', color:'#001428' },

  periodRow:   { paddingHorizontal:16, paddingVertical:10, gap:8 },
  periodBtn:   { paddingHorizontal:16, paddingVertical:7, borderRadius:20, backgroundColor:'rgba(255,255,255,0.4)', borderWidth:1, borderColor:'rgba(0,60,120,0.18)' },
  periodBtnActive:  { backgroundColor:colors.primary, borderColor:colors.primary },
  periodText:       { fontSize:13, fontWeight:'600', color:'rgba(0,40,80,0.6)' },
  periodTextActive: { color:'#fff' },

  tabRow:       { flexDirection:'row', paddingHorizontal:16, gap:0, marginBottom:4 },
  tab:          { flex:1, paddingVertical:10, alignItems:'center', borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive:    { borderBottomColor:colors.primary },
  tabText:      { fontSize:13, fontWeight:'600', color:'rgba(0,40,80,0.5)' },
  tabTextActive:{ color:'#001428' },

  centered:    { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:      { paddingTop:8 },

  metricsGrid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:10, marginBottom:16 },

  section:     { paddingHorizontal:20, marginBottom:20 },
  sectionTitle:{ fontSize:15, fontWeight:'700', color:'#001428', marginBottom:4 },
  sectionSub:  { fontSize:12, color:'rgba(0,40,80,0.5)', marginBottom:12 },
  emptyText:   { fontSize:14, color:'rgba(0,40,80,0.45)', textAlign:'center', paddingVertical:20 },
});
