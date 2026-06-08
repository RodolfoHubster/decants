import { db, auth, collection, getDocs, query, where, onAuthStateChanged, doc, updateDoc, increment }
  from './firebase-config.js';
import { addItem, decrementItem, removeItem, clearCart as pureCleart,
         calcTotal, totalUnits, buildWhatsAppURL, getItemQty, MAX_QTY,
         saveCart, loadCart, clearSavedCart, cartExpiresInMinutes }
  from './cart.js';
import { perfumeURL, getSlugFromURL, findBySlug } from './slug.js';

// ── Auth ──────────────────────────────────────────
const adminBtn = document.getElementById('btn-admin');
onAuthStateChanged(auth, user => {
  adminBtn.href = user ? './admin/dashboard.html' : './login.html';
  document.getElementById('btn-admin-label').textContent = user ? 'Dashboard' : 'Admin';
});

// ── Estado global ─────────────────────────────────
const PAGE_SIZE = 10;
let all = [], gF = '', modalData = null;
let currentPage = 1, filtered = [];
let cart = loadCart();

// ── Undo stack ────────────────────────────────────
let undoStack = [];
let undoTimer = null;
const UNDO_TIMEOUT = 5000;

function pushUndo(prevCart, label) {
  undoStack.push({ cart: prevCart, label });
  if (undoStack.length > 1) undoStack.shift();
  showUndoToast(label);
}

function showUndoToast(label) {
  clearTimeout(undoTimer);
  let t = document.getElementById('undo-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'undo-toast';
    t.innerHTML = `<span id="undo-msg"></span><button id="undo-btn" onclick="undoDelete()">Deshacer</button>`;
    document.body.appendChild(t);
  }
  document.getElementById('undo-msg').textContent = label;
  t.classList.add('show');
  undoTimer = setTimeout(() => { t.classList.remove('show'); undoStack = []; }, UNDO_TIMEOUT);
}

window.undoDelete = () => {
  if (!undoStack.length) return;
  const { cart: prev } = undoStack.pop();
  cart = prev;
  persistCart(); updateCartBadge(); renderCartDrawer(); patchGridBadges();
  if (modalData) syncModalCartBtn();
  const t = document.getElementById('undo-toast');
  if (t) t.classList.remove('show');
  clearTimeout(undoTimer);
  showToast('↩ Acción deshecha');
};

// ── Helpers ───────────────────────────────────────
function minPrecio(p) {
  const vals = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : 9999;
}

window.syncMobileSearch = () => {
  document.getElementById('q').value = document.getElementById('q-mobile').value;
  renderGrid();
};

// ── Meta tags OG dinámicos ────────────────────────
function setMetaTags({ title, description, image, url }) {
  const set = (sel, attr, val) => {
    let el = document.querySelector(sel);
    if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
    el.setAttribute(attr, val);
  };
  document.title = title;
  set('meta[property="og:title"]',       'content', title);
  set('meta[property="og:description"]', 'content', description);
  set('meta[property="og:image"]',       'content', image || 'https://fitoscents.com/assets/img/og-default.jpg');
  set('meta[property="og:url"]',         'content', url || window.location.href);
  set('meta[property="og:type"]',        'content', 'product');
  set('meta[name="description"]',        'content', description);

  // Añadir atributos al head si no existen
  ['og:title','og:description','og:image','og:url','og:type'].forEach(prop => {
    let el = document.querySelector(`meta[property="${prop}"]`);
    if (el && !el.getAttribute('property')) el.setAttribute('property', prop);
  });
}

function resetMetaTags() {
  document.title = 'Fitoscents · Decants';
  setMetaTags({
    title:       'Fitoscents · Decants',
    description: 'Decants 100% originales de perfumes de diseñador desde 2ml. Tijuana, B.C.',
    image:       'https://fitoscents.com/assets/img/og-default.jpg',
    url:         'https://fitoscents.com/'
  });
}

// ── Skeletons ─────────────────────────────────────
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

// ── Load data ─────────────────────────────────────
async function load() {
  showSkeletons();
  const snap = await getDocs(query(collection(db, 'perfumes'), where('activo', '==', true)));
  all = [];
  snap.forEach(d => all.push({ id: d.id, ...d.data() }));
  renderGrid();
  if (cart.length) {
    const mins = cartExpiresInMinutes();
    showToast(`🛒 Pedido restaurado (${cart.length} item${cart.length > 1 ? 's' : ''})${mins ? ` · expira en ${mins} min` : ''}`);
    updateCartBadge();
  }

  // ── Deep link: abrir modal si la URL tiene slug ──
  const slug = getSlugFromURL();
  if (slug) {
    const p = findBySlug(all, slug);
    if (p) {
      openModal(p.id);
    } else {
      // Slug no encontrado → regresar al inicio limpio
      history.replaceState(null, '', '/');
    }
  }
}

