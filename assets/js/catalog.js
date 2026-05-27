import { db, auth, collection, getDocs, query, where, onAuthStateChanged, doc, updateDoc, increment }
  from './firebase-config.js';

// ── Auth ──────────────────────────────────────────────
const adminBtn = document.getElementById('btn-admin');
onAuthStateChanged(auth, user => {
  adminBtn.href = user ? './admin/dashboard.html' : './login.html';
  document.getElementById('btn-admin-label').textContent = user ? 'Dashboard' : 'Admin';
});

// ── Estado global ─────────────────────────────────────
const PAGE_SIZE = 10;
let all = [], gF = '', modalData = null;
let currentPage = 1, filtered = [];

// Carrito: [{ id, nombre, marca, imagen, size, price }]
let cart = [];

// ── Helpers ───────────────────────────────────────────
function minPrecio(p) {
  const vals = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : 9999;
}

window.syncMobileSearch = () => {
  document.getElementById('q').value = document.getElementById('q-mobile').value;
  renderGrid();
};

// ── Skeletons ─────────────────────────────────────────
function showSkeletons() {
  document.getElementById('grid').innerHTML = Array(8).fill(`
    <div class="skel-card">
      <div class="skel-img skel"></div>
      <div class="skel-body">
        <div class="skel-line skel" style="width:45%"></div>
        <div class="skel-line skel" style="width:70%"></div>
        <div class="skel-line skel" style="width:55%"></div>
      </div>
    </div>`).join('');
}

// ── Load data ─────────────────────────────────────────
async function load() {
  showSkeletons();
  const snap = await getDocs(query(collection(db, 'perfumes'), where('activo', '==', true)));
  all = [];
  snap.forEach(d => all.push({ id: d.id, ...d.data() }));
  renderGrid();
}

// ── Card HTML ─────────────────────────────────────────
function cardHTML(p) {
  const pr    = p.precios || {};
  const sizes = Object.entries(pr).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);
  const pills = sizes.map(([k, v]) => `<div class="cpill">${k}ml — $${v}</div>`).join('');
  const inCart = cart.some(i => i.id === p.id);
  return `<div class="pcard" onclick="openModal('${p.id}')">
    <div class="card-img">
      ${p.imagen
        ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="400" height="300">`
        : '<div class="card-no-img"><i class="bi bi-droplet"></i></div>'}
      ${inCart ? '<div class="card-in-cart"><i class="bi bi-bag-check-fill"></i></div>' : ''}
    </div>
    <div class="card-body">
      <div class="card-marca">${p.marca || ''}</div>
      <div class="card-nombre">${p.nombre}</div>
      <div class="card-pills">${pills || '<span style="font-size:12px;color:#444">Sin precios</span>'}</div>
    </div>
  </div>`;
}

// ── Render grid ───────────────────────────────────────
window.renderGrid = () => {
  currentPage = 1;
  const q    = document.getElementById('q').value.toLowerCase().trim();
  const sort = document.getElementById('sort').value;
  const sm   = document.getElementById('sort-mobile');
  if (sm && sm.value !== sort) sm.value = sort;

  filtered = all.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q)) &&
    (!gF || p.genero === gF)
  );
  filtered.sort((a, b) => {
    if (sort === 'relevancia')  return (b.clicks || 0) - (a.clicks || 0);
    if (sort === 'az')          return a.nombre.localeCompare(b.nombre);
    if (sort === 'za')          return b.nombre.localeCompare(a.nombre);
    if (sort === 'marca')       return (a.marca || '').localeCompare(b.marca || '');
    const pa = minPrecio(a), pb = minPrecio(b);
    if (sort === 'precio_asc')  return pa - pb;
    if (sort === 'precio_desc') return pb - pa;
    return 0;
  });

  document.getElementById('count-badge').textContent =
    filtered.length + ' perfume' + (filtered.length !== 1 ? 's' : '');

  const g = document.getElementById('grid');
  if (!filtered.length) {
    g.innerHTML = `<div class="empty-state"><i class="bi bi-search"></i><h3>Sin resultados</h3><p style="font-size:13px;color:#555">Intenta con otro nombre o quita los filtros.</p></div>`;
    updateLoadMore(); return;
  }
  g.innerHTML = filtered.slice(0, PAGE_SIZE).map(cardHTML).join('');
  updateLoadMore();
};

// ── Cargar más ────────────────────────────────────────
window.loadMore = () => {
  currentPage++;
  const chunk = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const g = document.getElementById('grid');
  chunk.forEach(p => { const d = document.createElement('div'); d.innerHTML = cardHTML(p); g.appendChild(d.firstElementChild); });
  updateLoadMore();
};

function updateLoadMore() {
  const shown = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const wrap  = document.getElementById('load-more-wrap');
  const info  = document.getElementById('load-more-info');
  if (filtered.length > PAGE_SIZE && shown < filtered.length) {
    wrap.style.display = 'flex';
    info.textContent   = `Mostrando ${shown} de ${filtered.length}`;
  } else {
    wrap.style.display = 'none';
  }
}

// ── Filtros ───────────────────────────────────────────
window.setG = btn => {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); gF = btn.dataset.g; renderGrid();
};

window.clearFilters = () => {
  document.getElementById('q').value = '';
  document.getElementById('q-mobile').value = '';
  document.getElementById('sort').value = 'relevancia';
  const sm = document.getElementById('sort-mobile'); if (sm) sm.value = 'relevancia';
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  document.querySelector('.ftab').classList.add('active');
  gF = ''; renderGrid();
};

// ── Modal ─────────────────────────────────────────────
window.openModal = id => {
  const p = all.find(x => x.id === id);
  if (!p) return;
  modalData = p;
  updateDoc(doc(db, 'perfumes', id), { clicks: increment(1) })
    .catch(() => {}); // silenciar error de permisos si no está autenticado

  document.getElementById('modal-img').innerHTML = p.imagen
    ? `<img src="${p.imagen}" alt="${p.nombre}">`
    : '<div class="modal-img-placeholder"><i class="bi bi-droplet"></i></div>';
  document.getElementById('modal-nombre').textContent = p.nombre;
  document.getElementById('modal-marca').textContent  = p.marca || '';
  document.getElementById('modal-desc').textContent   = p.descripcion || 'Sin descripción disponible.';

  const sizes = Object.entries(p.precios || {}).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);
  const pillsEl = document.getElementById('modal-pills');
  if (sizes.length) {
    pillsEl.innerHTML = sizes.map(([k, v], i) =>
      `<button class="mpill ${i===0?'sel':''}" data-size="${k}" data-price="${v}" onclick="selPill(this)">${k}ml — $${v}</button>`
    ).join('');
  } else {
    pillsEl.innerHTML = '<span style="font-size:13px;color:#555">Sin presentaciones disponibles.</span>';
  }

  renderModalCartBtn(p.id);

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function renderModalCartBtn(id) {
  const btn    = document.getElementById('modal-btn-cart');
  const inCart = cart.some(i => i.id === id);
  if (inCart) {
    btn.innerHTML = '<i class="bi bi-bag-check-fill"></i> Ya está en tu pedido';
    btn.classList.add('in-cart');
  } else {
    btn.innerHTML = '<i class="bi bi-bag-plus"></i> Agregar al pedido';
    btn.classList.remove('in-cart');
  }
}

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
  if (e.key === 'Escape') {
    document.getElementById('modal').classList.remove('open');
    document.body.style.overflow = '';
  }
});

window.pedirModal = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  const msg = sel
    ? `Hola! Me interesa un decant de:\n*${modalData.marca || ''} - ${modalData.nombre}*\nTamaño: ${sel.dataset.size}ml\nPrecio: $${sel.dataset.price} MXN`
    : `Hola! Me interesa el decant de:\n*${modalData.marca || ''} - ${modalData.nombre}*`;
  window.open(`https://wa.me/526648162623?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── CARRITO ───────────────────────────────────────────

