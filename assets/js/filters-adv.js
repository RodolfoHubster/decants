/* ══════════════════════════════════════════════
   FILTROS AVANZADOS — Fitoscents
   Drawer hamburguesa · palomitas · chips
══════════════════════════════════════════════ */

// Estado de filtros avanzados
window._advFilters = {
  sort:   'relevancia',
  tipos:  [],   // Diseñador, Nicho, Árabe…
  scents: [],   // Amaderado, Floral…
  marcas: [],   // dinámico
  precio: [],   // '0-100','100-200','200-400','400+'
  stock:  false,
};

/* ── Abrir / cerrar drawer ── */
window.toggleFilterDrawer = () => {
  const drawer  = document.getElementById('filter-drawer');
  const overlay = document.getElementById('fadv-overlay');
  const btn     = document.getElementById('btn-filter-adv');
  const isOpen  = drawer.classList.contains('open');
  if (isOpen) { closeFilterDrawer(); }
  else {
    drawer.classList.add('open');
    overlay.classList.add('open');
    btn.setAttribute('aria-expanded','true');
    btn.classList.add('active');
    document.body.style.overflow = 'hidden';
    buildMarcaList();  // reconstruir lista de marcas
    updateResultCount();
  }
};

window.closeFilterDrawer = () => {
  document.getElementById('filter-drawer').classList.remove('open');
  document.getElementById('fadv-overlay').classList.remove('open');
  const btn = document.getElementById('btn-filter-adv');
  if (btn) { btn.setAttribute('aria-expanded','false'); btn.classList.remove('active'); }
  document.body.style.overflow = '';
};

