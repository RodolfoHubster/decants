import { db, auth, collection, getDocs, query, where, onAuthStateChanged, doc, updateDoc, increment }
  from './firebase-config.js';

const adminBtn = document.getElementById('btn-admin');
onAuthStateChanged(auth, user => {
  if (user) {
    adminBtn.href = './admin/dashboard.html';
    document.getElementById('btn-admin-label').textContent = 'Dashboard';
  } else {
    adminBtn.href = './login.html';
    document.getElementById('btn-admin-label').textContent = 'Admin';
  }
});

let all = [], gF = '', modalData = null;

window.syncMobileSearch = () => {
  const val = document.getElementById('q-mobile').value;
  document.getElementById('q').value = val;
  renderGrid();
};

function showSkeletons() {
  const g = document.getElementById('grid');
  g.innerHTML = Array(8).fill(`
    <div class="skel-card">
      <div class="skel-img skel"></div>
      <div class="skel-body">
        <div class="skel-line skel" style="width:45%"></div>
        <div class="skel-line skel" style="width:70%"></div>
        <div class="skel-line skel" style="width:55%"></div>
      </div>
    </div>`).join('');
}

async function load() {
  showSkeletons();
  const snap = await getDocs(query(collection(db, 'perfumes'), where('activo', '==', true)));
  all = [];
  snap.forEach(d => all.push({ id: d.id, ...d.data() }));
  renderGrid();
}

window.renderGrid = () => {
  const q = document.getElementById('q').value.toLowerCase().trim();
  const sort = document.getElementById('sort').value;
  let fil = all.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q)) &&
    (!gF || p.genero === gF)
  );
  fil.sort((a, b) => {
    if (sort === 'relevancia') return (b.clicks || 0) - (a.clicks || 0);
    if (sort === 'az') return a.nombre.localeCompare(b.nombre);
    if (sort === 'za') return b.nombre.localeCompare(a.nombre);
    if (sort === 'marca') return (a.marca || '').localeCompare(b.marca || '');
    const pa = minPrecio(a), pb = minPrecio(b);
    if (sort === 'precio_asc') return pa - pb;
    if (sort === 'precio_desc') return pb - pa;
    return 0;
  });
  document.getElementById('count-badge').textContent = fil.length + ' perfume' + (fil.length !== 1 ? 's' : '');
  const g = document.getElementById('grid');
  if (!fil.length) {
    g.innerHTML = `<div class="empty-state"><i class="bi bi-search"></i><h3>Sin resultados</h3><p style="font-size:13px;color:#555">Intenta con otro nombre o quita los filtros.</p></div>`;
    return;
  }
  g.innerHTML = fil.map(p => {
    const pr = p.precios || {};
    const sizes = Object.entries(pr).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);
    const pills = sizes.map(([k, v]) => `<div class="cpill">${k}ml — $${v}</div>`).join('');
    const clicksBadge ='';
    return `<div class="pcard" onclick="openModal('${p.id}')">
      <div class="card-img">
        ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">` : '<div class="card-no-img"><i class="bi bi-droplet"></i></div>'}
      </div>
      <div class="card-body">
        <div class="card-marca">${p.marca || ''}</div>
        <div class="card-nombre">${p.nombre}</div>
        ${clicksBadge}
        <div class="card-pills">${pills || '<span style="font-size:12px;color:#444">Sin precios</span>'}</div>
      </div>
    </div>`;
  }).join('');
};

window.setG = btn => {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); gF = btn.dataset.g; renderGrid();
};

window.clearFilters = () => {
  document.getElementById('q').value = '';
  document.getElementById('q-mobile').value = '';
  document.getElementById('sort').value = 'relevancia';
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  document.querySelector('.ftab').classList.add('active');
  gF = ''; renderGrid();
};

window.openModal = id => {
  const p = all.find(x => x.id === id);
  if (!p) return;
  modalData = p;

  // Incrementar clicks en Firestore (en background, no bloquea el modal)
  updateDoc(doc(db, 'perfumes', id), { clicks: increment(1) })
    .then(() => {
      // Actualizar el contador local para que el sort sea inmediato
      const local = all.find(x => x.id === id);
      if (local) local.clicks = (local.clicks || 0) + 1;
    });

  document.getElementById('modal-img').innerHTML = p.imagen
    ? `<img src="${p.imagen}" alt="${p.nombre}">`
    : '<div class="modal-img-placeholder"><i class="bi bi-droplet"></i></div>';
  document.getElementById('modal-nombre').textContent = p.nombre;
  document.getElementById('modal-marca').textContent = p.marca || '';
  document.getElementById('modal-desc').textContent = p.descripcion || 'Sin descripción disponible.';
  const sizes = Object.entries(p.precios || {}).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);
  const pillsEl = document.getElementById('modal-pills');
  if (sizes.length) {
    pillsEl.innerHTML = sizes.map(([k, v], i) =>
      `<button class="mpill ${i===0?'sel':''}" data-size="${k}" data-price="${v}" onclick="selPill(this)">${k}ml — $${v}</button>`
    ).join('');
    document.getElementById('modal-btn').disabled = false;
  } else {
    pillsEl.innerHTML = '<span style="font-size:13px;color:#555">Sin presentaciones.</span>';
    document.getElementById('modal-btn').disabled = true;
  }
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.selPill = btn => {
  document.querySelectorAll('.mpill').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
};

window.closeModal = e => {
  if (e && e.target !== document.getElementById('modal')) return;
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.getElementById('modal').classList.remove('open'); document.body.style.overflow = ''; }
});

window.pedirModal = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  const msg = sel
    ? `Hola! Me interesa un decant de:\n*${modalData.marca || ''} - ${modalData.nombre}*\nTamaño: ${sel.dataset.size}ml\nPrecio: $${sel.dataset.price} MXN`
    : `Hola! Me interesa el decant de:\n*${modalData.marca || ''} - ${modalData.nombre}*`;
  window.open(`https://wa.me/526648162623?text=${encodeURIComponent(msg)}`, '_blank');
};

function minPrecio(p) {
  const vals = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : 9999;
}

load();