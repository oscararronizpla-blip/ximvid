/**
 * XIMVID — src/components/CategoryFilter.js
 * Dropdown de categorías para el feed.
 * Aparece al pulsar la pestaña "Categorías" en el FeedScreen.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { colors }         from '@constants/colors';

const CATEGORIES = [
  { id:'physicalProducts', emoji:'📦', labelKey:'categories.physicalProducts', color:'#e05a1a' },
  { id:'services',         emoji:'💼', labelKey:'categories.services',         color:'#5b28c4' },
  { id:'training',         emoji:'🎓', labelKey:'categories.training',         color:'#0775a8' },
  { id:'localBusiness',    emoji:'🏪', labelKey:'categories.localBusiness',    color:'#0a7a55' },
  { id:'creatives',        emoji:'🎨', labelKey:'categories.creatives',        color:'#c4287a' },
  { id:'personalBrand',    emoji:'⭐', labelKey:'categories.personalBrand',    color:'#c47a00' },
];

export default function CategoryFilter({ selected, onSelect }) {
  const { t } = useTranslation();

  return (
    <View style={s.container}>
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
        style={s.gradient}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* Opción "Todos" */}
          <TouchableOpacity
            style={[s.pill, !selected && s.pillActive]}
            onPress={() => onSelect(null)}
            activeOpacity={0.7}
          >
            <Text style={s.pillEmoji}>✨</Text>
            <Text style={[s.pillText, !selected && s.pillTextActive]}>
              {t('feed.forYou')}
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[s.pill, selected===cat.id && s.pillActive, selected===cat.id && {borderColor:cat.color}]}
              onPress={() => onSelect(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={s.pillEmoji}>{cat.emoji}</Text>
              <Text style={[s.pillText, selected===cat.id && {color:cat.color, fontWeight:'700'}]}>
                {t(cat.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width:'100%' },
  gradient:  { paddingVertical:12 },
  scroll:    { paddingHorizontal:16, gap:8 },
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal:12,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:      'rgba(255,255,255,0.2)',
    backgroundColor:  'rgba(255,255,255,0.08)',
  },
  pillActive: {
    borderColor:     colors.primary,
    backgroundColor:'rgba(255,77,109,0.15)',
  },
  pillEmoji:    { fontSize:14 },
  pillText:     { color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:'500' },
  pillTextActive:{ color:'#fff', fontWeight:'700' },
});
