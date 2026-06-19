import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, writeBatch }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('ventas');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let ventas = [], perfumes = [];

// ── Cargar datos ──────────────────────────────────────────────────────────────
async function loadAll() {
  const [vs, ps] = await Promise.all([
    getDocs(collection(db, 'ventas')),
    getDocs(collection(db, 'perfumes'))
  ]);
  perfumes = []; ps.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
  perfumes.sort((a,b) => a.nombre.localeCompare(b.nombre));
  ventas = []; vs.forEach(d => ventas.push({ id: d.id, ...d.data() }));
  ventas.sort((a,b) => (b.creadoEn||0) - (a.creadoEn||0));

  const pOpts = perfumes.map(p => `<option value="${p.id}">${p.nombre} — ${p.marca||''}</option>`).join('');
  document.getElementById('v-perfume').innerHTML = '<option value="">Selecciona perfume</option>' + pOpts;

  renderTable();
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function getFiltered() {
  const q  = document.getElementById('search').value.toLowerCase();
  const fe = document.getElementById('f-estado').value;
  const fp = document.getElementById('f-periodo').value;
  const fc = document.getElementById('f-canal').value;
  const ahora = Date.now();
  return ventas.filter(v => {
    if (fe && v.estado !== fe) return false;
    if (fc && v.canal !== fc) return false;
    if (fp) {
      const desde = fp === 'hoy' ? new Date().setHours(0,0,0,0) : ahora - (+fp)*86400000;
      if ((v.creadoEn||0) < desde) return false;
    }
    if (q && !(v.cliente||'').toLowerCase().includes(q) && !(v.perfumeNombre||'').toLowerCase().includes(q)) return false;
    return true;
  });
}

function updateKPIs(fil) {
  const activas = fil.filter(v => v.estado !== 'cancelada');
  document.getElementById('k-total').textContent = '$' + activas.reduce((s,v)=>s+(+v.precio||0)*(+v.cantidad||1),0).toLocaleString('es-MX',{minimumFractionDigits:0});
  document.getElementById('k-cant').textContent = activas.reduce((s,v)=>s+(+v.cantidad||1),0);
  document.getElementById('k-pagadas').textContent = fil.filter(v=>v.estado==='pagada').length;
  document.getElementById('k-pend').textContent = fil.filter(v=>v.estado==='pendiente').length;
}

window.onPerfumeChange = () => {
  const id = document.getElementById('v-perfume').value;
  const p = perfumes.find(x => x.id === id);
  const tallaSel = document.getElementById('v-talla');
  const precioEl = document.getElementById('v-precio');
  if (!p) { tallaSel.innerHTML = '<option value="">Selecciona talla</option>'; return; }
  const opts = Object.entries(p.precios||{}).filter(([,v])=>+v>0)
    .map(([k,v]) => `<option value="${k}" data-precio="${v}">${k} ml — $${v}</option>`).join('');
  tallaSel.innerHTML = '<option value="">Selecciona talla</option>' + opts;
  tallaSel.onchange = () => {
    const opt = tallaSel.selectedOptions[0];
    if (opt?.dataset.precio) precioEl.value = opt.dataset.precio;
  };
};

window.renderTable = () => {
  const fil = getFiltered();
  updateKPIs(fil);
  document.getElementById('count-label').textContent = fil.length + ' ventas';
  const tb = document.getElementById('tbody');
  if (!fil.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="bi bi-receipt"></i><h3>Sin ventas</h3><p>Registra tu primera venta.</p></div></td></tr>';
    return;
  }
  const canalLabel = { mercado: 'Sobre ruedas', online: 'Online/WA', otro: 'Otro' };
  const canalClass = { mercado: 'mercado', online: 'online', otro: 'otro' };
  tb.innerHTML = fil.map(v => {
    const fecha = v.creadoEn ? new Date(v.creadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const total = ((+v.precio||0)*(+v.cantidad||1)).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    const canal = v.canal || 'online';
    return `<tr>
      <td style="color:var(--text-muted);font-size:13px">${fecha}</td>
      <td><strong>${v.perfumeNombre||'—'}</strong></td>
      <td><span class="badge-ml">${v.talla||'—'} ml × ${v.cantidad||1}</span></td>
      <td><strong>${total}</strong></td>
      <td>${v.cliente||'<span style="color:var(--text-faint)">—</span>'}</td>
      <td><span class="badge-canal ${canalClass[canal]}">${canalLabel[canal]||canal}</span></td>
      <td><span class="badge-estado ${v.estado||'pendiente'}">${v.estado||'pendiente'}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn-icon" onclick="editEstado('${v.id}','${v.estado||'pendiente'}')" title="Cambiar estado"><i class="bi bi-pencil-square"></i></button>
        <button class="btn-icon" onclick="del('${v.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`;
  }).join('');
};

// ── Export CSV ────────────────────────────────────────────────────────────────
window.exportCSV = () => {
  const fil = getFiltered();
  if (!fil.length) { toast('No hay ventas para exportar', 'error'); return; }
  const headers = ['Fecha','Perfume','Marca','Talla (ml)','Cantidad','Precio Unit.','Total','Cliente','Canal','Estado','Notas'];
  const rows = fil.map(v => {
    const fecha = v.creadoEn ? new Date(v.creadoEn).toLocaleDateString('es-MX') : '';
    const total = (+v.precio||0)*(+v.cantidad||1);
    return [
      fecha, v.perfumeNombre||'', v.perfumeMarca||'', v.talla||'',
      v.cantidad||1, v.precio||0, total,
      v.cliente||'', v.canal||'', v.estado||'', v.notas||''
    ].map(c => `"${String(c).replace(/"/g,'""')}"` ).join(',');
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_${document.getElementById('f-periodo').value||'total'}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exportado ✅', 'success');
};

// ── Modal individual ──────────────────────────────────────────────────────────
window.openModal = () => {
  ['v-id','v-cliente','v-notas'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('v-precio').value = '';
  document.getElementById('v-cantidad').value = 1;
  document.getElementById('v-estado').value = 'pagada';
  document.getElementById('v-canal').value = 'online';
  document.getElementById('v-perfume').value = '';
  document.getElementById('v-talla').innerHTML = '<option value="">Selecciona talla</option>';
  document.getElementById('modal-title').textContent = 'Nueva Venta';
  document.getElementById('modal').classList.add('open');
};
window.closeModal = () => document.getElementById('modal').classList.remove('open');

window.save = async () => {
  const perfumeId = document.getElementById('v-perfume').value;
  const talla     = document.getElementById('v-talla').value;
  const precio    = +document.getElementById('v-precio').value;
  const cantidad  = +document.getElementById('v-cantidad').value || 1;
  const estado    = document.getElementById('v-estado').value;
  const canal     = document.getElementById('v-canal').value;
  if (!perfumeId || !talla || !precio) { toast('Completa perfume, talla y precio (*)', 'error'); return; }
  const p = perfumes.find(x => x.id === perfumeId);
  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
  try {
    await addDoc(collection(db, 'ventas'), {
      perfumeId, perfumeNombre: p?.nombre||'', perfumeMarca: p?.marca||'',
      talla, precio, cantidad, estado, canal,
      cliente: document.getElementById('v-cliente').value.trim(),
      notas:   document.getElementById('v-notas').value.trim(),
      creadoEn: Date.now()
    });
    toast('Venta registrada ✅', 'success');
    closeModal();
    loadAll();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  finally { btn.disabled=false; btn.innerHTML='<i class="bi bi-check2"></i> Guardar Venta'; }
};

window.editEstado = (id, estado) => {
  document.getElementById('es-id').value = id;
  document.getElementById('es-valor').value = estado;
  document.getElementById('modal-estado').classList.add('open');
};
window.closeEstado = () => document.getElementById('modal-estado').classList.remove('open');
window.guardarEstado = async () => {
  const id     = document.getElementById('es-id').value;
  const estado = document.getElementById('es-valor').value;
  await updateDoc(doc(db,'ventas',id), { estado });
  toast('Estado actualizado', 'info');
  closeEstado();
  loadAll();
};

window.del = async (id) => {
  if (!confirm('¿Eliminar esta venta?')) return;
  await deleteDoc(doc(db,'ventas',id));
  toast('Venta eliminada', 'info');
  loadAll();
};

// ── REGISTRO DEL DÍA (batch) ──────────────────────────────────────────────────
let batchRows = [];
let batchRowCounter = 0;

// ── CSS de dropdowns custom (se inyecta una sola vez) ────────────────────────
(function injectBatchDropdownStyles() {
  if (document.getElementById('batch-dd-styles')) return;
  const s = document.createElement('style');
  s.id = 'batch-dd-styles';
  s.textContent = `
    .bdd-wrap { position: relative; width: 100%; }
    .bdd-trigger {
      width: 100%;
      padding: 5px 28px 5px 10px;
      border: 1px solid var(--border, rgba(255,255,255,.15));
      border-radius: 6px;
      font-size: 13px;
      background: var(--surface, #1c1b19);
      color: var(--text, #cdccca);
      cursor: pointer;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: border-color .15s;
    }
    .bdd-trigger:hover { border-color: var(--primary, #4f98a3); }
    .bdd-trigger:focus { outline: 2px solid var(--primary, #4f98a3); outline-offset: 1px; }
    .bdd-arrow {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 11px;
      color: var(--text-muted, #797876);
      transition: transform .15s;
    }
    .bdd-wrap.open .bdd-arrow { transform: translateY(-50%) rotate(180deg); }
    .bdd-menu {
      position: fixed;
      z-index: 99999;
      background: var(--card-bg, #1c1b19);
      border: 1px solid var(--border, rgba(255,255,255,.15));
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,.7);
      overflow-y: auto;
      max-height: 240px;
      padding: 4px 0;
      display: none;
      min-width: 140px;
    }
    .bdd-wrap.open .bdd-menu { display: block; }
    .bdd-item {
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text, #cdccca);
      transition: background .1s, color .1s;
    }
    .bdd-item:hover, .bdd-item.active {
      background: rgba(79,152,163,.18);
      color: var(--primary, #4f98a3);
    }
    .bdd-item.selected {
      background: rgba(79,152,163,.12);
      color: var(--primary, #4f98a3);
      font-weight: 600;
    }
    .bdd-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .bdd-dot.pagada    { background: #22c55e; }
    .bdd-dot.pendiente { background: #f59e0b; }
    .bdd-dot.cancelada { background: #ef4444; }
  `;
  document.head.appendChild(s);
})();

// ── buildCustomDropdown ───────────────────────────────────────────────────────
function buildCustomDropdown(container, items, defaultValue, onChange) {
  container.innerHTML = '';
  container.className = 'bdd-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'bdd-trigger';

  const arrow = document.createElement('span');
  arrow.className = 'bdd-arrow';
  arrow.innerHTML = '<i class="bi bi-chevron-down"></i>';
  container.appendChild(trigger);
  container.appendChild(arrow);

  const menu = document.createElement('div');
  menu.className = 'bdd-menu';
  document.body.appendChild(menu);

  let currentValue = defaultValue || items[0]?.value;

  function getItem(v) { return items.find(i => i.value === v) || items[0]; }

  function renderTrigger(v) {
    const item = getItem(v);
    trigger.innerHTML = (item.icon ? item.icon + ' ' : '') + item.label;
  }

  function reposition() {
    const r = trigger.getBoundingClientRect();
    menu.style.top   = (r.bottom + 4) + 'px';
    menu.style.left  = r.left + 'px';
    menu.style.width = Math.max(r.width, 140) + 'px';
  }

  function openMenu() {
    reposition();
    container.classList.add('open');
    renderMenuItems();
  }

  function closeMenu() {
    container.classList.remove('open');
  }

  function renderMenuItems() {
    menu.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'bdd-item' + (item.value === currentValue ? ' selected' : '');
      el.innerHTML = (item.icon ? item.icon + ' ' : '') + item.label;
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        currentValue = item.value;
        renderTrigger(currentValue);
        closeMenu();
        onChange(currentValue);
      });
      menu.appendChild(el);
    });
  }

  trigger.addEventListener('click', () => {
    container.classList.contains('open') ? closeMenu() : openMenu();
  });

  document.addEventListener('mousedown', e => {
    if (!container.contains(e.target) && !menu.contains(e.target)) closeMenu();
  });

  renderTrigger(currentValue);

  container._ddGetValue  = () => currentValue;
  container._ddSetValue  = (v) => { currentValue = v; renderTrigger(v); };
  container._ddDestroy   = () => menu.remove();

  return container;
}

// ── Items para Estado ─────────────────────────────────────────────────────────
const ESTADO_ITEMS = [
  { value: 'pagada',    label: 'Pagada',    icon: '<span class="bdd-dot pagada"></span>' },
  { value: 'pendiente', label: 'Pendiente', icon: '<span class="bdd-dot pendiente"></span>' },
  { value: 'cancelada', label: 'Cancelada', icon: '<span class="bdd-dot cancelada"></span>' },
];

const TALLAS_DEFAULT = ['2','3','5','10','30','50','100'];

function getTallaItems(perfumeId) {
  const p = perfumeId ? perfumes.find(x => x.id === perfumeId) : null;
  const entries = p ? Object.entries(p.precios||{}).filter(([,v])=>+v>0) : [];
  if (entries.length) {
    return entries.map(([k,v]) => ({ value: k, label: `${k}ml  $${v}`, precio: v }));
  }
  return TALLAS_DEFAULT.map(k => ({ value: k, label: `${k}ml`, precio: null }));
}

// ── Combobox con portal ───────────────────────────────────────────────────────
function buildCombobox(container, onSelect) {
  container.style.cssText = 'position:relative;width:100%;';

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = '— Perfume —';
  inp.autocomplete = 'off';
  inp.style.cssText = 'width:100%;min-width:160px;';
  container.appendChild(inp);

  const dd = document.createElement('ul');
  dd.style.cssText = [
    'position:fixed',
    'z-index:9999',
    'background:var(--card-bg,#1c1b19)',
    'border:1px solid var(--border,rgba(255,255,255,.12))',
    'border-radius:8px',
    'box-shadow:0 8px 32px rgba(0,0,0,.55)',
    'max-height:260px',
    'overflow-y:auto',
    'padding:4px 0',
    'margin:0',
    'list-style:none',
    'display:none',
    'min-width:220px',
  ].join(';');
  document.body.appendChild(dd);

  let selectedPerfume = null;
  let activeIdx = -1;

  function reposition() {
    const r = inp.getBoundingClientRect();
    dd.style.top  = (r.bottom + 4) + 'px';
    dd.style.left = r.left + 'px';
    dd.style.width = Math.max(r.width, 220) + 'px';
  }

  function renderItems(q) {
    const list = q
      ? perfumes.filter(p => (p.nombre + ' ' + (p.marca||'')).toLowerCase().includes(q.toLowerCase()))
      : perfumes;
    dd.innerHTML = '';
    activeIdx = -1;
    if (!list.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin resultados';
      li.style.cssText = 'padding:10px 14px;color:var(--text-muted,#888);font-size:13px;';
      dd.appendChild(li);
      return;
    }
    list.forEach((p, i) => {
      const li = document.createElement('li');
      li.style.cssText = 'padding:8px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05);';
      li.innerHTML = `<span style="color:var(--text,#e0e0e0);font-size:14px;font-weight:500;">${p.nombre}</span><br>
        <span style="color:var(--text-muted,#888);font-size:12px;">${p.marca||''}</span>`;
      li.addEventListener('mousedown', e => { e.preventDefault(); choose(p); });
      li.addEventListener('mouseover', () => { setActive(i, list); });
      dd.appendChild(li);
    });
  }

  function setActive(i, list) {
    const items = dd.querySelectorAll('li');
    items.forEach((el, idx) => {
      el.style.background = idx === i ? 'var(--primary,#4f98a3)' : '';
      el.style.color = idx === i ? '#fff' : '';
      const spans = el.querySelectorAll('span');
      if (spans.length) {
        spans[0].style.color = idx === i ? '#fff' : 'var(--text,#e0e0e0)';
        spans[1].style.color = idx === i ? 'rgba(255,255,255,.7)' : 'var(--text-muted,#888)';
      }
    });
    activeIdx = i;
  }

  function choose(p) {
    selectedPerfume = p;
    inp.value = p ? `${p.nombre} · ${p.marca||''}` : '';
    closeDD();
    onSelect(p);
  }

  function openDD() { reposition(); dd.style.display = 'block'; renderItems(inp.value); }
  function closeDD() { dd.style.display = 'none'; }

  inp.addEventListener('focus', openDD);
  inp.addEventListener('input', () => { selectedPerfume = null; openDD(); renderItems(inp.value); });
  inp.addEventListener('blur', () => { setTimeout(closeDD, 150); });
  inp.addEventListener('keydown', e => {
    const items = dd.querySelectorAll('li');
    const q = inp.value;
    const list = q
      ? perfumes.filter(p => (p.nombre + ' ' + (p.marca||'')).toLowerCase().includes(q.toLowerCase()))
      : perfumes;
    if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(activeIdx+1, items.length-1); setActive(next, list); items[next]?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = Math.max(activeIdx-1, 0); setActive(prev, list); items[prev]?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0 && list[activeIdx]) choose(list[activeIdx]); }
    else if (e.key === 'Escape') closeDD();
  });

  document.getElementById('modal-dia')?.addEventListener('scroll', () => {
    if (dd.style.display !== 'none') reposition();
  }, { passive: true });

  container._destroyCombobox = () => dd.remove();
  return { inp, clear: () => { inp.value = ''; selectedPerfume = null; } };
}

