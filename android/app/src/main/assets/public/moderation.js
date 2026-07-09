import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, addDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyD9rczM9lYndi4nt4Cv4EjE63QekuYxBpI",
  authDomain: "ximvid-c8627.firebaseapp.com",
  projectId: "ximvid-c8627",
  storageBucket: "ximvid-c8627.firebasestorage.app",
  messagingSenderId: "278931359476",
  appId: "1:278931359476:web:30fef5be9d11890bef80a1"
});
const auth = getAuth(app);
const db = getFirestore(app);

let pending = [];
let reviewed = 0;

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = '/welcome.html'; return; }
  const uSnap = await getDoc(doc(db,'users',user.uid));
  const u = uSnap.exists() ? uSnap.data() : {};
  if (u.isAdmin !== true && u.isModerator !== true) {
    document.getElementById('mfeed').innerHTML = '<div class="denied">Acceso solo para moderadores</div>';
    return;
  }
  await loadQueue();
});

let currentTab = 'pending';
const TAB_LABELS = { pending: 'pendientes', approved: 'aprobados', rejected: 'rechazados' };
window.switchTab = async function(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('count').textContent = '…';
  await loadQueue();
  document.getElementById('mfeed').scrollTop = 0;
};
async function loadQueue() {
  try {
    // Videos activos sin revisar (sin moderationStatus o pending)
    if (currentTab === 'pending') {
      const snap = await getDocs(query(
        collection(db,'videos'),
        where('isActive','==',true),
        orderBy('createdAt','desc'),
        limit(100)
      ));
      pending = snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(v => !v.moderationStatus || v.moderationStatus === 'pending'
          || (v.moderationStatus === 'approved' && (v.reportCount||0) > 0 && (!v.reportsReviewedAt || (v.reportedAt && v.reportedAt.seconds > v.reportsReviewedAt.seconds))))
        .sort((a,b)=>(b.reportCount||0)-(a.reportCount||0));
    } else {
      const snap = await getDocs(query(
        collection(db,'videos'),
        where('moderationStatus','==',currentTab),
        limit(100)
      ));
      pending = snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>((b.moderatedAt&&b.moderatedAt.seconds)||0)-((a.moderatedAt&&a.moderatedAt.seconds)||0));
    }
    render();
  } catch(e) { console.error(e); }
}