// ── Card HTML ─────────────────────────────────────
function cardHTML(p) {
  const pr    = p.precios || {};
  const sizes = Object.entries(pr).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);
  const pills = sizes.map(([k, v]) => `<div class="cpill">${k}ml — $${v}</div>`).join('');
  const units = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0);
  return `<div class="pcard" onclick="openModal('${p.id}')" data-id="${p.id}">
    <div class="card-img">
      ${p.imagen
        ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="400" height="300">`
        : '<div class="card-no-img"><i class="bi bi-droplet"></i></div>'}
      ${units > 0 ? `<div class="card-in-cart"><i class="bi bi-bag-check-fill"></i>${units > 1 ? ` <span>${units}</span>` : ''}</div>` : ''}
    </div>
    <div class="card-body">
      <div class="card-marca">${p.marca || ''}</div>
      <div class="card-nombre">${p.nombre}</div>
      <div class="card-pills">${pills || '<span style="font-size:12px;color:#444">Sin precios</span>'}</div>
    </div>
  </div>`;
}

// ── Render grid ───────────────────────────────────
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

// ── Patch badges in-place ─────────────────────────
function patchGridBadges() {
  document.querySelectorAll('.pcard[data-id]').forEach(card => {
    const id    = card.dataset.id;
    const units = cart.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0);
    const img   = card.querySelector('.card-img');
    if (!img) return;
    let badge = img.querySelector('.card-in-cart');
    if (units > 0) {
      const html = `<i class="bi bi-bag-check-fill"></i>${units > 1 ? ` <span>${units}</span>` : ''}`;
      if (badge) { badge.innerHTML = html; }
      else { badge = document.createElement('div'); badge.className = 'card-in-cart'; badge.innerHTML = html; img.appendChild(badge); }
    } else {
      if (badge) badge.remove();
    }
  });
}

function persistCart() {
  if (cart.length) saveCart(cart);
  else clearSavedCart();
}

// ── Cargar más ────────────────────────────────────
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

// ── Filtros ───────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────
window.openModal = id => {
  const p = all.find(x => x.id === id);
  if (!p) return;
  modalData = p;
  updateDoc(doc(db, 'perfumes', id), { clicks: increment(1) }).catch(() => {});

  // Actualizar URL y meta tags
  const url = perfumeURL(p);
  history.pushState({ perfumeId: id }, '', url);
  const precio = minPrecio(p);
  setMetaTags({
    title:       `${p.nombre}${p.marca ? ' · ' + p.marca : ''} — Fitoscents`,
    description: `Decant original de ${p.nombre}${p.marca ? ' de ' + p.marca : ''} desde $${precio} MXN. ${p.descripcion || ''}`.trim(),
    image:       p.imagen || '',
    url:         'https://fitoscents.com' + url
  });

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

  syncModalCartBtn();
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function syncModalCartBtn() {
  if (!modalData) return;
  const sel     = document.querySelector('.mpill.sel');
  const wrapper = document.getElementById('modal-cart-wrapper');
  if (!wrapper) return;
  if (!sel) {
    wrapper.innerHTML = `<button class="btn-add-cart" onclick="addToCart()"><i class="bi bi-bag-plus"></i> Agregar al pedido</button>`;
    return;
  }
  const key = modalData.id + '-' + sel.dataset.size;
  const qty = getItemQty(cart, key);
  if (qty === 0) {
    wrapper.innerHTML = `<button class="btn-add-cart" onclick="addToCart()"><i class="bi bi-bag-plus"></i> Agregar al pedido</button>`;
  } else if (qty >= MAX_QTY) {
    wrapper.innerHTML = `<div class="modal-qty-controls"><button class="mqty-btn" onclick="modalDecrement()">−</button><span class="mqty-num">${qty}</span><button class="mqty-btn" disabled>+</button></div>`;
  } else {
    wrapper.innerHTML = `<div class="modal-qty-controls"><button class="mqty-btn" onclick="modalDecrement()">−</button><span class="mqty-num">${qty}</span><button class="mqty-btn" onclick="modalIncrement()">+</button></div>`;
  }
}

window.modalIncrement = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  if (!sel) return;
  const key = modalData.id + '-' + sel.dataset.size;
  const idx = cart.findIndex(i => i.key === key);
  if (idx === -1) return;
  if (cart[idx].qty >= MAX_QTY) { showToast(`Máximo ${MAX_QTY} unidades`); return; }
  const { cart: newCart } = addItem(cart, cart[idx]);
  cart = newCart;
  persistCart(); syncModalCartBtn(); updateCartBadge(); patchGridBadges();
};

window.modalDecrement = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  if (!sel) return;
  const key  = modalData.id + '-' + sel.dataset.size;
  const item = cart.find(i => i.key === key);
  if (!item) return;
  if (item.qty === 1) {
    const prev = [...cart], label = `${item.nombre} ${item.size}ml eliminado`;
    cart = removeItem(cart, key);
    persistCart(); pushUndo(prev, label);
  } else {
    cart = decrementItem(cart, key); persistCart();
  }
  syncModalCartBtn(); updateCartBadge(); patchGridBadges();
};

window.selPill = btn => {
  document.querySelectorAll('.mpill').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel'); syncModalCartBtn();
};

// Al cerrar modal → restaurar URL y meta tags
function doCloseModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  modalData = null;
  history.pushState(null, '', '/');
  resetMetaTags();
}

window.closeModal = e => {
  if (e && e.target !== document.getElementById('modal')) return;
  doCloseModal();
};

// Botón X del modal llama a doCloseModal directamente
window.doCloseModal = doCloseModal;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') doCloseModal();
});

// Botón atrás del navegador cierra modal si estaba abierto
window.addEventListener('popstate', () => {
  const modal = document.getElementById('modal');
  if (modal && modal.classList.contains('open')) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    modalData = null;
    resetMetaTags();
  }
});

window.pedirModal = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  const url = 'https://fitoscents.com' + perfumeURL(modalData);
  const msg = sel
    ? `Hola! Me interesa un decant de:\n*${modalData.marca || ''} - ${modalData.nombre}*\nTamaño: ${sel.dataset.size}ml\nPrecio: $${sel.dataset.price} MXN\n${url}`
    : `Hola! Me interesa el decant de:\n*${modalData.marca || ''} - ${modalData.nombre}*\n${url}`;
  window.open(`https://wa.me/526648162623?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── CARRITO ───────────────────────────────────────

