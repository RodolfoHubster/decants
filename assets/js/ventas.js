import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, writeBatch }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('ventas');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let ventas = [], perfumes = [];
let currentPage = 1, pageSize = 10;

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

// Reset page when filters change
(function patchFilters() {
  const searchEl = document.getElementById('search');
  const estadoEl = document.getElementById('f-estado');
  const canalEl  = document.getElementById('f-canal');
  if (searchEl) searchEl.addEventListener('input', () => { currentPage = 1; });
  if (estadoEl) estadoEl.addEventListener('change', () => { currentPage = 1; });
  if (canalEl)  canalEl.addEventListener('change', () => { currentPage = 1; });
})();

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

  // Pagination calc
  const totalPages = Math.max(1, Math.ceil(fil.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, fil.length);
  const pageItems = fil.slice(start, end);

  if (!fil.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="bi bi-receipt"></i><h3>Sin ventas</h3><p>Registra tu primera venta.</p></div></td></tr>';
    renderPagination(0, 0, 0, 1);
    if(window.renderJornadas) window.renderJornadas(fil);
    return;
  }
  const canalLabel = { mercado: 'Sobre ruedas', online: 'Online/WA', otro: 'Otro' };
  const canalClass = { mercado: 'mercado', online: 'online', otro: 'otro' };
  tb.innerHTML = pageItems.map(v => {
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
        <button class="btn-icon" onclick="editVenta('${v.id}')" title="Editar venta"><i class="bi bi-pencil-square"></i></button>
        <button class="btn-icon" onclick="del('${v.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  renderPagination(fil.length, start + 1, end, totalPages);
  if(window.renderJornadas) window.renderJornadas(fil);
};

// ── Jornadas Sobre Ruedas rendering ──────────────────────────────────────────
window.renderJornadas = (fil) => {
  const container = document.getElementById('jornadas-sr');
  const list = document.getElementById('jornadas-list');
  if (!container || !list) return;

  const mercadoVentas = fil.filter(v => v.canal === 'mercado');
  if (!mercadoVentas.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  // Agrupar por día (usando inicio del día local del creadoEn)
  const grupos = {};
  mercadoVentas.forEach(v => {
    const d = new Date(v.creadoEn || 0);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!grupos[dateKey]) grupos[dateKey] = { ventas: [], lugar: '', nota: '', ts: v.creadoEn };
    grupos[dateKey].ventas.push(v);
    if (v.lugar) grupos[dateKey].lugar = v.lugar;
    if (v.notas) {
      const parts = v.notas.split(' | ');
      if (parts.length > 1) grupos[dateKey].nota = parts[parts.length - 1];
      else if (!grupos[dateKey].nota) grupos[dateKey].nota = v.notas;
    }
  });

  list.innerHTML = Object.entries(grupos)
    .sort((a, b) => b[1].ts - a[1].ts) // descending
    .map(([dateKey, grp], idx) => {
      const dateObj = new Date(dateKey + 'T12:00:00');
      const dateStr = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      const totalVendido = grp.ventas.reduce((s,v) => s + (+v.precio||0)*(+v.cantidad||1), 0);
      
      const tbodyHtml = grp.ventas.map(v => {
        const total = ((+v.precio||0)*(+v.cantidad||1)).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
        return `<tr>
          <td><strong>${v.perfumeNombre||'—'}</strong></td>
          <td><span class="badge-ml">${v.talla||'—'} ml × ${v.cantidad||1}</span></td>
          <td><strong>${total}</strong></td>
          <td>${v.cliente||'<span style="color:var(--text-faint)">—</span>'}</td>
          <td><span class="badge-estado ${v.estado||'pendiente'}">${v.estado||'pendiente'}</span></td>
          <td><div style="display:flex;gap:6px">
            <button class="btn-icon" onclick="editVenta('${v.id}')" title="Editar venta"><i class="bi bi-pencil-square"></i></button>
            <button class="btn-icon" onclick="del('${v.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
          </div></td>
        </tr>`;
      }).join('');

      return `
        <div class="jornada-card">
          <div class="jornada-header" onclick="this.parentElement.classList.toggle('open')">
            <div class="jornada-header-left">
              <div class="jornada-date">${dateStr}</div>
              ${grp.lugar ? `<div class="jornada-lugar"><i class="bi bi-geo-alt-fill"></i> ${grp.lugar}</div>` : ''}
            </div>
            <div class="jornada-header-right">
              <div class="jornada-stats">
                <span>${grp.ventas.length} ventas</span>
                <strong>$${totalVendido.toLocaleString('es-MX', {minimumFractionDigits:0})}</strong>
              </div>
              <i class="bi bi-chevron-down jornada-toggle"></i>
            </div>
          </div>
          <div class="jornada-body">
            <div class="jornada-body-inner">
              ${grp.nota ? `<div class="jornada-notas"><i class="bi bi-info-circle"></i> <span>${grp.nota}</span></div>` : ''}
              <div class="jornada-table-wrap">
                <table>
                  <thead><tr><th>Perfume</th><th>Talla</th><th>Precio</th><th>Cliente</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>${tbodyHtml}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
};

// ── Pagination rendering ─────────────────────────────────────────────────────
function renderPagination(total, from, to, totalPages) {
  const infoEl = document.getElementById('pagination-info');
  if (total === 0) {
    infoEl.textContent = '0 ventas';
  } else {
    infoEl.textContent = `${from}–${to} de ${total}`;
  }
  const wrap = document.getElementById('pagination-controls');
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="Anterior"><i class="bi bi-chevron-left"></i></button>`;
  const pages = buildPageNumbers(currentPage, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      html += `<button class="page-btn page-ellipsis" disabled>…</button>`;
    } else {
      html += `<button class="page-btn${p === currentPage ? ' active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
  });
  html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} title="Siguiente"><i class="bi bi-chevron-right"></i></button>`;
  wrap.innerHTML = html;
}

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

window.goToPage = (page) => {
  currentPage = page;
  renderTable();
  document.querySelector('.card .table-wrap')?.scrollIntoView({behavior:'smooth', block:'nearest'});
};

window.onPageSizeChange = () => {
  pageSize = +document.getElementById('page-size').value || 10;
  currentPage = 1;
  renderTable();
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
  document.getElementById('btn-save').innerHTML = '<i class="bi bi-check2"></i> Guardar Venta';
  document.getElementById('modal').classList.add('open');
};
window.closeModal = () => document.getElementById('modal').classList.remove('open');

// ── Editar venta existente (CRUD) ─────────────────────────────────────────────
window.editVenta = (id) => {
  const v = ventas.find(x => x.id === id);
  if (!v) { toast('Venta no encontrada', 'error'); return; }
  document.getElementById('v-id').value = v.id;
  document.getElementById('v-cliente').value = v.cliente || '';
  document.getElementById('v-notas').value = v.notas || '';
  document.getElementById('v-precio').value = v.precio || '';
  document.getElementById('v-cantidad').value = v.cantidad || 1;
  document.getElementById('v-estado').value = v.estado || 'pagada';
  document.getElementById('v-canal').value = v.canal || 'online';
  const perfSel = document.getElementById('v-perfume');
  perfSel.value = v.perfumeId || '';
  const p = perfumes.find(x => x.id === v.perfumeId);
  const tallaSel = document.getElementById('v-talla');
  const precioEl = document.getElementById('v-precio');
  if (p) {
    const opts = Object.entries(p.precios||{}).filter(([,val])=>+val>0)
      .map(([k,val]) => `<option value="${k}" data-precio="${val}">${k} ml — $${val}</option>`).join('');
    tallaSel.innerHTML = '<option value="">Selecciona talla</option>' + opts;
    tallaSel.onchange = () => {
      const opt = tallaSel.selectedOptions[0];
      if (opt?.dataset.precio) precioEl.value = opt.dataset.precio;
    };
  } else {
    tallaSel.innerHTML = '<option value="">Selecciona talla</option>';
  }
  tallaSel.value = v.talla || '';
  document.getElementById('modal-title').textContent = 'Editar Venta';
  document.getElementById('btn-save').innerHTML = '<i class="bi bi-check2"></i> Actualizar Venta';
  document.getElementById('modal').classList.add('open');
};

window.save = async () => {
  const editId    = document.getElementById('v-id').value;
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
  const data = {
    perfumeId, perfumeNombre: p?.nombre||'', perfumeMarca: p?.marca||'',
    talla, precio, cantidad, estado, canal,
    cliente: document.getElementById('v-cliente').value.trim(),
    notas:   document.getElementById('v-notas').value.trim(),
  };
  try {
    if (editId) {
      await updateDoc(doc(db, 'ventas', editId), data);
      toast('Venta actualizada ✅', 'success');
    } else {
      data.creadoEn = Date.now();
      await addDoc(collection(db, 'ventas'), data);
      toast('Venta registrada ✅', 'success');
    }
    closeModal();
    loadAll();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = editId
      ? '<i class="bi bi-check2"></i> Actualizar Venta'
      : '<i class="bi bi-check2"></i> Guardar Venta';
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM DROPDOWN (sin <select> nativo) — reutilizable para Talla y Estado
// buildCustomDropdown(container, items, defaultLabel, onChange)
// items: [{ value, label, dot }]  dot: color CSS (opcional)
// ─────────────────────────────────────────────────────────────────────────────
function buildCustomDropdown(container, items, defaultLabel, onChange) {
  container.style.cssText = 'position:relative;width:100%;';

  // Botón visible
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = [
    'width:100%', 'padding:5px 28px 5px 8px', 'border:1px solid var(--border)',
    'border-radius:6px', 'font-size:13px', 'background:var(--surface)', 'color:var(--text-muted)',
    'text-align:left', 'cursor:pointer', 'position:relative', 'white-space:nowrap',
    'overflow:hidden', 'text-overflow:ellipsis', 'display:flex', 'align-items:center', 'gap:6px'
  ].join(';');
  btn.innerHTML = `<span class="cdd-label" style="flex:1;overflow:hidden;text-overflow:ellipsis">${defaultLabel}</span><i class="bi bi-chevron-down" style="position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text-muted)"></i>`;
  container.appendChild(btn);

  // Dropdown portal montado en body
  const dd = document.createElement('div');
  dd.style.cssText = [
    'position:fixed', 'z-index:99999',
    'background:var(--bg-card,#1c1b19)',
    'border:1px solid var(--border,rgba(255,255,255,.15))',
    'border-radius:8px',
    'box-shadow:0 8px 32px rgba(0,0,0,.8)',
    'padding:4px 0',
    'display:none',
    'min-width:130px',
  ].join(';');
  document.body.appendChild(dd);

  let selectedValue = null;
  let isOpen = false;

  function reposition() {
    const r = btn.getBoundingClientRect();
    dd.style.top   = (r.bottom + 3) + 'px';
    dd.style.left  = r.left + 'px';
    dd.style.width = Math.max(r.width, 130) + 'px';
  }

  function renderItems() {
    dd.innerHTML = '';
    items.forEach(item => {
      const opt = document.createElement('div');
      opt.style.cssText = [
        'padding:8px 12px', 'cursor:pointer', 'font-size:13px',
        'color:var(--text-primary)', 'display:flex', 'align-items:center', 'gap:8px',
        'transition:background .1s'
      ].join(';');
      if (item.dot) {
        const dot = document.createElement('span');
        dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${item.dot};flex-shrink:0;`;
        opt.appendChild(dot);
      }
      const lbl = document.createElement('span');
      lbl.textContent = item.label;
      opt.appendChild(lbl);
      if (item.value === selectedValue) {
        opt.style.background = 'var(--bg-card2,rgba(201,168,76,.15))';
        opt.style.color = 'var(--accent)';
      }
      opt.addEventListener('mouseover', () => { opt.style.background = 'var(--bg-card2,rgba(201,168,76,.15))'; opt.style.color = 'var(--accent)'; });
      opt.addEventListener('mouseout',  () => { opt.style.background = item.value === selectedValue ? 'var(--bg-card2,rgba(201,168,76,.15))' : ''; opt.style.color = item.value === selectedValue ? 'var(--accent)' : 'var(--text-primary)'; });
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        choose(item);
      });
      dd.appendChild(opt);
    });
  }

  function choose(item) {
    selectedValue = item.value;
    const labelEl = btn.querySelector('.cdd-label');
    if (item.dot) {
      labelEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.dot};margin-right:6px;"></span>${item.label}`;
    } else {
      labelEl.textContent = item.label;
    }
    btn.style.color = 'var(--text-primary)';
    closeDD();
    onChange(item.value);
  }

  function openDD() {
    reposition();
    renderItems();
    dd.style.display = 'block';
    isOpen = true;
    btn.querySelector('i').className = 'bi bi-chevron-up';
    btn.querySelector('i').style.cssText = 'position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text-muted)';
  }

  function closeDD() {
    dd.style.display = 'none';
    isOpen = false;
    const ico = btn.querySelector('i');
    if (ico) { ico.className = 'bi bi-chevron-down'; }
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    isOpen ? closeDD() : openDD();
  });

  document.addEventListener('mousedown', e => {
    if (!container.contains(e.target) && !dd.contains(e.target)) closeDD();
  });

  // API pública
  container._getValue  = () => selectedValue;
  container._setValue  = (v) => {
    const item = items.find(i => i.value === v);
    if (item) choose(item);
  };
  container._setItems  = (newItems) => {
    items.length = 0;
    newItems.forEach(i => items.push(i));
    selectedValue = null;
    const labelEl = btn.querySelector('.cdd-label');
    labelEl.textContent = defaultLabel;
    btn.style.color = 'var(--text-muted)';
  };
  container._destroy = () => dd.remove();

  return container;
}

// ── Combobox perfume con portal ───────────────────────────────────────────────
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
    'position:fixed', 'z-index:9999',
    'background:var(--card-bg,#1c1b19)',
    'border:1px solid var(--border,rgba(255,255,255,.12))',
    'border-radius:8px',
    'box-shadow:0 8px 32px rgba(0,0,0,.55)',
    'max-height:260px', 'overflow-y:auto',
    'padding:4px 0', 'margin:0', 'list-style:none',
    'display:none', 'min-width:220px',
  ].join(';');
  document.body.appendChild(dd);

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
      li.addEventListener('mouseover', () => setActive(i, list));
      dd.appendChild(li);
    });
  }

  function setActive(i, list) {
    const items = dd.querySelectorAll('li');
    items.forEach((el, idx) => {
      el.style.background = idx === i ? 'var(--primary,#4f98a3)' : '';
      const spans = el.querySelectorAll('span');
      if (spans.length) {
        spans[0].style.color = idx === i ? '#fff' : 'var(--text,#e0e0e0)';
        spans[1].style.color = idx === i ? 'rgba(255,255,255,.7)' : 'var(--text-muted,#888)';
      }
    });
    activeIdx = i;
  }

  function choose(p) {
    inp.value = p ? `${p.nombre} · ${p.marca||''}` : '';
    closeDD();
    onSelect(p);
  }

  function openDD() { reposition(); dd.style.display = 'block'; renderItems(inp.value); }
  function closeDD() { dd.style.display = 'none'; }

  inp.addEventListener('focus', openDD);
  inp.addEventListener('input', () => { openDD(); renderItems(inp.value); });
  inp.addEventListener('blur', () => setTimeout(closeDD, 150));
  inp.addEventListener('keydown', e => {
    const items = dd.querySelectorAll('li');
    const q = inp.value;
    const list = q ? perfumes.filter(p => (p.nombre+' '+(p.marca||'')).toLowerCase().includes(q.toLowerCase())) : perfumes;
    if (e.key === 'ArrowDown') { e.preventDefault(); const n=Math.min(activeIdx+1,items.length-1); setActive(n,list); items[n]?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const n=Math.max(activeIdx-1,0); setActive(n,list); items[n]?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx>=0&&list[activeIdx]) choose(list[activeIdx]); }
    else if (e.key === 'Escape') closeDD();
  });

  document.getElementById('modal-dia')?.addEventListener('scroll', () => { if (dd.style.display!=='none') reposition(); }, { passive:true });
  container._destroyCombobox = () => dd.remove();
  return { inp };
}

// ── Opciones de estado ────────────────────────────────────────────────────────
const ESTADO_ITEMS = [
  { value: 'pagada',    label: 'Pagada',    dot: '#22c55e' },
  { value: 'pendiente', label: 'Pendiente', dot: '#f59e0b' },
  { value: 'cancelada', label: 'Cancelada', dot: '#ef4444' },
];

function tallaItems(perfumeId) {
  if (!perfumeId) return [];
  const p = perfumes.find(x => x.id === perfumeId);
  if (!p) return [];
  return Object.entries(p.precios||{}).filter(([,v])=>+v>0)
    .map(([k,v]) => ({ value: k, label: `${k}ml — $${v}`, precio: +v }));
}

function buildBatchRowEl(row) {
  const { rid, cantidad, precio, cliente, estado, notas } = row;

  const tr = document.createElement('tr');
  tr.dataset.rid = rid;

  // ── Celda Perfume: combobox portal ────────────────────────────────────────
  const tdPerf = document.createElement('td');
  tdPerf.style.minWidth = '180px';
  const perfWrap = document.createElement('div');
  tdPerf.appendChild(perfWrap);
  tr.appendChild(tdPerf);

  // ── Celda Talla: custom dropdown portal ───────────────────────────────────
  const tdTalla = document.createElement('td');
  tdTalla.style.minWidth = '120px';
  const tallaWrap = document.createElement('div');
  tdTalla.appendChild(tallaWrap);
  tr.appendChild(tdTalla);
  buildCustomDropdown(tallaWrap, [], '— Talla —', (val) => {
    const r = batchRows.find(x => x.rid === rid);
    if (!r) return;
    r.talla = val;
    // auto-fill precio
    const items = tallaItems(r.perfumeId);
    const found = items.find(i => i.value === val);
    if (found?.precio) {
      r.precio = found.precio;
      inPrecio.value = found.precio;
    }
    batchRefreshTotal(rid);
    updateBatchResumen();
  });

  // ── Celda Cantidad ────────────────────────────────────────────────────────
  const tdCant = document.createElement('td');
  tdCant.className = 'td-cant';
  const inCant = document.createElement('input');
  inCant.type = 'number'; inCant.min = '1'; inCant.value = cantidad || 1;
  inCant.oninput = () => { batchSet(rid,'cantidad',inCant.value); batchRefreshTotal(rid); };
  tdCant.appendChild(inCant);
  tr.appendChild(tdCant);

  // ── Celda Precio ──────────────────────────────────────────────────────────
  const tdPrecio = document.createElement('td');
  tdPrecio.className = 'td-precio';
  const inPrecio = document.createElement('input');
  inPrecio.type = 'number'; inPrecio.min = '0'; inPrecio.id = `brow-precio-${rid}`;
  inPrecio.value = precio || ''; inPrecio.placeholder = '$';
  inPrecio.oninput = () => { batchSet(rid,'precio',inPrecio.value); batchRefreshTotal(rid); };
  tdPrecio.appendChild(inPrecio);
  tr.appendChild(tdPrecio);

  // ── Celda Total ───────────────────────────────────────────────────────────
  const tdTotal = document.createElement('td');
  tdTotal.className = 'td-total'; tdTotal.id = `brow-total-${rid}`;
  tdTotal.textContent = '—';
  tr.appendChild(tdTotal);

  // ── Celda Cliente ─────────────────────────────────────────────────────────
  const tdCliente = document.createElement('td');
  tdCliente.className = 'td-cliente';
  const inCliente = document.createElement('input');
  inCliente.type = 'text'; inCliente.value = cliente || ''; inCliente.placeholder = 'Cliente';
  inCliente.oninput = () => batchSet(rid,'cliente',inCliente.value);
  tdCliente.appendChild(inCliente);
  tr.appendChild(tdCliente);

  // ── Celda Estado: custom dropdown portal ──────────────────────────────────
  const tdEstado = document.createElement('td');
  tdEstado.className = 'td-estado';
  const estadoWrap = document.createElement('div');
  tdEstado.appendChild(estadoWrap);
  tr.appendChild(tdEstado);
  buildCustomDropdown(estadoWrap, [...ESTADO_ITEMS], 'Estado', (val) => {
    batchSet(rid,'estado',val);
  });
  // Valor por defecto: pagada
  estadoWrap._setValue('pagada');

  // ── Celda Nota ────────────────────────────────────────────────────────────
  const tdNota = document.createElement('td');
  tdNota.className = 'td-notas';
  const inNota = document.createElement('input');
  inNota.type = 'text'; inNota.value = notas || ''; inNota.placeholder = 'Nota';
  inNota.oninput = () => batchSet(rid,'notas',inNota.value);
  tdNota.appendChild(inNota);
  tr.appendChild(tdNota);

  // ── Celda Borrar ─────────────────────────────────────────────────────────
  const tdRm = document.createElement('td');
  tdRm.className = 'td-rm';
  const btnRm = document.createElement('button');
  btnRm.title = 'Quitar';
  btnRm.innerHTML = '<i class="bi bi-trash"></i>';
  btnRm.onclick = () => removeBatchRow(rid);
  tdRm.appendChild(btnRm);
  tr.appendChild(tdRm);

  // ── Montar combobox de Perfume ────────────────────────────────────────────
  buildCombobox(perfWrap, (p) => {
    const r = batchRows.find(x => x.rid === rid);
    if (!r) return;
    r.perfumeId = p ? p.id : '';
    r.talla = ''; r.precio = '';
    inPrecio.value = '';
    tdTotal.textContent = '—';
    // Actualizar opciones de talla
    const items = tallaItems(p ? p.id : '');
    tallaWrap._setItems(items);
    updateBatchResumen();
  });

  return tr;
}

let batchRows = [];
let batchRowCounter = 0;

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
  // destruir portales
  row?.querySelectorAll('div').forEach(d => {
    d._destroyCombobox?.();
    d._destroy?.();
  });
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
  // limpiar portales previos
  document.querySelectorAll('#batch-tbody tr').forEach(tr => {
    tr.querySelectorAll('div').forEach(d => { d._destroyCombobox?.(); d._destroy?.(); });
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
    tr.querySelectorAll('div').forEach(d => { d._destroyCombobox?.(); d._destroy?.(); });
  });
  document.getElementById('modal-dia').classList.remove('open');
};

window.saveDia = async () => {
  const fechaStr   = document.getElementById('dia-fecha').value;
  const lugarStr   = document.getElementById('dia-lugar').value.trim();
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
        perfumeId: r.perfumeId, perfumeNombre: p?.nombre||'', perfumeMarca: p?.marca||'',
        talla: r.talla, precio: +r.precio, cantidad: +r.cantidad||1,
        estado: r.estado, canal: 'mercado', lugar: lugarStr,

        cliente: (r.cliente||'').trim(),
        notas: [r.notas?.trim(), notaGlobal].filter(Boolean).join(' | '),
        creadoEn: fechaTs
      });
    });
    await batch.commit();
    toast(`✅ ${validas.length} venta${validas.length>1?'s':''} guardada${validas.length>1?'s':''}`, 'success');
    document.getElementById('modal-dia').classList.remove('open');
    localStorage.removeItem('posCart');
    if(window.renderPosCart) window.renderPosCart();
    loadAll();
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Guardar todo';
  }
};

