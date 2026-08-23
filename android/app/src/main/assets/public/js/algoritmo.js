// ── ALGORITMO XIMVID: vistos, impresiones e interacciones ──────
(function () {
  const KEY_VISTOS = 'ximvid_vistos';
  const VENTANA_DIAS = 14;
  const TOPE_INTERACCIONES = 3;

  function leerVistos() {
    try {
      const raw = localStorage.getItem(KEY_VISTOS);
      if (!raw) return {};
      const data = JSON.parse(raw);
      const limite = Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000;
      const limpio = {};
      for (const id in data) {
        if (data[id] > limite) limpio[id] = data[id];
      }
      return limpio;
    } catch (e) { return {}; }
  }

  function marcarVisto(videoId) {
    if (!videoId) return;
    try {
      const vistos = leerVistos();
      vistos[videoId] = Date.now();
      localStorage.setItem(KEY_VISTOS, JSON.stringify(vistos));
    } catch (e) {}
  }

  function estaVisto(videoId) {
    const vistos = leerVistos();
    return !!vistos[videoId];
  }

  function filtrarVistos(videos, minimo) {
    if (!Array.isArray(videos)) return [];
    const noVistos = videos.filter(v => !estaVisto(v.id));
    // Si quedan muy pocos, devolver todo (nunca dejar el feed vacio)
    if (noVistos.length < (minimo || 5)) return videos;
    return noVistos;
  }

  // Registra impresion SOLO de videos premium (metrica de alcance real)
  async function registrarImpresionPremium(video) {
    try {
      if (!video || !video.isPremiumUser) return;
      const uid = window._userData && window._userData.uid;
      if (!uid || uid === video.userId) return;
      const fb = window._fb, db = window._db;
      if (!fb || !db) return;
      await fb.setDoc(
        fb.doc(db, 'impressions', video.id + '_' + uid),
        { videoId: video.id, userId: uid, creatorId: video.userId, createdAt: fb.serverTimestamp() },
        { merge: true }
      );
    } catch (e) {}
  }

  // Registra interaccion unica por usuario (tope 3, nunca el propio creador)
  async function registrarInteraccion(videoId, creatorId, tipo) {
    try {
      if (!videoId) return;
      const uid = window._userData && window._userData.uid;
      if (!uid || uid === creatorId) return;
      const fb = window._fb, db = window._db;
      if (!fb || !db) return;
      const ref = fb.doc(db, 'interactions', videoId + '_' + uid);
      const snap = await fb.getDoc(ref);
      const actual = (snap.exists() && snap.data().count) || 0;
      if (actual >= TOPE_INTERACCIONES) return;
      await fb.setDoc(ref, {
        videoId: videoId,
        userId: uid,
        creatorId: creatorId || null,
        count: actual + 1,
        lastType: tipo || 'unknown',
        updatedAt: fb.serverTimestamp(),
      }, { merge: true });
    } catch (e) {}
  }

  // Registra un clic con fecha para estadisticas. Tope 3 por usuario+video.
  async function registrarClick(videoId, creatorId, tipo, network) {
    try {
      if (!videoId) return;
      const uid = window._userData && window._userData.uid;
      if (!uid) return;
      const fb = window._fb, db = window._db;
      if (!fb || !db) return;
      const ref = fb.doc(db, 'clicks', videoId + '_' + uid);
      const snap = await fb.getDoc(ref);
      const prev = (snap.exists() && snap.data().events) || [];
      if (prev.length >= 3) return;
      const evento = {
        ts: Date.now(),
        tipo: tipo || 'cta',
        network: network || null
      };
      await fb.setDoc(ref, {
        videoId: videoId,
        userId: uid,
        creatorId: creatorId || null,
        events: prev.concat([evento]),
        updatedAt: fb.serverTimestamp(),
      }, { merge: true });
    } catch (e) { console.warn('registrarClick:', e); }
  }

  window._algo = {
    marcarVisto: marcarVisto,
    estaVisto: estaVisto,
    filtrarVistos: filtrarVistos,
    registrarImpresionPremium: registrarImpresionPremium,
    registrarInteraccion: registrarInteraccion,
    registrarClick: registrarClick,
  };
})();
