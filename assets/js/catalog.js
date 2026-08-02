import { db, auth, collection, getDocs, query, where, onAuthStateChanged, doc, updateDoc, increment }
  from './firebase-config.js';
import { addItem, decrementItem, removeItem, clearCart as pureCleart,
         calcTotal, totalUnits, buildWhatsAppURL, getItemQty, MAX_QTY,
         saveCart, loadCart, clearSavedCart, cartExpiresInMinutes }
  from './cart.js';
import { perfumeURL, perfumeFullURL, getSlugFromHash, findBySlug } from './slug.js';
import { imgCard, imgModal, imgCart, imgOg } from './cloudinary.js';

// ── Tipos fijos (chips del panel — mapean al campo `categoria` del perfume) ─
const TIPOS_PERMITIDOS = [
  { nombre: 'Diseñador', emoji: '<i class="bi bi-person-badge"></i>' },
  { nombre: 'Árabe',     emoji: '<i class="bi bi-moon-stars"></i>' },
  { nombre: 'Nicho',     emoji: '<i class="bi bi-gem"></i>' },
];

// ── Auth ───────────────────────────────────────────────
const adminBtn = document.getElementById('btn-admin');
onAuthStateChanged(auth, user => {
  if (adminBtn) adminBtn.href = user ? './admin/dashboard.html' : './login.html';
  const lbl = document.getElementById('btn-admin-label');
  if (lbl) lbl.textContent = user ? 'Dashboard' : 'Admin';
});

// ── Estado global ────────────────────────────────────────────
const PAGE_SIZE = 10;
let all = [], gF = '', modalData = null;
let currentPage = 1, filtered = [];
let cart = loadCart();

// Filtros avanzados
let activeFilters = {
  familias: [],
  tipos: [],   // filtra por p.categoria
  marcas: []
};

// ── Undo stack ────────────────────────────────────────────
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
  showToast('Acción deshecha');
};

// ── Helpers ───────────────────────────────────────────────
function minPrecio(p) {
  const vals = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
  if (vals.length) return Math.min(...vals);
  return Number(p.precio) || 9999;
}

window.syncMobileSearch = () => {
  const qEl = document.getElementById('q');
  const mEl = document.getElementById('q-mobile');
  if (qEl && mEl) qEl.value = mEl.value;
  renderGrid();
};

// ── Meta tags OG dinámicos ──────────────────────────────────
function setMetaTags({ title, description, image, url }) {
  document.title = title;
  const og = (prop, val) => { let el = document.querySelector(`meta[property="${prop}"]`); if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); } el.setAttribute('content', val); };
  const nm = (name, val) => { let el = document.querySelector(`meta[name="${name}"]`); if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); } el.setAttribute('content', val); };
  og('og:title',       title);
  og('og:description', description);
  og('og:image',       image || '');
  og('og:url',         url || window.location.href);
  og('og:type',        'product');
  nm('description',    description);
}

function resetMetaTags() {
  document.title = 'Fitoscents · Decants';
  setMetaTags({
    title:       'Fitoscents · Decants',
    description: 'Decants 100% originales de perfumes de diseñador desde 2ml. Tijuana, B.C.',
    image:       '',
    url:         window.location.origin + window.location.pathname
  });
}

// ── Skeletons ───────────────────────────────────────────────
function showSkeletons() {
  const g = document.getElementById('grid');
  if (g) g.innerHTML = Array(8).fill(`
    <div class="skel-card">
      <div class="skel-img skel"></div>
      <div class="skel-body">
        <div class="skel-line skel" style="width:45%"></div>
        <div class="skel-line skel" style="width:70%"></div>
        <div class="skel-line skel" style="width:55%"></div>
      </div>
    </div>`).join('');
}