window.addToCart = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  if (!sel) { flashPills(); return; }

  const key = modalData.id + '-' + sel.dataset.size;
  if (cart.find(i => i.key === key)) {
    showToast(`"${modalData.nombre} ${sel.dataset.size}ml" ya está en tu pedido`);
    return;
  }

  cart.push({
    key,
    id:     modalData.id,
    nombre: modalData.nombre,
    marca:  modalData.marca  || '',
    imagen: modalData.imagen || '',
    size:   sel.dataset.size,
    price:  +sel.dataset.price
  });

  renderModalCartBtn(modalData.id);
  updateCartBadge();
  renderGrid();
  showToast(`✓ ${modalData.nombre} ${sel.dataset.size}ml agregado`);
};

window.removeCartItem = key => {
  cart = cart.filter(i => i.key !== key);
  updateCartBadge();
  renderCartDrawer();
  renderGrid();
};

// ── Limpiar pedido (expuesto en window para onclick inline) ──
window.clearCart = () => {
  cart = [];
  updateCartBadge();
  renderCartDrawer();
  renderGrid();
};

window.toggleCart = () => {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  const open   = drawer.classList.toggle('open');
  overlay.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) renderCartDrawer();
};

window.closeCart = () => {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.style.overflow = '';
};

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const fab   = document.getElementById('cart-fab');
  if (cart.length > 0) {
    badge.textContent = cart.length;
    badge.style.display = 'flex';
    fab.classList.add('has-items');
  } else {
    badge.style.display = 'none';
    fab.classList.remove('has-items');
  }
  const totalEl = document.getElementById('cart-total');
  if (totalEl) {
    const total = cart.reduce((s, i) => s + i.price, 0);
    totalEl.textContent = '$' + total + ' MXN';
  }
}

function renderCartDrawer() {
  const list  = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const foot  = document.getElementById('cart-footer');
  const total = cart.reduce((s, i) => s + i.price, 0);

  if (!cart.length) {
    list.innerHTML      = '';
    empty.style.display = 'flex';
    foot.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  foot.style.display  = 'flex';

  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.imagen
          ? `<img src="${item.imagen}" alt="${item.nombre}" loading="lazy">`
          : '<div class="cart-item-no-img"><i class="bi bi-droplet"></i></div>'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-marca">${item.marca}</div>
        <div class="cart-item-nombre">${item.nombre}</div>
        <div class="cart-item-size">${item.size}ml — <strong>$${item.price}</strong></div>
      </div>
      <button class="cart-item-remove" onclick="removeCartItem('${item.key}')" aria-label="Quitar">
        <i class="bi bi-x"></i>
      </button>
    </div>`).join('');

  document.getElementById('cart-total').textContent = '$' + total + ' MXN';
}

window.sendCartWA = () => {
  if (!cart.length) return;
  const total = cart.reduce((s, i) => s + i.price, 0);
  const lines = cart.map(i => `• ${i.marca} - ${i.nombre} (${i.size}ml) — $${i.price} MXN`).join('\n');
  const msg   = `Hola! Quisiera hacer el siguiente pedido de decants:\n\n${lines}\n\n*Total estimado: $${total} MXN*\n\n¿Tienen disponibilidad? 🙏`;
  window.open(`https://wa.me/526648162623?text=${encodeURIComponent(msg)}`, '_blank');
};

function flashPills() {
  const pills = document.getElementById('modal-pills');
  pills.classList.add('flash');
  setTimeout(() => pills.classList.remove('flash'), 600);
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

load();