function buildBatchRowEl(row) {
  const { rid, talla, cantidad, precio, cliente, estado, notas } = row;

  const tr = document.createElement('tr');
  tr.dataset.rid = rid;

  const tdPerf = document.createElement('td');
  tdPerf.style.minWidth = '180px';
  const perfWrap = document.createElement('div');
  tdPerf.appendChild(perfWrap);
  tr.appendChild(tdPerf);

  const tdTalla = document.createElement('td');
  tdTalla.style.minWidth = '110px';
  const tallaWrap = document.createElement('div');
  const tallaItems = getTallaItems('');
  buildCustomDropdown(tallaWrap, tallaItems, tallaItems[0]?.value, (val) => {
    const r = batchRows.find(x => x.rid === rid);
    if (!r) return;
    r.talla = val;
    const item = tallaItems.find(i => i.value === val);
    if (item?.precio) {
      r.precio = item.precio;
      const inPrecio = tr.querySelector(`#brow-precio-${rid}`);
      if (inPrecio) { inPrecio.value = item.precio; batchRefreshTotal(rid); }
    }
    batchRefreshTotal(rid);
  });
  tdTalla.appendChild(tallaWrap);
  tr.appendChild(tdTalla);

  const tdCant = document.createElement('td');
  tdCant.className = 'td-cant';
  const inCant = document.createElement('input');
  inCant.type = 'number'; inCant.min = '1'; inCant.value = cantidad || 1;
  inCant.oninput = () => { batchSet(rid,'cantidad',inCant.value); batchRefreshTotal(rid); };
  tdCant.appendChild(inCant);
  tr.appendChild(tdCant);

  const tdPrecio = document.createElement('td');
  tdPrecio.className = 'td-precio';
  const inPrecio = document.createElement('input');
  inPrecio.type = 'number'; inPrecio.min = '0'; inPrecio.id = `brow-precio-${rid}`;
  inPrecio.value = precio || ''; inPrecio.placeholder = '$';
  inPrecio.oninput = () => { batchSet(rid,'precio',inPrecio.value); batchRefreshTotal(rid); };
  tdPrecio.appendChild(inPrecio);
  tr.appendChild(tdPrecio);

  const tdTotal = document.createElement('td');
  tdTotal.className = 'td-total'; tdTotal.id = `brow-total-${rid}`;
  tdTotal.textContent = '—';
  tr.appendChild(tdTotal);

  const tdCliente = document.createElement('td');
  tdCliente.className = 'td-cliente';
  const inCliente = document.createElement('input');
  inCliente.type = 'text'; inCliente.value = cliente || ''; inCliente.placeholder = 'Cliente';
  inCliente.oninput = () => batchSet(rid,'cliente',inCliente.value);
  tdCliente.appendChild(inCliente);
  tr.appendChild(tdCliente);

  const tdEstado = document.createElement('td');
  tdEstado.className = 'td-estado';
  tdEstado.style.minWidth = '120px';
  const estadoWrap = document.createElement('div');
  buildCustomDropdown(estadoWrap, ESTADO_ITEMS, estado || 'pagada', (val) => {
    batchSet(rid, 'estado', val);
  });
  tdEstado.appendChild(estadoWrap);
  tr.appendChild(tdEstado);

  const tdNota = document.createElement('td');
  tdNota.className = 'td-notas';
  const inNota = document.createElement('input');
  inNota.type = 'text'; inNota.value = notas || ''; inNota.placeholder = 'Nota';
  inNota.oninput = () => batchSet(rid,'notas',inNota.value);
  tdNota.appendChild(inNota);
  tr.appendChild(tdNota);

  const tdRm = document.createElement('td');
  tdRm.className = 'td-rm';
  const btnRm = document.createElement('button');
  btnRm.title = 'Quitar';
  btnRm.innerHTML = '<i class="bi bi-trash"></i>';
  btnRm.onclick = () => removeBatchRow(rid);
  tdRm.appendChild(btnRm);
  tr.appendChild(tdRm);

  buildCombobox(perfWrap, (p) => {
    const r = batchRows.find(x => x.rid === rid);
    if (!r) return;
    r.perfumeId = p ? p.id : '';
    r.talla = ''; r.precio = '';
    const newItems = getTallaItems(p ? p.id : '');
    tallaWrap._ddDestroy?.();
    tallaWrap.innerHTML = '';
    buildCustomDropdown(tallaWrap, newItems, newItems[0]?.value, (val) => {
      r.talla = val;
      const item = newItems.find(i => i.value === val);
      if (item?.precio) {
        r.precio = item.precio;
        inPrecio.value = item.precio;
        batchRefreshTotal(rid);
      }
      batchRefreshTotal(rid);
    });
    inPrecio.value = '';
    tdTotal.textContent = '—';
    updateBatchResumen();
  });

  return tr;
}