// ── Load data ───────────────────────────────────────────────
async function load() {
  showSkeletons();

  const [perfSnap, famSnap, paqSnap, accSnap] = await Promise.all([
    getDocs(query(collection(db, 'perfumes'), where('activo', '==', true))),
    getDocs(collection(db, 'familias_olfativas')),
    getDocs(query(collection(db, 'paquetes'), where('activo', '==', true))),
    getDocs(query(collection(db, 'accesorios'), where('activo', '==', true)))
  ]);

  all = [];
  perfSnap.forEach(d => all.push({ id: d.id, ...d.data() }));
  paqSnap.forEach(d => all.push({ id: d.id, tipo: 'paquete', ...d.data() }));
  accSnap.forEach(d => all.push({ id: d.id, tipo: 'accesorio', marca: 'Accesorios', isAccesorio: true, ...d.data() }));

  // Tipos: los 3 fijos — se usan para filtrar por p.categoria
  const tiposData = TIPOS_PERMITIDOS;

  // Familias: solo las que tienen al menos 1 perfume activo
  const famUsadas = new Set(all.map(p => p.familia).filter(Boolean));
  let famData = [];
  famSnap.forEach(d => famData.push({ id: d.id, ...d.data() }));
  famData.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre));
  famData = famData.filter(f => famUsadas.has(f.nombre));

  buildFilterPanelDynamic(tiposData, famData);

  const params = new URLSearchParams(window.location.search);
  
  const gParam = params.get('genero') || params.get('tab');
  if (gParam) {
    const searchG = gParam.toLowerCase() === 'paquetes' ? 'paquete' : gParam.toLowerCase();
    const btn = Array.from(document.querySelectorAll('.ftab')).find(b => 
      (b.dataset.g || '').toLowerCase() === searchG
    );
    if (btn) {
      document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gF = btn.dataset.g || '';
    }
  }

  const fParam = params.get('f'); if (fParam) activeFilters.familias = fParam.split(',');
  const tParam = params.get('t'); if (tParam) activeFilters.tipos = tParam.split(',');
  const mParam = params.get('m'); if (mParam) activeFilters.marcas = mParam.split(',');
  
  document.querySelectorAll('.fcheck').forEach(chk => {
    const group = chk.dataset.group;
    if (activeFilters[group] && activeFilters[group].includes(chk.value)) {
      chk.checked = true;
    }
  });

  const qParam = params.get('q');
  if (qParam) {
    const qEl = document.getElementById('q');
    const qmEl = document.getElementById('q-mobile');
    if (qEl) qEl.value = qParam;
    if (qmEl) qmEl.value = qParam;
  }

  const sParam = params.get('orden');
  if (sParam) {
    const sortEl = document.getElementById('sort');
    if (sortEl) sortEl.value = sParam;
  }
  
  updateFilterBtnBadge();

  renderGrid();
  if (cart.length) {
    const mins = cartExpiresInMinutes();
    showToast(`Pedido restaurado (${cart.length} item${cart.length > 1 ? 's' : ''})${mins ? ` · expira en ${mins} min` : ''}`);
    updateCartBadge();
  }

  const slug = getSlugFromHash();
  if (slug) {
    const p = findBySlug(all, slug);
    if (p) openModal(p.id, false);
    else window.location.hash = '';
  }
}

// ── Poblar los 3 paneles dinámicos ────────────────────────────────
function buildFilterPanelDynamic(tiposData, famData) {
  // — Tipos de perfume (Diseñador / Árabe / Nicho → filtran por p.categoria)
  const tiposContainer = document.getElementById('filter-tipos-list');
  if (tiposContainer) {
    tiposContainer.innerHTML = tiposData.map(t =>
      `<label class="fcheck-label">
        <input type="checkbox" class="fcheck" data-group="tipos" value="${t.nombre}" onchange="onFilterChange()">
        <span>${t.emoji ? t.emoji + ' ' : ''}${t.nombre}</span>
      </label>`
    ).join('');
  }

  // — Familias olfativas (desde Firestore, solo las usadas en perfumes activos)
  const famContainer = document.getElementById('filter-familias-list');
  if (famContainer) {
    if (famData.length) {
      famContainer.innerHTML = famData.map(f =>
        `<label class="fcheck-label">
          <input type="checkbox" class="fcheck" data-group="familias" value="${f.nombre}" onchange="onFilterChange()">
          <span>${f.emoji ? f.emoji + ' ' : ''}${f.nombre}</span>
        </label>`
      ).join('');
    } else {
      famContainer.innerHTML = '<span style="font-size:12px;color:#555">Sin familias registradas</span>';
    }
  }

  // — Marcas (extraídas de los perfumes activos cargados)
  const marcasSet = new Set();
  all.forEach(p => { if (p.marca) marcasSet.add(p.marca.trim()); });
  const marcasContainer = document.getElementById('filter-marcas-list');
  if (marcasContainer) {
    const sorted = [...marcasSet].sort();
    marcasContainer.innerHTML = sorted.map(m =>
      `<label class="fcheck-label">
        <input type="checkbox" class="fcheck" data-group="marcas" value="${m}" onchange="onFilterChange()">
        <span>${m}</span>
      </label>`
    ).join('');
  }
}

// ── Panel filtros hamburguesa ─────────────────────────────────
window.toggleFilterPanel = () => {
  const panel   = document.getElementById('filter-panel');
  const overlay = document.getElementById('filter-overlay');
  const isOpen  = panel && panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('filters-open');
  } else {
    panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.classList.add('filters-open');
  }
  updateFilterBtnBadge();
};

window.closeFilterPanel = () => {
  const panel   = document.getElementById('filter-panel');
  const overlay = document.getElementById('filter-overlay');
  if (panel)   panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('filters-open');
};

window.onFilterChange = () => {
  activeFilters.familias = getChecked('familias');
  activeFilters.tipos    = getChecked('tipos');
  activeFilters.marcas   = getChecked('marcas');
  updateFilterBtnBadge();
  renderGrid();
};

function getChecked(group) {
  return [...document.querySelectorAll(`.fcheck[data-group="${group}"]:checked`)].map(el => el.value);
}