window.addToCart = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  if (!sel) { flashPills(); return; }
  const item = {
    key:    modalData.id + '-' + sel.dataset.size,
    id:     modalData.id,
    nombre: modalData.nombre,
    marca:  modalData.marca  || '',
    imagen: modalData.imagen || '',
    size:   sel.dataset.size,
    price:  +sel.dataset.price,
    qty:    1,
  };
  const { cart: newCart, added, reason } = addItem(cart, item);
  if (!added) { if (reason === 'max_qty') showToast(`Máximo ${MAX_QTY} unidades por talla`); return; }
  cart = newCart;
  persistCart();
  showToast(`✓ ${modalData.nombre} ${sel.dataset.size}ml agregado`);
  syncModalCartBtn(); updateCartBadge(); patchGridBadges();
};

window.incrementCartItem = key => {
  const idx = cart.findIndex(i => i.key === key);
  if (idx === -1) return;
  if (cart[idx].qty >= MAX_QTY) { showToast(`Máximo ${MAX_QTY} unidades por talla`); return; }
  const { cart: newCart } = addItem(cart, cart[idx]);
  cart = newCart;
  persistCart();
  const newQty  = cart.find(i => i.key === key).qty;
  const qtyEl   = document.querySelector(`.cart-qty-num[data-key="${key}"]`);
  const plusBtn = document.querySelector(`.cart-qty-btn[data-inc="${key}"]`);
  if (qtyEl)   qtyEl.textContent = newQty;
  if (plusBtn) plusBtn.disabled  = (newQty >= MAX_QTY);
  _updateDecBtn(key, newQty);
  updateCartBadge(); patchGridBadges();
  if (modalData?.id === cart.find(i => i.key === key)?.id) syncModalCartBtn();
};

