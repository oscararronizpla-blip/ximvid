/**
 * XIMVID — src/hooks/useStats.js
 * Hook para cargar y calcular estadísticas del creador.
 */

import { useState, useCallback } from 'react';
import {
  collection, query, where, getDocs, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@services/firebase';

export function useStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const loadStats = useCallback(async (periodDays = 7) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setLoading(true);
    setError(null);

    try {
      const now       = new Date();
      const start     = new Date(now.getTime() - periodDays * 86400000);
      const prevStart = new Date(start.getTime() - periodDays * 86400000);

      const tsStart    = Timestamp.fromDate(start);
      const tsPrevStart = Timestamp.fromDate(prevStart);
      const tsPrevEnd  = Timestamp.fromDate(start);

      const [actionSnap, prevActionSnap, socialSnap, followersSnap, prevFollowersSnap] =
        await Promise.all([
          getDocs(query(collection(db,'actionClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsStart))),
          getDocs(query(collection(db,'actionClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsPrevStart), where('clickedAt','<',tsPrevEnd))),
          getDocs(query(collection(db,'socialClicks'), where('videoOwnerId','==',uid), where('clickedAt','>=',tsStart))),
          getDocs(query(collection(db,'followers'), where('followingId','==',uid), where('createdAt','>=',tsStart))),
          getDocs(query(collection(db,'followers'), where('followingId','==',uid), where('createdAt','>=',tsPrevStart), where('createdAt','<',tsPrevEnd))),
        ]);

      const clicksByNetwork = {};
      socialSnap.docs.forEach(d => {
        const net = d.data().network;
        clicksByNetwork[net] = (clicksByNetwork[net] || 0) + 1;
      });

      const calcTrend = (curr, prev) =>
        prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;

      setStats({
        actionClicks:     actionSnap.size,
        actionTrend:      calcTrend(actionSnap.size, prevActionSnap.size),
        socialClicks:     socialSnap.size,
        newFollowers:     followersSnap.size,
        followersTrend:   calcTrend(followersSnap.size, prevFollowersSnap.size),
        clicksByNetwork,
      });
    } catch (err) {
      console.error('useStats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, loadStats };
}
