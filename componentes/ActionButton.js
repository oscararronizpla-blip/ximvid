/**
 * XIMVID — src/components/ActionButton.js
 * Botón de acción (CTA) que aparece en el feed sobre los videos.
 *
 * - Color #ff4d6d, esquinas redondeadas 10px
 * - Sombra de color (shadowColor: #ff4d6d)
 * - Al pulsar: openURL + incrementar actionClicks en Firestore
 *   + trigger Email 3 y Email 4 (via sendgrid-triggers.js)
 */

import React, { useRef } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, Animated, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  addDoc, collection, serverTimestamp, increment, updateDoc, doc,
} from 'firebase/firestore';
import { auth, db } from '@services/firebase';
import { colors }   from '@constants/colors';

export default function ActionButton({ text, url, videoId, videoOwnerId }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = async () => {
    // Feedback táctil
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue:0.95, duration:80, useNativeDriver:true }),
      Animated.timing(scaleAnim, { toValue:1,    duration:120, useNativeDriver:true }),
    ]).start();

    // Abrir URL destino
    try {
      await Linking.openURL(url);
    } catch {
      console.warn('ActionButton: no se pudo abrir', url);
    }

    // Registrar clic en Firestore (sin await — no bloquear la UI)
    // El trigger onActionClick en sendgrid-triggers.js dispara Email 3
    const uid = auth.currentUser?.uid;
    Promise.all([
      // Incrementar contador en el video
      updateDoc(doc(db,'videos',videoId), {
        actionClicks: increment(1),
      }),
      // Crear documento en actionClicks para el trigger
      addDoc(collection(db,'actionClicks'), {
        videoId,
        videoOwnerId,
        actionURL:  url,
        clickedAt:  serverTimestamp(),
        visitorId:  uid || `anonymous_${Date.now()}`,
      }),
    ]).catch(err => console.warn('ActionButton click register:', err));
  };

  return (
    <Animated.View style={[styles.wrap, { transform:[{scale:scaleAnim}] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.88} style={styles.touchable}>
        <LinearGradient
          colors={['#ff4d6d', '#e8003d']}
          start={{x:0,y:0}} end={{x:1,y:0}}
          style={styles.gradient}
        >
          <Text style={styles.text} numberOfLines={1}>{text}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor:   colors.primary,
    shadowOffset:  { width:0, height:4 },
    shadowOpacity: 0.5,
    shadowRadius:  12,
    elevation:     8,
  },
  touchable: {
    borderRadius: 10,
    overflow:     'hidden',
  },
  gradient: {
    paddingVertical:    12,
    paddingHorizontal:  20,
    alignItems:         'center',
  },
  text: {
    color:       '#fff',
    fontSize:    14,
    fontWeight:  '700',
    letterSpacing:0.2,
  },
});