function render() {
  const feed = document.getElementById('mfeed');
  document.getElementById('count').textContent = pending.length + ' ' + TAB_LABELS[currentTab];
  if (!pending.length) {
    const msgs = { pending: '✅ Cola vacía.<br>Todos los videos están revisados.', approved: 'Aún no hay videos aprobados.', rejected: 'No hay videos rechazados.' };
    feed.innerHTML = '<div class="empty"><div class="big">' + (currentTab==='pending'?'✅':'📂') + '</div>' + msgs[currentTab] + '</div>';
    return;
  }
  feed.innerHTML = pending.map((v,i)=>`
    <div class="mslide" id="slide-${v.id}">
      <video src="${v.videoURL}" ${v.thumbnailURL?`poster="${v.thumbnailURL}"`:''} loop muted playsinline preload="${i<2?'auto':'none'}" ></video>
      <div class="minfo">
        <div class="muser">@${v.username||'sin nombre'}</div>
        <div class="mdesc">${(v.description||'').slice(0,120)}</div>
        <div class="mtype">${v.intention==='selling_product'?'🛍️ Producto':v.intention==='selling_service'?'🎯 Servicio':'🎨 Contenido'}</div>${(v.reportCount||0)>0?`<div class="mtype" style="color:#e5484d;border-color:rgba(229,72,77,.5);margin-left:6px;">🚩 x${v.reportCount} reportes</div>`:''}
      </div>
      <div class="mctrl">
        <div class="mtimeline" onclick="seekTo(event,'${v.id}')">
          <div class="mtrack"><div class="mprog" id="prog-${v.id}"></div></div>
        </div>
        <div class="mtime" id="time-${v.id}">0:00 / 0:00</div>
      </div>
      <div class="mtools">
        <button class="mtool" onclick="setSpeed('${v.id}',1,this)">1x</button>
        <button class="mtool" onclick="setSpeed('${v.id}',1.5,this)">1.5x</button>
        <button class="mtool" onclick="setSpeed('${v.id}',2,this)">2x</button>
        <button class="mtool" onclick="zoomVid('${v.id}',1)">🔍+</button>
        <button class="mtool" onclick="zoomVid('${v.id}',-1)">🔍−</button>
      </div>
      <div class="mdone" id="done-${v.id}"></div>
      <div class="mbtns">${
        currentTab === 'pending' ? `
        <button class="mbtn ok" onclick="moderate('${v.id}','approved')"><span style="font-size:1.3rem">✅</span>Aprobar</button>
        <button class="mbtn bad" onclick="moderate('${v.id}','rejected')"><span style="font-size:1.3rem">🚫</span>Inapropiado</button>`
        : currentTab === 'approved' ? `
        <button class="mbtn bad" onclick="moderate('${v.id}','rejected')"><span style="font-size:1.3rem">🚫</span>Rechazar</button>`
        : `
        <button class="mbtn ok" onclick="moderate('${v.id}','restored')"><span style="font-size:1.3rem">♻️</span>Restaurar</button>`
      }</div>
    </div>`).join('');
  // Autoplay del visible
  const obs = new IntersectionObserver(es=>{
    es.forEach(e=>{
      const vid = e.target.querySelector('video');
      if (!vid) return;
      if (e.isIntersecting && e.intersectionRatio > 0.6) { vid.preload='auto'; vid.play().catch(()=>{}); }
      else vid.pause();
    });
  },{threshold:[0.6]});
  document.querySelectorAll('.mslide').forEach(s=>{ obs.observe(s); enablePan(s); });
}

window.moderate = async function(videoId, decision) {
  const v = pending.find(x=>x.id===videoId);
  if (!v) return;
  const doneEl = document.getElementById('done-'+videoId);
  try {
    if (decision === 'approved') {
      await updateDoc(doc(db,'videos',videoId), {
        moderationStatus: 'approved',
        moderatedAt: serverTimestamp(),
        reportsReviewedAt: serverTimestamp()
      });
      doneEl.textContent = '✅'; doneEl.classList.add('show');
    } else if (decision === 'restored') {
      await updateDoc(doc(db,'videos',videoId), {
        moderationStatus: 'approved',
        moderatedAt: serverTimestamp(),
        isActive: true
      });
      if (v.userId) {
        try { await updateDoc(doc(db,'users',v.userId), { rejectedCount: increment(-1) }); } catch(e){}
      }
      doneEl.textContent = '♻️'; doneEl.classList.add('show');
    } else {
      // Rechazar: ocultar de la app (isActive false) + strike al usuario
      await updateDoc(doc(db,'videos',videoId), {
        moderationStatus: 'rejected',
        moderatedAt: serverTimestamp(),
        isActive: false
      });
      if (v.userId) {
        try { await updateDoc(doc(db,'users',v.userId), { rejectedCount: increment(1) }); } catch(e){}
        // Notificacion -> dispara el email automatico de censura
        await addDoc(collection(db,'notifications'), {
          userId: v.userId,
          type: 'video_rejected',
          message: 'Uno de tus videos ha sido retirado por contenido inapropiado',
          videoDesc: (v.description||'').slice(0,80),
          read: false,
          createdAt: serverTimestamp()
        });
      }
      doneEl.textContent = '🚫'; doneEl.classList.add('show');
    }
    // Quitar de la cola y scroll al siguiente
    pending = pending.filter(x=>x.id!==videoId);
    reviewed++;
    document.getElementById('count').textContent = pending.length + ' ' + TAB_LABELS[currentTab];
    setTimeout(()=>{
      const slide = document.getElementById('slide-'+videoId);
      const next = slide?.nextElementSibling;
      if (next) next.scrollIntoView({behavior:'smooth'});
      setTimeout(()=>slide?.remove(), 600);
      if (!pending.length) render();
    }, 500);
  } catch(e) { console.error(e); alert('Error al moderar'); }
};


