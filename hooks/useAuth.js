/**
 * XIMVID — src/hooks/useAuth.js
 * Hook de autenticación — gestiona el estado del usuario en toda la app.
 * Escucha cambios en Firebase Auth y sincroniza con Firestore.
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged }  from 'firebase/auth';
import { doc, onSnapshot }     from 'firebase/firestore';
import { auth, db }            from '@services/firebase';

export function useAuth() {
  const [user,        setUser]        = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [isAdmin,     setIsAdmin]     = useState(false);

  useEffect(() => {
    let unsubscribeFirestore = null;

    // Escuchar cambios de autenticación
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Escuchar el perfil de Firestore en tiempo real
        // — detecta cambios de isPremium, isBanned, etc. inmediatamente
        unsubscribeFirestore = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setUserProfile({ uid: snap.id, ...data });
              setIsAdmin(data.isAdmin || false);

              // Si el usuario está baneado, forzar cierre de sesión
              if (data.isBanned) {
                auth.signOut();
              }
            }
            setLoading(false);
          },
          (err) => {
            console.error('useAuth Firestore listener:', err);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setLoading(false);
        if (unsubscribeFirestore) unsubscribeFirestore();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return {
    user,           // Firebase Auth user
    userProfile,    // Documento de Firestore (con isPremium, socialLinks, etc.)
    loading,        // true mientras carga el estado inicial
    isAdmin,        // true si el usuario es admin
    isAuthenticated: !!user,
    isPremium:       userProfile?.isPremium || false,
    uid:             user?.uid || null,
    language:        userProfile?.language || 'en',
  };
}