function updateFilterBtnBadge() {
  const total = activeFilters.familias.length + activeFilters.tipos.length + activeFilters.marcas.length;
  const badge = document.getElementById('filter-btn-badge');
  if (!badge) return;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

window.clearAllFilters = () => {
  document.querySelectorAll('.fcheck').forEach(el => el.checked = false);
  activeFilters = { familias: [], tipos: [], marcas: [] };
  const qEl = document.getElementById('q');
  const qmEl = document.getElementById('q-mobile');
  const sEl = document.getElementById('sort');
  if (qEl) qEl.value = '';
  if (qmEl) qmEl.value = '';
  if (sEl) sEl.value = 'relevancia';
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  const firstTab = document.querySelector('.ftab');
  if (firstTab) firstTab.classList.add('active');
  gF = '';
  updateFilterBtnBadge();
  renderGrid();
};

window.addEventListener('hashchange', () => {
  const slug = getSlugFromHash();
  const modal = document.getElementById('modal');
  if (slug) {
    const p = findBySlug(all, slug);
    if (p && (!modal || !modal.classList.contains('open'))) openModal(p.id, false);
  } else {
    if (modal && modal.classList.contains('open')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      modalData = null;
      resetMetaTags();
    }
  }
});

function calcSavings(paquete, size) {
  if (paquete.tipo !== 'paquete' || !paquete.items || paquete.items.length === 0) return { saving: 0, original: 0 };
  const pkgPrice = paquete.precios && paquete.precios[size] ? paquete.precios[size] : (paquete.ml == size ? paquete.precio : 0);
  if (!pkgPrice) return { saving: 0, original: 0 };
  
  let itemPrices = [];
  for (const item of paquete.items) {
    const perfume = all.find(x => x.id === item.id);
    if (perfume && perfume.precios && perfume.precios[size]) {
      itemPrices.push(Number(perfume.precios[size]));
    }
  }
  
  const requiredCount = paquete.esPersonalizable ? (paquete.maxSeleccion || 3) : paquete.items.length;
  if (itemPrices.length < requiredCount) return { saving: 0, original: 0 };
  
  // Sort descending to show best possible saving from the pool
  itemPrices.sort((a,b) => b - a);
  let totalIndiv = itemPrices.slice(0, requiredCount).reduce((a,b) => a + b, 0);

  return {
    saving: totalIndiv > pkgPrice ? totalIndiv - pkgPrice : 0,
    original: totalIndiv > pkgPrice ? totalIndiv : 0
  };
}

function cardHTML(p) {
  let pills = '';
  let savingsTag = '';
  const pr = p.precios || (p.ml && p.precio ? { [p.ml]: p.precio } : {});
  const sizes = Object.entries(pr).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);

  if (p.tipo === 'paquete') {
    pills = sizes.map(([k, v]) => {
      const sv = calcSavings(p, k);
      const cross = sv.original > 0 ? `<del style="opacity:0.6;font-size:0.85em;margin-right:4px;">$${sv.original}</del>` : '';
      return `<div class="cpill" style="border-color:var(--gold-b); background:var(--gold-s); color:var(--gold);">${k}ml — ${cross}$${v}</div>`;
    }).join('');
    if (sizes.length > 0) {
      const minSize = sizes[0][0];
      const sv = calcSavings(p, minSize);
      if (sv.saving > 0) {
        savingsTag = `<div class="savings-tag">Ahorras $${sv.saving}</div>`;
      }
    }
  } else {
    pills = sizes.map(([k, v]) => `<div class="cpill">${k}ml — $${v}</div>`).join('');
  }
  
  const units = cart.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0);
  // ─ imgCard: 400x400, WebP automático, q_auto:good ─
  const src = imgCard(p.imagen);
  return `<div class="pcard ${p.tipo === 'paquete' ? 'pcard-paquete' : ''}" onclick="openModal('${p.id}')" data-id="${p.id}" ${p.tipo === 'paquete' ? 'style="border:1px solid var(--gold-b); box-shadow:0 4px 20px rgba(201,168,76,0.1);"' : ''}>
    <div class="card-img">
      ${p.tipo === 'paquete' ? `<div style="position:absolute;top:8px;left:8px;background:var(--gold-s);border:1px solid var(--gold-b);color:var(--gold);padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;z-index:2;display:flex;align-items:center;gap:4px;"><i class="bi bi-box2-heart-fill"></i> PAQUETE</div>` : ''}
      ${savingsTag}
      ${src
        ? `<img src="${src}" alt="${p.nombre}" loading="lazy" width="400" height="400" decoding="async">`
        : `<div class="card-no-img"><i class="bi ${p.tipo === 'paquete' ? 'bi-box2-heart' : (p.tipo === 'accesorio' ? 'bi-bag' : 'bi-droplet')}"></i></div>`}
      ${units > 0 ? `<div class="card-in-cart"><i class="bi bi-bag-check-fill"></i>${units > 1 ? ` <span>${units}</span>` : ''}</div>` : ''}
    </div>
    <div class="card-body">
      <div class="card-marca" style="${p.tipo === 'paquete' ? 'color:var(--gold);' : ''}">${p.marca || (p.tipo === 'paquete' ? 'Combos Fitoscents' : '')}</div>
      <div class="card-nombre">${p.nombre}</div>
      <div class="card-pills">${pills || '<span style="font-size:12px;color:#444">Sin precios</span>'}</div>
    </div>
  </div>`;
}

