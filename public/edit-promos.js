import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const storage = getStorage(app);

let promos = [];
let current = null;
let newImgFile = null;

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = '/welcome.html'; return; }
  try {
    const q1 = query(collection(db,'videos'),
      where('userId','==',user.uid),
      where('isActive','==',true),
      orderBy('createdAt','desc'));
    const snap = await getDocs(q1);
    promos = snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(v => v.intention==='selling_product' || v.intention==='selling_service');
    render();
  } catch(e) { console.error(e); }
});

function render() {
  const list = document.getElementById('promo-list');
  if (!promos.length) {
    document.getElementById('empty').style.display = 'block';
    return;
  }
  list.innerHTML = promos.map((v,i)=>{
    const isProd = v.intention==='selling_product';
    const name = isProd ? (v.productName||'Producto') : (v.actionButtonText||'Servicio');
    const price = isProd && v.productPrice ? v.productPrice+' '+(v.productCurrency||'€') : '';
    const thumb = v.thumbnailURL ? `<img src="${v.thumbnailURL}">` : `<video src="${v.videoURL}" muted preload="metadata"></video>`;
    return `<div class="promo-card" onclick="openEdit(${i})">
      <div class="promo-thumb">${thumb}</div>
      <div class="promo-info">
        <div class="promo-type">${isProd?'🛍️ Producto':'🎯 Servicio'}</div>
        <div class="promo-name">${name}</div>
        <div class="promo-price">${price}</div>
      </div>
      <div class="promo-edit">✏️</div>
    </div>`;
  }).join('');
}

window.openEdit = function(i) {
  current = promos[i];
  newImgFile = null;
  const isProd = current.intention==='selling_product';
  const p = document.getElementById('panel');
  p.innerHTML = `
    <h3>${isProd?'🛍️ Editar producto':'🎯 Editar servicio'}</h3>
    <label class="f-label">Descripción del video</label>
    <textarea class="f-textarea" id="e-desc">${current.description||''}</textarea>
    ${isProd ? `
    <label class="f-label">Nombre del producto</label>
    <input class="f-input" id="e-name" value="${(current.productName||'').replace(/"/g,'&quot;')}">
    <label class="f-label">Precio</label>
    <div class="f-row">
      <input class="f-input" id="e-price" type="number" step="0.01" value="${current.productPrice||''}">
      <select class="f-select" id="e-currency">
        <option ${current.productCurrency==='€'?'selected':''}>€</option>
        <option ${current.productCurrency==='$'?'selected':''}>$</option>
        <option ${current.productCurrency==='£'?'selected':''}>£</option>
      </select>
    </div>
    <label class="f-label">Foto del producto</label>
    ${current.productImage?`<img class="img-preview" id="e-img-prev" src="${current.productImage}">`:'<img class="img-preview" id="e-img-prev" style="display:none">'}
    <input class="f-input" type="file" id="e-img" accept="image/*">
    <label class="f-label">Enlace de compra / contacto (URL, wa.me o mailto)</label>
    <input class="f-input" id="e-url" value="${(current.productURL||'').replace(/"/g,'&quot;')}">
    ` : `
    <label class="f-label">Texto del botón (CTA)</label>
    <input class="f-input" id="e-ctatext" value="${(current.actionButtonText||'').replace(/"/g,'&quot;')}">
    <label class="f-label">Enlace del botón</label>
    <input class="f-input" id="e-ctaurl" value="${(current.actionButtonURL||'').replace(/"/g,'&quot;')}">
    `}
    <button class="btn-gold" id="e-save" onclick="savePromo()">Guardar cambios</button>
    <button class="btn-cancel" onclick="closePanel()">Cancelar</button>`;
  document.getElementById('overlay').style.display='block';
  p.style.display='block';
  const imgInput = document.getElementById('e-img');
  if (imgInput) imgInput.addEventListener('change', e=>{
    newImgFile = e.target.files[0]||null;
    if (newImgFile) {
      const prev = document.getElementById('e-img-prev');
      prev.src = URL.createObjectURL(newImgFile);
      prev.style.display='block';
    }
  });
};

window.closePanel = function() {
  document.getElementById('overlay').style.display='none';
  document.getElementById('panel').style.display='none';
};

window.savePromo = async function() {
  if (!current) return;
  const p = document.getElementById('panel');
  p.classList.add('saving');
  document.getElementById('e-save').textContent = 'Guardando...';
  try {
    const upd = { description: document.getElementById('e-desc').value.trim() };
    if (current.intention==='selling_product') {
      upd.productName = document.getElementById('e-name').value.trim();
      upd.productPrice = document.getElementById('e-price').value;
      upd.productCurrency = document.getElementById('e-currency').value;
      let u = document.getElementById('e-url').value.trim();
      if (u && !u.startsWith('http') && !u.startsWith('mailto:')) u = 'https://' + u;
      upd.productURL = u;
      if (newImgFile) {
        const r = ref(storage, 'products/'+current.id+'_'+Date.now()+'.jpg');
        await uploadBytes(r, newImgFile);
        upd.productImage = await getDownloadURL(r);
      }
    } else {
      upd.actionButtonText = document.getElementById('e-ctatext').value.trim();
      let u = document.getElementById('e-ctaurl').value.trim();
      if (u && !u.startsWith('http')) u = 'https://' + u;
      upd.actionButtonURL = u;
    }
    await updateDoc(doc(db,'videos',current.id), upd);
    Object.assign(current, upd);
    render();
    closePanel();
  } catch(e) {
    console.error(e);
    alert('Error al guardar. Inténtalo de nuevo.');
  }
  p.classList.remove('saving');
};