loadAll();

// ── Interceptar Creación de Sobre Ruedas desde Canasta ──────────────────────
setTimeout(() => {
  if (window.location.search.includes('openS=1')) {
    if(window.openDia) window.openDia();
    const cart = JSON.parse(localStorage.getItem('posCart')||'[]');
    if(cart.length > 0) {
      document.getElementById('batch-tbody').innerHTML = '';
      batchRows = [];
      cart.forEach((item) => {
        const rid = ++batchRowCounter;
        const row = { 
          rid, perfumeId: item.id, talla: String(item.ml), 
          cantidad: item.cant || 1, precio: item.precio, 
          cliente: '', estado: 'entregado', notas: 'De Canasta' 
        };
        batchRows.push(row);
        const tr = buildBatchRowEl(row);
        document.getElementById('batch-tbody').appendChild(tr);

        // Forzar UI para que coincida con el row precargado
        setTimeout(() => {
          const inpPerf = tr.querySelector('td:nth-child(1) input');
          if(inpPerf) inpPerf.value = `${item.nombre} · ${item.marca||''}`;
          
          const tallaWrap = tr.querySelector('td:nth-child(2) div');
          if(tallaWrap && tallaWrap._setItems) {
            tallaWrap._setItems(tallaItems(item.id));
            tallaWrap._setValue(String(item.ml));
          }
          
          const estadoWrap = tr.querySelector('td:nth-child(7) div');
          if(estadoWrap && estadoWrap._setValue) {
            estadoWrap._setValue('entregado');
            row.estado = 'entregado';
          }
          
          batchRefreshTotal(rid);
        }, 50);
      });
      updateBatchResumen();
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, 800);