// ── Render grid ───────────────────────────────────────────────
import { matchSearch } from './search-engine.js';

window.renderGrid = () => {
  currentPage = 1;
  const qEl   = document.getElementById('q');
  const sEl   = document.getElementById('sort');
  const q     = qEl ? qEl.value.toLowerCase().trim() : '';
  const sort  = sEl ? sEl.value : 'relevancia';
  const sm = document.getElementById('sort-mobile');
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (sm && sm.value !== sort) sm.value = sort;

  filtered = all.filter(p => {
    if (q && !matchSearch(q, p.nombre + ' ' + (p.marca || ''))) return false;
    
    // Custom filter for Paquete vs Genero
    if (gF) {
      if (gF === 'Paquete') {
        if (p.tipo !== 'paquete') return false;
      } else {
        if (p.tipo === 'paquete') {
          // Paquetes might have a category they belong to or they might be mixed
          if (p.categoria && p.categoria !== '' && p.categoria !== gF) return false;
        } else {
          if (p.genero !== gF) return false;
        }
      }
    } else {
      // If no gender filter is active, maybe show all, or hide packages? We show all.
    }

    if (activeFilters.familias.length && !activeFilters.familias.includes(p.familia)) return false;
    if (activeFilters.tipos.length && !activeFilters.tipos.some(
      t => normalize(t) === normalize(p.categoria || '')
    )) return false;
    if (activeFilters.marcas.length && !activeFilters.marcas.includes(p.marca)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === 'relevancia')  return (b.clicks || 0) - (a.clicks || 0);
    if (sort === 'recientes')   return (b.creadoEn || 0) - (a.creadoEn || 0);
    if (sort === 'antiguos')    return (a.creadoEn || 0) - (b.creadoEn || 0);
    if (sort === 'az')          return a.nombre.localeCompare(b.nombre);
    if (sort === 'za')          return b.nombre.localeCompare(a.nombre);
    if (sort === 'marca')       return (a.marca || '').localeCompare(b.marca || '');
    const pa = minPrecio(a), pb = minPrecio(b);
    if (sort === 'precio_asc')  return pa - pb;
    if (sort === 'precio_desc') return pb - pa;
    return 0;
  });

  const badge = document.getElementById('count-badge');
  if (badge) badge.textContent = filtered.length + ' perfume' + (filtered.length !== 1 ? 's' : '');

  const g = document.getElementById('grid');
  if (!g) return;
  if (!filtered.length) {
    g.innerHTML = `<div class="empty-state"><i class="bi bi-search"></i><h3>Sin resultados</h3><p style="font-size:13px;color:#555">Intenta con otro nombre o quita los filtros.</p></div>`;
    updateLoadMore(); return;
  }
  g.innerHTML = filtered.slice(0, PAGE_SIZE).map(cardHTML).join('');
  updateLoadMore();
  syncFiltersToURL();
};

function syncFiltersToURL() {
  const url = new URL(window.location);
  
  if (gF) {
    const targetG = gF === 'Paquete' ? 'paquetes' : gF.toLowerCase();
    url.searchParams.set('genero', targetG);
  } else {
    url.searchParams.delete('genero');
  }
  url.searchParams.delete('tab'); // Clean up old 'tab' parameter

  if (activeFilters.familias.length) url.searchParams.set('f', activeFilters.familias.join(','));
  else url.searchParams.delete('f');
  
  if (activeFilters.tipos.length) url.searchParams.set('t', activeFilters.tipos.join(','));
  else url.searchParams.delete('t');
  
  if (activeFilters.marcas.length) url.searchParams.set('m', activeFilters.marcas.join(','));
  else url.searchParams.delete('m');
  
  const qEl = document.getElementById('q');
  const sortEl = document.getElementById('sort');
  
  if (qEl && qEl.value.trim()) url.searchParams.set('q', qEl.value.trim());
  else url.searchParams.delete('q');
  
  if (sortEl && sortEl.value !== 'relevancia') url.searchParams.set('orden', sortEl.value);
  else url.searchParams.delete('orden');
  
  window.history.replaceState({}, '', url);
}

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
    } else { if (badge) badge.remove(); }
  });
}

function checkCartTTL() {
  if (cart.length > 0 && loadCart().length === 0) {
    cart = [];
    showToast('Tu carrito anterior expiró por inactividad');
  }
}

function persistCart() {
  if (cart.length) saveCart(cart);
  else clearSavedCart();
}

window.addEventListener('storage', (e) => {
  if (e.key === 'decants_cart') {
    cart = loadCart();
    updateCartBadge();
    if (document.getElementById('cart-drawer')?.classList.contains('open')) {
      renderCartDrawer();
    }
    patchGridBadges();
    syncModalCartBtn();
  }
});

window.loadMore = () => {
  currentPage++;
  const chunk = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const g = document.getElementById('grid');
  if (!g) return;
  chunk.forEach(p => { const d = document.createElement('div'); d.innerHTML = cardHTML(p); g.appendChild(d.firstElementChild); });
  updateLoadMore();
};

