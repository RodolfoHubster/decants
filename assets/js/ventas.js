import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, writeBatch }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('ventas');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let ventas = [], perfumes = [];

// ── Cargar datos ─────────────────────────────────────────────────────────────
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
    ].map(c => `"${String(c).replace(/"/g,'""')}"`).join(',');
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

// ── REGISTRO DEL DÍA (batch) ─────────────────────────────────────────────────
let batchRows = [];   // [{ id, perfumeId, talla, cantidad, precio, cliente, estado, notas }]
let batchRowCounter = 0;

function perfumeOptsHtml() {
  return '<option value="">— Perfume —</option>' +
    perfumes.map(p => `<option value="${p.id}">${p.nombre}${p.marca ? ' · '+p.marca : ''}</option>`).join('');
}

function tallaOptsHtml(perfumeId) {
  if (!perfumeId) return '<option value="">— Talla —</option>';
  const p = perfumes.find(x => x.id === perfumeId);
  if (!p) return '<option value="">— Talla —</option>';
  const opts = Object.entries(p.precios||{}).filter(([,v])=>+v>0)
    .map(([k,v]) => `<option value="${k}" data-precio="${v}">${k}ml $${v}</option>`).join('');
  return '<option value="">— Talla —</option>' + opts;
}

function renderBatchRow(row) {
  const { rid, perfumeId, talla, cantidad, precio, cliente, estado, notas } = row;
  const total = precio && cantidad ? `$${(+precio*(+cantidad||1)).toLocaleString('es-MX')}` : '—';
  return `<tr data-rid="${rid}">
    <td>
      <select onchange="batchOnPerfume(${rid},this.value)">
        ${perfumeOptsHtml().replace(`value="${perfumeId}"`, `value="${perfumeId}" selected`)}
      </select>
    </td>
    <td>
      <select id="brow-talla-${rid}" onchange="batchOnTalla(${rid},this)">
        ${tallaOptsHtml(perfumeId).replace(`value="${talla}"`, `value="${talla}" selected`)}
      </select>
    </td>
    <td class="td-cant">
      <input type="number" min="1" value="${cantidad||1}" onchange="batchSet(${rid},'cantidad',this.value);batchRefreshTotal(${rid})">
    </td>
    <td class="td-precio">
      <input type="number" min="0" id="brow-precio-${rid}" value="${precio||''}" placeholder="$" onchange="batchSet(${rid},'precio',this.value);batchRefreshTotal(${rid})">
    </td>
    <td class="td-total" id="brow-total-${rid}">${total}</td>
    <td class="td-cliente">
      <input type="text" value="${cliente||''}" placeholder="Cliente" onchange="batchSet(${rid},'cliente',this.value)">
    </td>
    <td class="td-estado">
      <select onchange="batchSet(${rid},'estado',this.value)">
        <option value="pagada"  ${estado==='pagada'  ?'selected':''}>Pagada ✅</option>
        <option value="pendiente" ${estado==='pendiente'?'selected':''}>Pendiente ⏳</option>
        <option value="cancelada" ${estado==='cancelada'?'selected':''}>Cancelada ❌</option>
      </select>
    </td>
    <td class="td-notas">
      <input type="text" value="${notas||''}" placeholder="Nota" onchange="batchSet(${rid},'notas',this.value)">
    </td>
    <td class="td-rm">
      <button onclick="removeBatchRow(${rid})" title="Quitar"><i class="bi bi-trash"></i></button>
    </td>
  </tr>`;
}

function refreshBatchTable() {
  document.getElementById('batch-tbody').innerHTML = batchRows.map(renderBatchRow).join('');
  updateBatchResumen();
}

function updateBatchResumen() {
  const count = batchRows.length;
  const total = batchRows.reduce((s,r) => s + (+r.precio||0)*(+r.cantidad||1), 0);
  document.getElementById('batch-count').textContent = count + (count===1?' venta':' ventas');
  document.getElementById('batch-total').textContent = '$' + total.toLocaleString('es-MX');
}

window.addBatchRow = () => {
  const rid = ++batchRowCounter;
  batchRows.push({ rid, perfumeId:'', talla:'', cantidad:1, precio:'', cliente:'', estado:'pagada', notas:'' });
  refreshBatchTable();
  // scroll to new row
  const tb = document.getElementById('batch-tbody');
  tb.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window.removeBatchRow = (rid) => {
  batchRows = batchRows.filter(r => r.rid !== rid);
  refreshBatchTable();
};

window.batchSet = (rid, field, value) => {
  const row = batchRows.find(r => r.rid === rid);
  if (row) row[field] = value;
  updateBatchResumen();
};

window.batchOnPerfume = (rid, perfumeId) => {
  const row = batchRows.find(r => r.rid === rid);
  if (!row) return;
  row.perfumeId = perfumeId;
  row.talla = ''; row.precio = '';
  // update talla select in place
  const tallaEl = document.getElementById(`brow-talla-${rid}`);
  if (tallaEl) tallaEl.innerHTML = tallaOptsHtml(perfumeId);
  document.getElementById(`brow-precio-${rid}`).value = '';
  document.getElementById(`brow-total-${rid}`).textContent = '—';
  updateBatchResumen();
};

window.batchOnTalla = (rid, sel) => {
  const row = batchRows.find(r => r.rid === rid);
  if (!row) return;
  row.talla = sel.value;
  const opt = sel.selectedOptions[0];
  if (opt?.dataset.precio) {
    row.precio = opt.dataset.precio;
    document.getElementById(`brow-precio-${rid}`).value = opt.dataset.precio;
  }
  batchRefreshTotal(rid);
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
  // fecha de hoy por defecto
  const hoy = new Date().toISOString().slice(0,10);
  document.getElementById('dia-fecha').value = hoy;
  document.getElementById('dia-nota-global').value = '';
  batchRows = []; batchRowCounter = 0;
  refreshBatchTable();
  // agregar 3 filas iniciales para arrancar rápido
  addBatchRow(); addBatchRow(); addBatchRow();
  document.getElementById('modal-dia').classList.add('open');
};

window.closeDia = () => {
  if (batchRows.some(r => r.perfumeId) && !confirm('¿Cerrar sin guardar?')) return;
  document.getElementById('modal-dia').classList.remove('open');
};

window.saveDia = async () => {
  const fechaStr  = document.getElementById('dia-fecha').value;
  const notaGlobal = document.getElementById('dia-nota-global').value.trim();

  if (!fechaStr) { toast('Pon la fecha del evento', 'error'); return; }

  // Validar filas con perfume seleccionado
  const validas = batchRows.filter(r => r.perfumeId && r.talla && +r.precio > 0);
  if (!validas.length) { toast('Agrega al menos una venta con perfume, talla y precio', 'error'); return; }

  // Convertir fecha a timestamp (mediodia local para evitar desfases de timezone)
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
        cliente:  r.cliente.trim(),
        notas:    [r.notas.trim(), notaGlobal].filter(Boolean).join(' | '),
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