window.decrementCartItem = key => {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  if (item.qty === 1) {
    const prev = [...cart], label = `${item.nombre} ${item.size}ml eliminado`;
    cart = removeItem(cart, key);
    persistCart(); pushUndo(prev, label);
    updateCartBadge(); renderCartDrawer(); patchGridBadges();
    if (modalData) syncModalCartBtn();
    return;
  }
  cart = decrementItem(cart, key);
  persistCart();
  const updated = cart.find(i => i.key === key);
  if (!updated) { renderCartDrawer(); }
  else {
    const qtyEl   = document.querySelector(`.cart-qty-num[data-key="${key}"]`);
    const plusBtn = document.querySelector(`.cart-qty-btn[data-inc="${key}"]`);
    if (qtyEl)   qtyEl.textContent = updated.qty;
    if (plusBtn) plusBtn.disabled  = (updated.qty >= MAX_QTY);
    _updateDecBtn(key, updated.qty);
  }
  updateCartBadge(); patchGridBadges();
  if (modalData) syncModalCartBtn();
};

function _updateDecBtn(key, qty) {
  const decBtn = document.querySelector(`.cart-qty-btn[data-dec="${key}"]`);
  if (!decBtn) return;
  if (qty === 1) {
    decBtn.classList.add('is-trash');
    decBtn.innerHTML = '<i class="bi bi-trash"></i>';
    decBtn.setAttribute('aria-label', 'Eliminar item');
  } else {
    decBtn.classList.remove('is-trash');
    decBtn.innerHTML = '−';
    decBtn.setAttribute('aria-label', 'Quitar uno');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const cartList = document.getElementById('cart-list');
  cartList.addEventListener('click', e => {
    const incBtn = e.target.closest('.cart-qty-btn[data-inc]');
    if (incBtn) { incrementCartItem(incBtn.dataset.inc); return; }
    const decBtn = e.target.closest('.cart-qty-btn[data-dec]');
    if (decBtn) { decrementCartItem(decBtn.dataset.dec); return; }
  });
});

window.clearCart = () => {
  if (!cart.length) return;
  const prev  = [...cart];
  const label = `Pedido limpiado (${prev.length} item${prev.length > 1 ? 's' : ''})`;
  cart = pureCleart();
  clearSavedCart();
  updateCartBadge(); renderCartDrawer(); patchGridBadges();
  if (modalData) syncModalCartBtn();
  pushUndo(prev, label);
};

// ── Drawer ────────────────────────────────────────
window.closeCart = () => {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.classList.remove('cart-open');
  document.body.style.overflow = '';
};

window.toggleCart = () => {
  const drawer = document.getElementById('cart-drawer');
  if (drawer.classList.contains('open')) { closeCart(); return; }
  drawer.classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  document.body.classList.add('cart-open');
  document.body.style.overflow = 'hidden';
  renderCartDrawer();
};

function updateCartBadge() {
  const badge    = document.getElementById('cart-badge');
  const fabBadge = document.getElementById('cart-badge-fab');
  const fab      = document.getElementById('cart-fab');
  const units    = totalUnits(cart);
  [badge, fabBadge].forEach(b => {
    if (!b) return;
    b.textContent   = units;
    b.style.display = units > 0 ? 'flex' : 'none';
  });
  if (fab) fab.classList.toggle('has-items', units > 0);
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = '$' + calcTotal(cart) + ' MXN';
}

function renderCartDrawer() {
  const list  = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const foot  = document.getElementById('cart-footer');
  const body  = document.querySelector('.cart-body');

  if (!cart.length) {
    list.innerHTML      = '';
    empty.style.display = 'flex';
    foot.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  foot.style.display  = 'flex';

  list.innerHTML = cart.map(item => `
    <div class="cart-item" data-key="${item.key}">
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
      <div class="cart-item-controls">
        <button class="cart-qty-btn ${item.qty === 1 ? 'is-trash' : ''}" data-dec="${item.key}"
          aria-label="${item.qty === 1 ? 'Eliminar item' : 'Quitar uno'}">
          ${item.qty === 1 ? '<i class="bi bi-trash"></i>' : '−'}
        </button>
        <span class="cart-qty-num" data-key="${item.key}">${item.qty}</span>
        <button class="cart-qty-btn" data-inc="${item.key}" aria-label="Agregar uno"
          ${item.qty >= MAX_QTY ? 'disabled' : ''}>+</button>
      </div>
    </div>`).join('');

  document.getElementById('cart-total').textContent = '$' + calcTotal(cart) + ' MXN';
  if (body) body.scrollTop = 0;
}

window.sendCartWA = () => {
  const url = buildWhatsAppURL(cart, '526648162623');
  if (url) { clearSavedCart(); window.open(url, '_blank'); }
};

function flashPills() {
  const pills = document.getElementById('modal-pills');
  pills.classList.add('flash');
  setTimeout(() => pills.classList.remove('flash'), 600);
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

load();