function updateLoadMore() {
  const shown = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const wrap  = document.getElementById('load-more-wrap');
  const info  = document.getElementById('load-more-info');
  if (!wrap) return;
  if (filtered.length > PAGE_SIZE && shown < filtered.length) {
    wrap.style.display = 'flex';
    if (info) info.textContent = `Mostrando ${shown} de ${filtered.length}`;
  } else { wrap.style.display = 'none'; }
}

window.setG = btn => {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); gF = btn.dataset.g || '';
  renderGrid();
};

window.clearFilters = () => { clearAllFilters(); };

// ── Modal ───────────────────────────────────────────────
window.openModal = (id, pushHash = true) => {
  const p = all.find(x => x.id === id);
  if (!p) return;
  modalData = p;
  const colName = p.tipo === 'paquete' ? 'paquetes' : 'perfumes';
  updateDoc(doc(db, colName, id), { clicks: increment(1) }).catch(() => {});

  if (pushHash) window.location.hash = '/perfumes/' + perfumeURL(p).replace('#/perfumes/', '');
  const precio = minPrecio(p);

  // ─ imgOg: 1200x630 para Open Graph / compartir en redes ─
  setMetaTags({
    title:       `${p.nombre}${p.marca ? ' · ' + p.marca : ''} — Fitoscents`,
    description: `Decant original de ${p.nombre}${p.marca ? ' de ' + p.marca : ''} desde $${precio} MXN. ${p.descripcion || ''}`.trim(),
    image:       imgOg(p.imagen) || '',
    url:         perfumeFullURL(p)
  });

  // ─ imgModal: 800x800, q_auto:best para el detalle ─
  const modalSrc = imgModal(p.imagen);
  document.getElementById('modal-img').innerHTML = modalSrc
    ? `<img src="${modalSrc}" alt="${p.nombre}" width="800" height="800" decoding="async">`
    : `<div class="modal-img-placeholder"><i class="bi ${p.tipo === 'paquete' ? 'bi-box2-heart' : (p.tipo === 'accesorio' ? 'bi-bag' : 'bi-droplet')}"></i></div>`;
  document.getElementById('modal-nombre').textContent = p.nombre;
  document.getElementById('modal-marca').textContent  = p.marca || '';
  document.getElementById('modal-desc').textContent   = p.descripcion || 'Sin descripción disponible.';

  window.customPackageSelections = [];

  const pqItemsEl = document.getElementById('modal-paquete-items');
  if (p.tipo === 'paquete' && p.items && p.items.length) {
    if (p.esPersonalizable) {
      pqItemsEl.innerHTML = `
        <div style="margin-top:10px; margin-bottom:8px; font-size:11px; font-weight:600; color:var(--gold); text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between;">
          <span>Arma tu paquete (Elige ${p.maxSeleccion || 3}):</span>
          <span id="custom-pkg-count">0 / ${p.maxSeleccion || 3}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${p.items.map(i => `
            <label class="custom-pkg-label" style="cursor:pointer; display:flex; align-items:center; gap:12px; background:var(--bg-card2); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); transition:background 0.2s;">
              <input type="checkbox" class="custom-pkg-chk" value="${i.id}" data-name="${i.nombre}" onchange="toggleCustomPkgItem(this, ${p.maxSeleccion || 3})" style="width:18px;height:18px;accent-color:var(--gold);">
              <div style="width:40px; height:40px; border-radius:6px; overflow:hidden; background:var(--bg-card); flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.2);" onclick="event.preventDefault(); window.showZoom('${i.imagen || ''}')">
                ${i.imagen ? `<img src="${imgCart(i.imagen)}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="bi bi-droplet" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-faint);font-size:16px;"></i>'}
              </div>
              <div style="flex:1;">
                <div style="font-weight:600; font-size:13.5px; color:var(--text); line-height:1.2;">${i.nombre}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${i.marca || ''}</div>
              </div>
            </label>
          `).join('')}
        </div>
      `;
    } else {
      pqItemsEl.innerHTML = `
        <div style="margin-top:10px; margin-bottom:8px; font-size:11px; font-weight:600; color:var(--gold); text-transform:uppercase; letter-spacing:1px;">Perfumes incluidos en el paquete:</div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${p.items.map(i => `
            <div onclick="window.showZoom('${i.imagen || ''}')" title="Ver imagen" style="cursor:pointer; display:flex; align-items:center; gap:12px; background:var(--bg-card2); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); transition:background 0.2s, transform 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.transform='scale(1.01)';" onmouseout="this.style.background='var(--bg-card2)'; this.style.transform='scale(1)';">
              <div style="width:40px; height:40px; border-radius:6px; overflow:hidden; background:var(--bg-card); flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.2);">
                ${i.imagen ? `<img src="${imgCart(i.imagen)}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="bi bi-droplet" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-faint);font-size:16px;"></i>'}
              </div>
              <div style="flex:1;">
                <div style="font-weight:600; font-size:13.5px; color:var(--text); line-height:1.2;">${i.nombre}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${i.marca || ''}</div>
              </div>
              <i class="bi bi-zoom-in" style="color:var(--text-faint); font-size:16px;"></i>
            </div>
          `).join('')}
        </div>
      `;
    }
    pqItemsEl.style.display = 'block';
  } else {
    if (pqItemsEl) pqItemsEl.style.display = 'none';
  }

  const pr = p.precios || (p.ml && p.precio ? { [p.ml]: p.precio } : {});
  const sizes = Object.entries(pr).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);

  const sizesLabel = document.querySelector('.modal-sizes-label');
  if (sizesLabel) {
    sizesLabel.style.display = sizes.length <= 1 ? 'none' : 'block';
  }

  let pillsHTML = '';
  if (p.tipo === 'paquete') {
    pillsHTML = sizes.length
      ? sizes.map(([k, v], i) => {
          const sv = calcSavings(p, k);
          const savingHtml = sv.saving > 0 ? `<div class="pill-saving" style="font-size:11px;color:#000;background:var(--gold);padding:2px 6px;border-radius:4px;font-weight:700;">Ahorras $${sv.saving}</div>` : '';
          const crossHtml = sv.original > 0 ? `<del style="opacity:0.6;font-size:0.85em;margin-right:4px;">$${sv.original}</del>` : '';
          return `<button class="mpill ${i===0?'sel':''}" data-size="Paquete ${k}" data-price="${v}" onclick="selPill(this)" style="display:flex; align-items:center; gap:8px;">${crossHtml}$${v} MXN (${k}ml)${savingHtml}</button>`;
        }).join('')
      : '<span style="font-size:13px;color:#555">Sin presentaciones disponibles.</span>';
  } else {
    pillsHTML = sizes.length
      ? sizes.map(([k, v], i) => `<button class="mpill ${i===0?'sel':''}" data-size="${k}" data-price="${v}" onclick="selPill(this)">${k}ml — $${v}</button>`).join('')
      : '<span style="font-size:13px;color:#555">Sin presentaciones disponibles.</span>';
  }
  const pillsEl = document.getElementById('modal-pills');
  pillsEl.innerHTML = pillsHTML;
  
  if (p.tipo === 'paquete' && p.esPersonalizable) {
    // Disable pills initially
    document.querySelectorAll('.mpill').forEach(el => {
      el.disabled = true;
      el.style.opacity = '0.5';
      el.style.cursor = 'not-allowed';
    });
  }

  syncModalCartBtn();
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.toggleCustomPkgItem = (chk, maxSel) => {
  if (chk.checked) {
    if (window.customPackageSelections.length >= maxSel) {
      chk.checked = false;
      showToast(`Solo puedes elegir ${maxSel} perfumes`, 'warning');
      return;
    }
    window.customPackageSelections.push({ id: chk.value, nombre: chk.dataset.name });
  } else {
    window.customPackageSelections = window.customPackageSelections.filter(x => x.id !== chk.value);
  }
  
  const countEl = document.getElementById('custom-pkg-count');
  if (countEl) countEl.textContent = `${window.customPackageSelections.length} / ${maxSel}`;
  
  const maxReached = window.customPackageSelections.length >= maxSel;
  document.querySelectorAll('.custom-pkg-chk').forEach(el => {
    if (!el.checked) el.disabled = maxReached;
    const lbl = el.closest('label');
    if (lbl) lbl.style.opacity = (maxReached && !el.checked) ? '0.5' : '1';
  });
  
  document.querySelectorAll('.mpill').forEach(el => {
    el.disabled = !maxReached;
    el.style.opacity = maxReached ? '1' : '0.5';
    el.style.cursor = maxReached ? 'pointer' : 'not-allowed';
  });
  
  syncModalCartBtn();
};

function syncModalCartBtn() {
  if (!modalData) return;
  const sel     = document.querySelector('.mpill.sel');
  const wrapper = document.getElementById('modal-cart-wrapper');
  if (!wrapper) return;
  
  if (modalData.tipo === 'paquete' && modalData.esPersonalizable) {
    if (window.customPackageSelections.length < (modalData.maxSeleccion || 3)) {
      wrapper.innerHTML = `<button class="btn-add-cart" disabled style="opacity:0.5; cursor:not-allowed;"><i class="bi bi-bag-plus"></i> Selecciona ${modalData.maxSeleccion || 3} perfumes</button>`;
      return;
    }
  }
  
  if (!sel) {
    wrapper.innerHTML = `<button class="btn-add-cart" onclick="addToCart()"><i class="bi bi-bag-plus"></i> Agregar al pedido</button>`;
    return;
  }
  
  let key = modalData.id + '-' + sel.dataset.size;
  if (modalData.tipo === 'paquete' && modalData.esPersonalizable) {
    key += '-' + window.customPackageSelections.map(x => x.id).sort().join(',');
  }
  const qty = getItemQty(cart, key);
  if (qty === 0) {
    wrapper.innerHTML = `<button class="btn-add-cart" onclick="addToCart()"><i class="bi bi-bag-plus"></i> Agregar al pedido</button>`;
  } else if (qty >= MAX_QTY) {
    wrapper.innerHTML = `<div class="modal-qty-controls"><button class="mqty-btn" onclick="modalDecrement()">−</button><span class="mqty-num">${qty}</span><button class="mqty-btn" disabled>+</button></div>`;
  } else {
    wrapper.innerHTML = `<div class="modal-qty-controls"><button class="mqty-btn" onclick="modalDecrement()">−</button><span class="mqty-num">${qty}</span><button class="mqty-btn" onclick="modalIncrement()">+</button></div>`;
  }
}

window.showZoom = (imgUrl) => {
  if (!imgUrl) return;
  let zoomEl = document.getElementById('zoom-overlay');
  if (!zoomEl) {
    zoomEl = document.createElement('div');
    zoomEl.id = 'zoom-overlay';
    zoomEl.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.2s; padding:20px;';
    zoomEl.onclick = () => {
      zoomEl.style.opacity = '0';
      const img = document.getElementById('zoom-img');
      if (img) img.style.transform = 'scale(0.9)';
      setTimeout(() => { zoomEl.style.pointerEvents = 'none'; }, 200);
    };
    
    const imgEl = document.createElement('img');
    imgEl.id = 'zoom-img';
    imgEl.style.cssText = 'max-width:100%; max-height:90vh; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.5); transform:scale(0.9); transition:transform 0.2s;';
    zoomEl.appendChild(imgEl);
    
    document.body.appendChild(zoomEl);
  }
  
  const imgEl = document.getElementById('zoom-img');
  imgEl.src = imgModal(imgUrl);
  
  zoomEl.style.pointerEvents = 'all';
  setTimeout(() => {
    zoomEl.style.opacity = '1';
    imgEl.style.transform = 'scale(1)';
  }, 10);
};

window.modalIncrement = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  if (!sel) return;
  checkCartTTL();
  let key = modalData.id + '-' + sel.dataset.size;
  if (modalData.tipo === 'paquete' && modalData.esPersonalizable && window.customPackageSelections) {
    key += '-' + window.customPackageSelections.map(x => x.id).sort().join(',');
  }
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
  checkCartTTL();
  let key = modalData.id + '-' + sel.dataset.size;
  if (modalData.tipo === 'paquete' && modalData.esPersonalizable && window.customPackageSelections) {
    key += '-' + window.customPackageSelections.map(x => x.id).sort().join(',');
  }
  const item = cart.find(i => i.key === key);
  if (!item) return;
  if (item.qty === 1) {
    const prev = [...cart], label = `${item.nombre} ${item.size}ml eliminado`;
    cart = removeItem(cart, key); persistCart(); pushUndo(prev, label);
  } else { cart = decrementItem(cart, key); persistCart(); }
  syncModalCartBtn(); updateCartBadge(); patchGridBadges();
};

