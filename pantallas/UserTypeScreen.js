/**
 * XIMVID — src/screens/UserTypeScreen.js
 * PANTALLA 3: Tipo de usuario
 * Fondo: azul tecnológico + círculos + código binario (AppBackground)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@services/firebase';
import { colors }   from '@constants/colors';
import AppBackground from '@components/AppBackground';

const USER_TYPES = [
  { id:'selling_product',  emoji:'📦', labelKey:'userType.sellingProduct',  subKey:'userType.sellingProductSub',  accent:'#e05a1a' },
  { id:'selling_service',  emoji:'💼', labelKey:'userType.sellingService',  subKey:'userType.sellingServiceSub',  accent:'#5b28c4' },
  { id:'sharing_content',  emoji:'🎬', labelKey:'userType.sharingContent',  subKey:'userType.sharingContentSub',  accent:'#0775a8' },
  { id:'discovering',      emoji:'🔍', labelKey:'userType.discovering',     subKey:'userType.discoveringSub',     accent:'#0a7a55' },
];

// ─── Tarjeta ──────────────────────────────────────────────────────
function TypeCard({ item, selected, onSelect, delay }) {
  const { t }       = useTranslation();
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const selectAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue:1, tension:60, friction:8, delay, useNativeDriver:true }).start();
  }, []);

  useEffect(() => {
    Animated.spring(selectAnim, { toValue:selected?1:0, tension:80, friction:6, useNativeDriver:false }).start();
  }, [selected]);

  const borderColor = selectAnim.interpolate({ inputRange:[0,1], outputRange:['rgba(0,60,120,0.2)', item.accent] });
  const bgOpacity   = selectAnim.interpolate({ inputRange:[0,1], outputRange:[0, 0.1] });
  const cardScale   = selectAnim.interpolate({ inputRange:[0,1], outputRange:[1, 1.02] });

  return (
    <Animated.View style={{ transform:[{scale:scaleAnim}] }}>
      <TouchableOpacity onPress={() => onSelect(item.id)} activeOpacity={0.8}>
        <Animated.View style={[s.card, { borderColor, transform:[{scale:cardScale}] }]}>
          {/* Fondo de acento */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius:16, backgroundColor:item.accent, opacity:bgOpacity }]}/>

          <Text style={s.cardEmoji}>{item.emoji}</Text>
          <View style={s.cardText}>
            <Text style={s.cardTitle}>{t(item.labelKey)}</Text>
            <Text style={s.cardSub}>{t(item.subKey)}</Text>
          </View>
          <Animated.View style={[s.checkCircle, {
            backgroundColor: selectAnim.interpolate({ inputRange:[0,1], outputRange:['rgba(0,60,120,0.12)', item.accent] }),
            borderColor:     selectAnim.interpolate({ inputRange:[0,1], outputRange:['rgba(0,80,160,0.25)', item.accent] }),
          }]}>
            {selected && <Text style={s.checkMark}>✓</Text>}
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────
export default function UserTypeScreen({ navigation }) {
  const { t }      = useTranslation();
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);

  const titleAnim = useRef(new Animated.Value(0)).current;
  const btnAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(titleAnim, { toValue:1, tension:50, friction:7, useNativeDriver:true }).start();
  }, []);

  useEffect(() => {
    if (selected) Animated.spring(btnAnim, { toValue:1, tension:60, friction:7, useNativeDriver:true }).start();
  }, [selected]);

  const handleContinue = async () => {
    if (!selected || loading) return;
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) await updateDoc(doc(db,'users',uid), { category:selected, updatedAt:serverTimestamp() });
      navigation.navigate('ProfileSetup');
    } catch (err) { console.error('UserType:', err); }
    finally { setLoading(false); }
  };

  const entry = (anim) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }],
  });

  return (
    <AppBackground>
      <SafeAreaView style={s.safeArea}>

        {/* Header con progress */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={s.progressWrap}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[s.progressDot, i<=2 && s.progressDotActive]}/>
            ))}
          </View>
          <View style={{width:40}}/>
        </View>

        {/* Título */}
        <Animated.View style={[s.titleWrap, entry(titleAnim)]}>
          <Text style={s.title}>{t('userType.title')}</Text>
          <Text style={s.subtitle}>{t('userType.subtitle')}</Text>
        </Animated.View>

        {/* Tarjetas */}
        <View style={s.cards}>
          {USER_TYPES.map((item, i) => (
            <TypeCard key={item.id} item={item} selected={selected===item.id} onSelect={setSelected} delay={i*80}/>
          ))}
        </View>

        {/* Botón continuar */}
        <Animated.View style={[s.btnWrap, entry(btnAnim)]}>
          <TouchableOpacity
            style={[s.btn, !selected && s.btnDisabled]}
            onPress={handleContinue}
            disabled={!selected || loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={selected ? ['#ff4d6d','#e8003d'] : ['rgba(0,50,100,0.2)','rgba(0,50,100,0.2)']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={s.btnGradient}
            >
              {loading ? <ActivityIndicator color="#fff"/> : <Text style={[s.btnText, !selected && s.btnTextDisabled]}>{t('userType.continueButton')}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  safeArea: { flex:1 },

  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  backBtn: { width:40, height:40, alignItems:'center', justifyContent:'center', borderRadius:20, backgroundColor:'rgba(0,50,100,0.15)', borderWidth:1, borderColor:'rgba(0,60,120,0.2)' },
  backIcon: { color:'#001e3c', fontSize:24, lineHeight:26 },

  progressWrap:     { flexDirection:'row', gap:6 },
  progressDot:      { width:8, height:8, borderRadius:4, backgroundColor:'rgba(0,60,120,0.2)' },
  progressDotActive:{ backgroundColor:colors.primary, width:20 },

  titleWrap: { paddingHorizontal:24, paddingTop:20, paddingBottom:22 },
  title:     { fontSize:24, fontWeight:'700', color:'#001428', marginBottom:8, letterSpacing:-0.3 },
  subtitle:  { fontSize:14, color:'rgba(0,40,80,0.6)', fontWeight:'500' },

  cards: { flex:1, paddingHorizontal:20, gap:10 },

  card: {
    flexDirection:'row', alignItems:'center', padding:18,
    borderRadius:16, borderWidth:1.5,
    backgroundColor:'rgba(255,255,255,0.35)', gap:14,
  },
  cardEmoji: { fontSize:28 },
  cardText:  { flex:1 },
  cardTitle: { color:'#001428', fontSize:15, fontWeight:'600', marginBottom:3 },
  cardSub:   { color:'rgba(0,40,80,0.58)', fontSize:12, lineHeight:16 },

  checkCircle: { width:24, height:24, borderRadius:12, borderWidth:1.5, alignItems:'center', justifyContent:'center' },
  checkMark:   { color:'#fff', fontSize:12, fontWeight:'700' },

  btnWrap: { paddingHorizontal:24, paddingBottom:24, paddingTop:16 },
  btn: {
    borderRadius:14, overflow:'hidden',
    shadowColor:colors.primary, shadowOffset:{width:0,height:6}, shadowOpacity:0.38, shadowRadius:14, elevation:8,
  },
  btnDisabled:     { shadowOpacity:0, elevation:0 },
  btnGradient:     { paddingVertical:17, alignItems:'center' },
  btnText:         { color:'#fff', fontSize:16, fontWeight:'600' },
  btnTextDisabled: { color:'rgba(0,40,80,0.45)' },
});