function updateBatchResumen() {
  const count = batchRows.length;
  const total = batchRows.reduce((s,r) => s + (+r.precio||0)*(+r.cantidad||1), 0);
  document.getElementById('batch-count').textContent = count + (count===1?' venta':' ventas');
  document.getElementById('batch-total').textContent = '$' + total.toLocaleString('es-MX');
}

window.addBatchRow = () => {
  const rid = ++batchRowCounter;
  const row = { rid, perfumeId:'', talla:'', cantidad:1, precio:'', cliente:'', estado:'pagada', notas:'' };
  batchRows.push(row);
  const tbody = document.getElementById('batch-tbody');
  tbody.appendChild(buildBatchRowEl(row));
  updateBatchResumen();
  tbody.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window.removeBatchRow = (rid) => {
  batchRows = batchRows.filter(r => r.rid !== rid);
  const row = document.querySelector(`#batch-tbody tr[data-rid="${rid}"]`);
  row?.querySelector('div[style]')?._destroyCombobox?.();
  row?.remove();
  updateBatchResumen();
};

window.batchSet = (rid, field, value) => {
  const row = batchRows.find(r => r.rid === rid);
  if (row) row[field] = value;
  updateBatchResumen();
};

window.batchRefreshTotal = (rid) => {
  const row = batchRows.find(r => r.rid === rid);
  if (!row) return;
  const t = document.getElementById(`brow-total-${rid}`);
  if (t) t.textContent = row.precio && row.cantidad
    ? '$' + ((+row.precio)*(+row.cantidad||1)).toLocaleString('es-MX') : '—';
  updateBatchResumen();
};

window.openDia = () => {
  document.querySelectorAll('#batch-tbody tr').forEach(tr => {
    tr.querySelector('div[style]')?._destroyCombobox?.();
  });
  const hoy = new Date().toISOString().slice(0,10);
  document.getElementById('dia-fecha').value = hoy;
  document.getElementById('dia-nota-global').value = '';
  batchRows = []; batchRowCounter = 0;
  document.getElementById('batch-tbody').innerHTML = '';
  updateBatchResumen();
  addBatchRow(); addBatchRow(); addBatchRow();
  document.getElementById('modal-dia').classList.add('open');
};

window.closeDia = () => {
  if (batchRows.some(r => r.perfumeId) && !confirm('¿Cerrar sin guardar?')) return;
  document.querySelectorAll('#batch-tbody tr').forEach(tr => {
    tr.querySelector('div[style]')?._destroyCombobox?.();
  });
  document.getElementById('modal-dia').classList.remove('open');
};

window.saveDia = async () => {
  const fechaStr   = document.getElementById('dia-fecha').value;
  const notaGlobal = document.getElementById('dia-nota-global').value.trim();

  if (!fechaStr) { toast('Pon la fecha del evento', 'error'); return; }

  const validas = batchRows.filter(r => r.perfumeId && r.talla && +r.precio > 0);
  if (!validas.length) { toast('Agrega al menos una venta con perfume, talla y precio', 'error'); return; }

  const [y,m,d] = fechaStr.split('-').map(Number);
  const fechaTs = new Date(y, m-1, d, 12, 0, 0).getTime();

  const btn = document.getElementById('btn-dia-save');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…';

  try {
    const batch = writeBatch(db);
    validas.forEach(r => {
      const p = perfumes.find(x => x.id === r.perfumeId);
      const ref = doc(collection(db, 'ventas'));
      batch.set(ref, {
        perfumeId:     r.perfumeId,
        perfumeNombre: p?.nombre || '',
        perfumeMarca:  p?.marca  || '',
        talla:    r.talla,
        precio:   +r.precio,
        cantidad: +r.cantidad || 1,
        estado:   r.estado,
        canal:    'mercado',
        cliente:  (r.cliente||'').trim(),
        notas:    [r.notas?.trim(), notaGlobal].filter(Boolean).join(' | '),
        creadoEn: fechaTs
      });
    });
    await batch.commit();
    toast(`✅ ${validas.length} venta${validas.length>1?'s':''} guardada${validas.length>1?'s':''} en Firestore`, 'success');
    document.getElementById('modal-dia').classList.remove('open');
    loadAll();
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Guardar todo';
  }
};

loadAll();