// ── Controles del reproductor de moderacion ──
function fmt(s){ if(!isFinite(s))return'0:00'; const m=Math.floor(s/60),ss=Math.floor(s%60); return m+':'+(ss<10?'0':'')+ss; }

window.seekTo = function(ev, id) {
  const slide = document.getElementById('slide-'+id);
  const vid = slide?.querySelector('video');
  if (!vid || !isFinite(vid.duration)) return;
  const rect = ev.currentTarget.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
  vid.currentTime = pct * vid.duration;
};

window.setSpeed = function(id, rate, btn) {
  const vid = document.getElementById('slide-'+id)?.querySelector('video');
  if (!vid) return;
  vid.playbackRate = rate;
  btn.parentElement.querySelectorAll('.mtool').forEach(b=>{ if(['1x','1.5x','2x'].includes(b.textContent)) b.classList.remove('active'); });
  btn.classList.add('active');
};

const _zoom = {};
const _pan = {};
window.zoomVid = function(id, dir) {
  const vid = document.getElementById('slide-'+id)?.querySelector('video');
  if (!vid) return;
  _zoom[id] = Math.min(5, Math.max(1, (_zoom[id]||1) + dir*0.5));
  if (_zoom[id] === 1) _pan[id] = {x:0,y:0};
  const p = _pan[id] || {x:0,y:0};
  vid.style.transform = 'scale('+_zoom[id]+') translate('+p.x+'px,'+p.y+'px)';
  vid.style.cursor = _zoom[id] > 1 ? 'grab' : '';
};

// Arrastrar el video cuando hay zoom (mouse y tactil)
function enablePan(slide) {
  const vid = slide.querySelector('video');
  if (!vid) return;
  const id = slide.id.replace('slide-','');
  let dragging = false, sx=0, sy=0, ox=0, oy=0;
  const start = (x,y) => {
    if ((_zoom[id]||1) <= 1) return false;
    dragging = true; sx=x; sy=y;
    const p = _pan[id]||{x:0,y:0}; ox=p.x; oy=p.y;
    return true;
  };
  const move = (x,y) => {
    if (!dragging) return;
    if (Math.abs(x-sx) > 5 || Math.abs(y-sy) > 5) moved = true;
    const z = _zoom[id]||1;
    _pan[id] = { x: ox + (x-sx)/z, y: oy + (y-sy)/z };
    vid.style.transform = 'scale('+z+') translate('+_pan[id].x+'px,'+_pan[id].y+'px)';
  };
  let moved = false;
  const end = () => { dragging = false; };
  // Un clic: pausar (solo si no arrastraste). Doble clic: reanudar.
  vid.addEventListener('click', e => {
    if (moved) { moved = false; return; }
    if (!vid.paused) vid.pause();
  });
  vid.addEventListener('dblclick', e => {
    if (vid.paused) vid.play().catch(()=>{});
  });
  vid.addEventListener('mousedown', e=>{ moved = false; if(start(e.clientX,e.clientY)) e.preventDefault(); });
  window.addEventListener('mousemove', e=>move(e.clientX,e.clientY));
  window.addEventListener('mouseup', end);
  vid.addEventListener('touchstart', e=>{ const t=e.touches[0]; start(t.clientX,t.clientY); }, {passive:true});
  vid.addEventListener('touchmove', e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); }, {passive:true});
  vid.addEventListener('touchend', end);
}

// Actualizar timeline mientras reproduce
setInterval(()=>{
  document.querySelectorAll('.mslide').forEach(s=>{
    const vid = s.querySelector('video');
    if (!vid || vid.paused) return;
    const id = s.id.replace('slide-','');
    const prog = document.getElementById('prog-'+id);
    const time = document.getElementById('time-'+id);
    if (prog && isFinite(vid.duration)) prog.style.width = (vid.currentTime/vid.duration*100)+'%';
    if (time) time.textContent = fmt(vid.currentTime)+' / '+fmt(vid.duration);
  });
}, 250);