window.selPill = btn => {
  document.querySelectorAll('.mpill').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel'); syncModalCartBtn();
};

function doCloseModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  modalData = null;
  history.pushState(null, '', window.location.pathname + window.location.search);
  resetMetaTags();
}

window.closeModal = e => {
  if (e && e.target !== document.getElementById('modal')) return;
  doCloseModal();
};
window.doCloseModal = doCloseModal;

document.addEventListener('keydown', e => { if (e.key === 'Escape') doCloseModal(); });

window.pedirModal = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  const url = perfumeFullURL(modalData);
  const marcaStr = modalData.tipo === 'paquete' ? 'Combos Fitoscents' : (modalData.marca || '');
  const title = marcaStr ? `*${marcaStr} - ${modalData.nombre}*` : `*${modalData.nombre}*`;
  
  const msg = sel
    ? `Hola! Me interesa:\n${title}\nTamaño: ${sel.dataset.size}${modalData.tipo === 'paquete' ? '' : 'ml'}\nPrecio: $${sel.dataset.price} MXN\n${url}`
    : `Hola! Me interesa:\n${title}\n${url}`;
  window.open(`https://wa.me/526648162623?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── CARRITO ───────────────────────────────────────────────
window.addToCart = () => {
  if (!modalData) return;
  const sel = document.querySelector('.mpill.sel');
  if (!sel) { flashPills(); return; }
  checkCartTTL();
  if (modalData.tipo === 'paquete' && modalData.esPersonalizable) {
    if (window.customPackageSelections.length < (modalData.maxSeleccion || 3)) {
      showToast(`Selecciona ${modalData.maxSeleccion || 3} perfumes primero`, 'warning');
      return;
    }
  }

  let key = modalData.id + '-' + sel.dataset.size;
  let customItems = null;
  if (modalData.tipo === 'paquete' && modalData.esPersonalizable) {
    key += '-' + window.customPackageSelections.map(x => x.id).sort().join(',');
    customItems = [...window.customPackageSelections];
  }

  const item = {
    key:    key,
    id:     modalData.id,
    nombre: modalData.nombre,
    marca:  modalData.tipo === 'paquete' ? 'Combos Fitoscents' : (modalData.marca  || ''),
    // ─ imgCart: 80x80 para el drawer, mínimo peso ─
    imagen: imgCart(modalData.imagen) || '',
    size:   sel.dataset.size,
    price:  +sel.dataset.price,
    qty:    1,
    customItems: customItems
  };
  const { cart: newCart, added, reason } = addItem(cart, item);
  if (!added) { if (reason === 'max_qty') showToast(`Máximo ${MAX_QTY} unidades por talla`); return; }
  cart = newCart; persistCart();
  showToast(`✓ ${modalData.nombre} ${sel.dataset.size}ml agregado`);
  syncModalCartBtn(); updateCartBadge(); patchGridBadges();
};

window.incrementCartItem = key => {
  checkCartTTL();
  const idx = cart.findIndex(i => i.key === key);
  if (idx === -1) return;
  if (cart[idx].qty >= MAX_QTY) { showToast(`Máximo ${MAX_QTY} unidades por talla`); return; }
  const { cart: newCart } = addItem(cart, cart[idx]);
  cart = newCart; persistCart();
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
  checkCartTTL();
  const item = cart.find(i => i.key === key);
  if (!item) return;
  if (item.qty === 1) {
    const prev = [...cart], label = `${item.nombre} ${item.size}ml eliminado`;
    cart = removeItem(cart, key); persistCart(); pushUndo(prev, label);
    updateCartBadge(); renderCartDrawer(); patchGridBadges();
    if (modalData) syncModalCartBtn(); return;
  }
  cart = decrementItem(cart, key); persistCart();
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
    decBtn.classList.add('is-trash'); decBtn.innerHTML = '<i class="bi bi-trash"></i>';
    decBtn.setAttribute('aria-label', 'Eliminar item');
  } else {
    decBtn.classList.remove('is-trash'); decBtn.innerHTML = '−';
    decBtn.setAttribute('aria-label', 'Quitar uno');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const cartList = document.getElementById('cart-list');
  if (cartList) {
    cartList.addEventListener('click', e => {
      const incBtn = e.target.closest('.cart-qty-btn[data-inc]');
      if (incBtn) { incrementCartItem(incBtn.dataset.inc); return; }
      const decBtn = e.target.closest('.cart-qty-btn[data-dec]');
      if (decBtn) { decrementCartItem(decBtn.dataset.dec); return; }
    });
  }
});

window.clearCart = () => {
  if (!cart.length) return;
  const prev  = [...cart];
  const label = `Pedido limpiado (${prev.length} item${prev.length > 1 ? 's' : ''})`;
  cart = pureCleart(); clearSavedCart();
  updateCartBadge(); renderCartDrawer(); patchGridBadges();
  if (modalData) syncModalCartBtn();
  pushUndo(prev, label);
};

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
  [badge, fabBadge].forEach(b => { if (!b) return; b.textContent = units; b.style.display = units > 0 ? 'flex' : 'none'; });
  if (fab) fab.classList.toggle('has-items', units > 0);
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = '$' + calcTotal(cart) + ' MXN';
}

function renderCartDrawer() {
  const list  = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const foot  = document.getElementById('cart-footer');
  const body  = document.querySelector('.cart-body');
  if (!list) return;
  if (!cart.length) {
    list.innerHTML = ''; if (empty) empty.style.display = 'flex'; if (foot) foot.style.display = 'none'; return;
  }
  if (empty) empty.style.display = 'none'; if (foot) foot.style.display = 'flex';
  // Nota: item.imagen ya guarda la URL con transformación imgCart (80x80) aplicada al agregar
  list.innerHTML = cart.map(item => `
    <div class="cart-item" data-key="${item.key}">
      <div class="cart-item-img">
        ${item.imagen ? `<img src="${imgCart(item.imagen)}" alt="${item.nombre}" loading="lazy" width="80" height="80" decoding="async">` : '<div class="cart-item-no-img"><i class="bi bi-droplet"></i></div>'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-marca">${item.marca}</div>
        <div class="cart-item-nombre">${item.nombre}</div>
        <div class="cart-item-size">${item.size}ml — <strong>$${item.price}</strong></div>
        ${item.customItems ? `<div style="font-size:10px; color:var(--text-faint); margin-top:2px;">[${item.customItems.map(c=>c.nombre).join(', ')}]</div>` : ''}
      </div>
      <div class="cart-item-controls">
        <button class="cart-qty-btn ${item.qty === 1 ? 'is-trash' : ''}" data-dec="${item.key}" aria-label="${item.qty === 1 ? 'Eliminar item' : 'Quitar uno'}">
          ${item.qty === 1 ? '<i class="bi bi-trash"></i>' : '−'}
        </button>
        <span class="cart-qty-num" data-key="${item.key}">${item.qty}</span>
        <button class="cart-qty-btn" data-inc="${item.key}" aria-label="Agregar uno" ${item.qty >= MAX_QTY ? 'disabled' : ''}>+</button>
      </div>
    </div>`).join('');
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = '$' + calcTotal(cart) + ' MXN';
  if (body) body.scrollTop = 0;
}

window.sendCartWA = () => {
  const url = buildWhatsAppURL(cart, '526648162623');
  if (url) { clearSavedCart(); window.open(url, '_blank'); }
};

function flashPills() {
  const pills = document.getElementById('modal-pills');
  if (pills) { pills.classList.add('flash'); setTimeout(() => pills.classList.remove('flash'), 600); }
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