/* ── Cerrar con ESC ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const drawer = document.getElementById('filter-drawer');
    if (drawer && drawer.classList.contains('open')) closeFilterDrawer();
  }
});

/* ── Ordenar ── */
window.setSort = (btn) => {
  document.querySelectorAll('#fadv-sort .fadv-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._advFilters.sort = btn.dataset.sort;
  // Sync con el select oculto que usa catalog.js
  const sel = document.getElementById('sort');
  if (sel) { sel.value = btn.dataset.sort; }
  updateBadge();
  updateResultCount();
  if (typeof renderGrid === 'function') renderGrid();
};

/* ── Aplicar checkboxes (tipos, scents, precio, stock) ── */
window.applyFilters = () => {
  window._advFilters.tipos  = getChecked('#fadv-tipo');
  window._advFilters.scents = getChecked('#fadv-scent');
  window._advFilters.precio = getChecked('#fadv-precio');
  window._advFilters.stock  = document.getElementById('fadv-stock')?.checked || false;
  updateBadge();
  updateResultCount();
  if (typeof renderGrid === 'function') renderGrid();
  renderActiveChips();
};

function getChecked(selector) {
  return Array.from(document.querySelectorAll(`${selector} input[type="checkbox"]:checked`)).map(el => el.value);
}

/* ── Marcas dinámicas ── */
function buildMarcaList() {
  const all = window._allPerfumes || [];
  const marcas = [...new Set(all.map(p => p.marca).filter(Boolean))].sort();
  const container = document.getElementById('fadv-marcas');
  if (!container) return;
  const q = (document.getElementById('marca-search')?.value || '').toLowerCase();
  const filtered = q ? marcas.filter(m => m.toLowerCase().includes(q)) : marcas;
  container.innerHTML = filtered.map(m => `
    <label class="fadv-check">
      <input type="checkbox" value="${m}" ${window._advFilters.marcas.includes(m) ? 'checked' : ''} onchange="onMarcaChange()">
      <span>${m}</span>
    </label>`).join('');
}

window.onMarcaChange = () => {
  window._advFilters.marcas = getChecked('#fadv-marcas');
  updateBadge();
  updateResultCount();
  if (typeof renderGrid === 'function') renderGrid();
  renderActiveChips();
};

window.filterMarcaList = () => buildMarcaList();

/* ── Conteo de filtros activos (badge) ── */
function countActive() {
  const f = window._advFilters;
  let n = f.tipos.length + f.scents.length + f.marcas.length + f.precio.length;
  if (f.stock) n++;
  if (f.sort && f.sort !== 'relevancia') n++;
  return n;
}

function updateBadge() {
  const n   = countActive();
  const cnt = document.getElementById('fad-count');
  const btn = document.getElementById('btn-filter-adv');
  if (cnt) { cnt.textContent = n; cnt.style.display = n > 0 ? 'inline' : 'none'; }
  if (btn) btn.classList.toggle('active', n > 0);
}

/* ── Contador resultado en footer drawer ── */
function updateResultCount() {
  const el = document.getElementById('fadv-result-count');
  if (!el) return;
  const all      = window._allPerfumes || [];
  const filtered = applyAdvToArray(all);
  el.textContent = `Ver ${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`;
}

/* ── Filtrado real (complementa renderGrid de catalog.js) ── */
// catalog.js llama window.getAdvFilterFn() para obtener un predicado extra
window.getAdvFilterFn = () => {
  const f = window._advFilters;
  return (p) => {
    // Tipo
    if (f.tipos.length && !f.tipos.some(t => (p.tipo || '').includes(t))) return false;
    // Familia olfativa
    if (f.scents.length && !f.scents.some(s => (p.familiaOlfativa || p.familia || '').includes(s))) return false;
    // Marca
    if (f.marcas.length && !f.marcas.includes(p.marca)) return false;
    // Precio
    if (f.precio.length) {
      const mn = minPrecioGlobal(p);
      const ok = f.precio.some(r => {
        if (r === '0-100')   return mn <= 100;
        if (r === '100-200') return mn > 100 && mn <= 200;
        if (r === '200-400') return mn > 200 && mn <= 400;
        if (r === '400+')    return mn > 400;
        return false;
      });
      if (!ok) return false;
    }
    // Stock
    if (f.stock) {
      const sizes = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
      if (!sizes.length) return false;
    }
    return true;
  };
};

function minPrecioGlobal(p) {
  const vals = Object.values(p.precios || {}).map(Number).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : 9999;
}

function applyAdvToArray(arr) {
  const fn = window.getAdvFilterFn();
  return arr.filter(fn);
}

/* ── Chips de filtros activos (bajo el header catálogo) ── */
window.renderActiveChips = () => {
  const f   = window._advFilters;
  const el  = document.getElementById('active-filters');
  if (!el) return;
  const chips = [];
  f.tipos.forEach(t  => chips.push({ label: t,           remove: () => removeCheck('#fadv-tipo',  t,  'tipos')  }));
  f.scents.forEach(s => chips.push({ label: s,           remove: () => removeCheck('#fadv-scent', s,  'scents') }));
  f.marcas.forEach(m => chips.push({ label: m,           remove: () => removeCheck('#fadv-marcas',m, 'marcas') }));
  f.precio.forEach(r => chips.push({ label: '💰 '+r,     remove: () => removeCheck('#fadv-precio',r, 'precio') }));
  if (f.stock) chips.push({ label: '✅ Stock', remove: () => { document.getElementById('fadv-stock').checked = false; window._advFilters.stock = false; applyFilters(); } });
  el.innerHTML = chips.map((c,i) =>
    `<button class="filter-chip" onclick="_removeChip(${i})" aria-label="Quitar filtro ${c.label}">${c.label} <span class="chip-x">×</span></button>`
  ).join('');
  el._chips = chips;
};

window._removeChip = (i) => {
  const el = document.getElementById('active-filters');
  if (el?._chips?.[i]) { el._chips[i].remove(); }
};

function removeCheck(selector, value, key) {
  const inp = document.querySelector(`${selector} input[value="${CSS.escape(value)}"]`);
  if (inp) inp.checked = false;
  window._advFilters[key] = window._advFilters[key].filter(v => v !== value);
  updateBadge();
  updateResultCount();
  if (typeof renderGrid === 'function') renderGrid();
  renderActiveChips();
}

/* ── Limpiar filtros avanzados ── */
window.clearAdvFilters = () => {
  window._advFilters = { sort:'relevancia', tipos:[], scents:[], marcas:[], precio:[], stock:false };
  // Reset checkboxes
  document.querySelectorAll('#filter-drawer input[type="checkbox"]').forEach(el => el.checked = false);
  // Reset sort pills
  document.querySelectorAll('#fadv-sort .fadv-opt').forEach(b => b.classList.remove('active'));
  const first = document.querySelector('#fadv-sort .fadv-opt');
  if (first) first.classList.add('active');
  // Sync select
  const sel = document.getElementById('sort'); if (sel) sel.value = 'relevancia';
  updateBadge();
  updateResultCount();
  if (typeof renderGrid === 'function') renderGrid();
  renderActiveChips();
  const cnt = document.getElementById('fadv-result-count');
  if (cnt) cnt.textContent = 'Ver resultados';
};

window.clearFilters = () => {
  // Limpiar búsqueda
  const q = document.getElementById('q'); if (q) q.value = '';
  const qm = document.getElementById('q-mobile'); if (qm) qm.value = '';
  // Limpiar género
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  const first = document.querySelector('.ftab'); if (first) first.classList.add('active');
  if (typeof window !== 'undefined') window._gF = '';
  // Limpiar avanzados
  clearAdvFilters();
};

/* ── Exponer allPerfumes para buildMarcaList ── */
// catalog.js debe llamar: window._allPerfumes = all; después de cargar Firestore
// (se añade en catalog.js con: window._allPerfumes = all;)
