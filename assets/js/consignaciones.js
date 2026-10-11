import { db, collection, getDocs, doc, updateDoc, deleteDoc, addDoc, onAuthStateChanged, auth } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { botellaAsignada, piezasFueraDeBotella, resumenPunto, revisarDisponibilidad } from './puntos-externos.js';

// Puntos externos: lo que dejas en barberías y otros locales. Cada perfume lleva
// decants para vender y probadores; todo sale de la botella asignada al perfume.

let perfumes = [];
let perfumesPorId = new Map();
let consignaciones = [];
let ventas = [];
let itemRowCounter = 0;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pesos = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
const TALLAS = ['2', '3', '5', '10'];

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('consignaciones');
  onAuthStateChanged(auth, (user) => {
    if (user) loadData();
  });
});

async function loadData() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('cons-grid').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';

  try {
    // Las ventas se leen para saber cuántos ml le quedan a cada botella.
    const [pSnap, cSnap, vSnap] = await Promise.all([
      getDocs(collection(db, 'perfumes')),
      getDocs(collection(db, 'consignaciones')),
      getDocs(collection(db, 'ventas'))
    ]);

    perfumes = [];
    pSnap.forEach(d => {
      const p = d.data();
      if (!p.archivado) perfumes.push({ id: d.id, ...p });
    });
    perfumes.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    perfumesPorId = new Map(perfumes.map(p => [p.id, p]));

    consignaciones = [];
    cSnap.forEach(d => consignaciones.push({ id: d.id, ...d.data() }));
    // Abiertos primero, luego lo más reciente.
    consignaciones.sort((a, b) => ((a.estado === 'Cerrado') - (b.estado === 'Cerrado')) || ((b.creadoEn || 0) - (a.creadoEn || 0)));

    ventas = [];
    vSnap.forEach(d => {
      const v = d.data();
      if (v.estado !== 'cancelada') ventas.push({ id: d.id, ...v, creadoEn: v.creadoEn && v.creadoEn.toMillis ? v.creadoEn.toMillis() : v.creadoEn });
    });

    renderLotes();
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

const numBotella = (perfumeId, loteId) => {
  const p = perfumesPorId.get(perfumeId);
  const idx = p && Array.isArray(p.lotes) ? p.lotes.findIndex(l => l.id === loteId) : -1;
  return idx >= 0 ? idx + 1 : null;
};

function renderResumenGeneral() {
  const el = document.getElementById('cons-resumen');
  if (!el) return;
  const abiertos = consignaciones.filter(c => c.estado !== 'Cerrado');
  if (!abiertos.length) { el.innerHTML = ''; return; }
  const t = abiertos.map(c => resumenPunto(c, ventas)).reduce((a, r) => ({
    quedan: a.quedan + r.quedan, probadores: a.probadores + r.probadores,
    valor: a.valor + r.valorEnExhibicion, paraTi: a.paraTi + r.paraTi,
  }), { quedan: 0, probadores: 0, valor: 0, paraTi: 0 });
  el.innerHTML = `
    <div class="cr-item"><span>En exhibición</span><strong>${t.quedan}</strong><small>decants en ${abiertos.length} punto${abiertos.length > 1 ? 's' : ''}</small></div>
    <div class="cr-item"><span>Valen</span><strong>${pesos(t.valor)}</strong><small>si se venden todos</small></div>
    <div class="cr-item"><span>Probadores</span><strong>${t.probadores}</strong><small>no se cobran</small></div>
    <div class="cr-item"><span>Ya te dejaron</span><strong>${pesos(t.paraTi)}</strong><small>vendido menos comisión</small></div>`;
}

function renderLotes() {
  const grid = document.getElementById('cons-grid');
  const empty = document.getElementById('empty-state');
  renderResumenGeneral();

  if (consignaciones.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = consignaciones.map(c => {
    const isClosed = c.estado === 'Cerrado';
    const dateStr = new Date(c.creadoEn).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
    const r = resumenPunto(c, ventas);
    const items = c.items || [];

    const venta = items.map((item, itemIdx) => ({ item, itemIdx })).filter(x => (+x.item.cantidad || 0) > 0);
    const itemsHtml = venta.map(({ item, itemIdx }) => {
      const vendidos = +item.vendidos || 0;
      const cant = +item.cantidad || 0;
      const isItemDone = vendidos >= cant;
      const nb = numBotella(item.perfumeId, item.loteId);
      const pct = cant ? Math.round((vendidos / cant) * 100) : 0;
      return `
        <div class="cons-item${isItemDone ? ' done' : ''}">
          <div class="cons-item-info">
            <div class="cons-item-name">${esc(item.perfumeNombre)}</div>
            <div class="cons-item-meta">
              <span>${esc(item.talla)} ml${item.precio ? ` · $${esc(item.precio)}` : ''}</span>
              ${nb ? `<span>Botella #${nb}</span>` : ''}
              <span class="${isItemDone ? 'ok' : ''}">${vendidos}/${cant} vendidos</span>
            </div>
            <div class="cons-prog"><span style="width:${pct}%"></span></div>
          </div>
          <div class="cons-item-actions">
            <button class="btn-sell" ${isClosed || isItemDone ? 'disabled' : ''} onclick="registrarVenta('${c.id}', ${itemIdx})">+1 Vendido</button>
          </div>
        </div>`;
    }).join('');

    const probadores = items.map((item, itemIdx) => ({ item, itemIdx })).filter(x => (+x.item.probadores || 0) > 0);
    const probHtml = probadores.length ? `
      <div class="cons-sub"><i class="bi bi-droplet-half"></i> Probadores <small>(no se cobran)</small></div>
      <div class="cons-probadores">
        ${probadores.map(({ item, itemIdx }) => `
          <span class="cons-prob">${esc(item.perfumeNombre)} ×${+item.probadores}
            ${isClosed ? '' : `<button onclick="reponerProbador('${c.id}', ${itemIdx})" title="Dejé otro probador de este perfume"><i class="bi bi-plus"></i></button>`}
          </span>`).join('')}
      </div>` : '';

    return `
      <div class="cons-card${isClosed ? ' cerrado' : ''}">
        <div class="cons-header">
          <div style="min-width:0">
            <h3 class="cons-title">${esc(c.lugar)}</h3>
            <div class="cons-date"><i class="bi bi-calendar3"></i> ${dateStr}${c.comision ? ` · comisión $${esc(c.comision)} c/u` : ''}</div>
          </div>
          <div class="cons-acciones">
            <div class="cons-status ${isClosed ? 'status-closed' : 'status-open'}">${esc(c.estado)}</div>
            <button class="btn-icon cons-mini" onclick="editarLote('${c.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon cons-mini" style="color:#ef4444" onclick="eliminarLote('${c.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
          </div>
        </div>

        <div class="cons-stats">
          <div><strong>${r.quedan}</strong><span>${isClosed ? 'regresaron' : 'quedan'}</span></div>
          <div><strong>${r.vendidos}</strong><span>vendidos</span></div>
          <div><strong>${r.probadores}</strong><span>probadores</span></div>
          <div><strong>${pesos(r.paraTi)}</strong><span>para ti</span></div>
        </div>

        <div class="cons-items">
          ${itemsHtml || '<div class="cons-vacio">Solo probadores en este punto.</div>'}
          ${probHtml}
        </div>

        <div class="cons-pie">
          ${r.vendidos ? `<a href="ventas.html?canal=consignacion&q=${encodeURIComponent(c.lugar || '')}"><i class="bi bi-receipt"></i> Ver lo vendido (${pesos(r.vendido)}${r.comision ? `, comisión ${pesos(r.comision)}` : ''})</a>` : '<span></span>'}
          ${!isClosed ? `<button class="btn btn-sm btn-outline" style="color:var(--text-faint); border-color:var(--border);" onclick="cerrarLote('${c.id}')">Terminar</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Formulario ──────────────────────────────────────────────────────────────
window.openModal = () => {
  document.getElementById('modal-title').textContent = 'Dejar perfumes en un punto';
  document.getElementById('c-edit-id').value = '';
  document.getElementById('c-lugar').value = '';
  document.getElementById('c-comision').value = '';
  document.getElementById('items-container').innerHTML = '';
  itemRowCounter = 0;
  addItemRow();
  actualizarDisponibilidad();
  document.getElementById('modal-nuevo').classList.add('open');
};

window.closeModal = () => {
  document.getElementById('modal-nuevo').classList.remove('open');
};

window.editarLote = (loteId) => {
  const lote = consignaciones.find(c => c.id === loteId);
  if (!lote) return;

  document.getElementById('modal-title').textContent = 'Editar punto';
  document.getElementById('c-edit-id').value = lote.id;
  document.getElementById('c-lugar').value = lote.lugar;
  document.getElementById('c-comision').value = lote.comision || '';
  document.getElementById('items-container').innerHTML = '';
  itemRowCounter = 0;

  (lote.items || []).forEach(item => addItemRow(item));
  actualizarDisponibilidad();
  document.getElementById('modal-nuevo').classList.add('open');
};

const precioTienda = (perfumeId, talla) => {
  const p = perfumesPorId.get(perfumeId);
  return p && p.precios && +p.precios[talla] > 0 ? +p.precios[talla] : '';
};

window.addItemRow = (itemData = null) => {
  itemRowCounter++;
  const id = itemRowCounter;
  const div = document.createElement('div');
  div.className = 'item-row';
  div.id = `item-row-${id}`;

  const pId = itemData ? itemData.perfumeId : '';
  const talla = itemData ? String(itemData.talla) : '5';
  const cant = itemData ? (+itemData.cantidad || 0) : 3;
  const probadores = itemData ? (+itemData.probadores || 0) : 1;
  const precio = itemData && itemData.precio ? itemData.precio : '';
  const vendidos = itemData ? (+itemData.vendidos || 0) : 0;

  const options = '<option value="">Elige un perfume…</option>' + perfumes.map(p =>
    `<option value="${p.id}" ${p.id === pId ? 'selected' : ''}>${esc(p.nombre)} (${esc(p.marca)})</option>`).join('');

  div.innerHTML = `
    <input type="hidden" class="p-vendidos" value="${vendidos}">
    <input type="hidden" class="p-lote" value="${esc(itemData && itemData.loteId || '')}">
    <div class="form-group ir-perfume">
      <label>Perfume</label>
      <select class="form-control p-sel">${options}</select>
    </div>
    <div class="form-group">
      <label>Tamaño</label>
      <select class="form-control p-talla">${TALLAS.map(t => `<option value="${t}" ${talla === t ? 'selected' : ''}>${t} ml</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Para vender</label>
      <input type="number" class="form-control p-cant" value="${cant}" min="${vendidos}" step="1">
    </div>
    <div class="form-group">
      <label>Probadores</label>
      <input type="number" class="form-control p-prob" value="${probadores}" min="0" step="1">
    </div>
    <div class="form-group">
      <label>Precio $</label>
      <input type="number" class="form-control p-precio" value="${precio}" placeholder="Ej. 120" min="0">
    </div>
    <div class="ir-quitar">
      <button type="button" class="btn-icon" style="color:#ef4444" onclick="quitarFila(${id})" ${vendidos > 0 ? 'disabled title="Ya tiene ventas"' : ''}><i class="bi bi-trash"></i></button>
    </div>
    <div class="ir-aviso" id="aviso-${id}"></div>
    ${vendidos ? `<div class="ir-nota">${vendidos} ya vendido${vendidos > 1 ? 's' : ''}: "Para vender" no puede bajar de ahí.</div>` : ''}
  `;
  document.getElementById('items-container').appendChild(div);

  // Al elegir perfume o talla se sugiere el precio de la tienda (si no hay uno puesto).
  const sel = div.querySelector('.p-sel');
  const selT = div.querySelector('.p-talla');
  const inPr = div.querySelector('.p-precio');
  const sugerir = () => { if (!inPr.value || inPr.dataset.sugerido === '1') { inPr.value = precioTienda(sel.value, selT.value); inPr.dataset.sugerido = '1'; } };
  sel.addEventListener('change', () => { sugerir(); actualizarDisponibilidad(); });
  selT.addEventListener('change', () => { sugerir(); actualizarDisponibilidad(); });
  inPr.addEventListener('input', () => { inPr.dataset.sugerido = '0'; });
  div.querySelectorAll('.p-cant, .p-prob').forEach(el => el.addEventListener('input', actualizarDisponibilidad));
};

window.quitarFila = (id) => {
  document.getElementById(`item-row-${id}`)?.remove();
  actualizarDisponibilidad();
};

window.probadorATodos = () => {
  document.querySelectorAll('.item-row').forEach(row => {
    const p = row.querySelector('.p-prob');
    if (row.querySelector('.p-sel').value && !(+p.value > 0)) p.value = 1;
  });
  actualizarDisponibilidad();
};

function filasDelFormulario() {
  return [...document.querySelectorAll('.item-row')].map(row => ({
    rowId: row.id.replace('item-row-', ''),
    perfumeId: row.querySelector('.p-sel').value,
    talla: row.querySelector('.p-talla').value,
    cantidad: parseInt(row.querySelector('.p-cant').value) || 0,
    probadores: parseInt(row.querySelector('.p-prob').value) || 0,
    precio: parseFloat(row.querySelector('.p-precio').value) || null,
    vendidos: parseInt(row.querySelector('.p-vendidos').value) || 0,
    loteId: row.querySelector('.p-lote').value || '',
  }));
}

/** Cuántos ml salen de cada botella con lo que llevas en el formulario. */
function revisarFormulario() {
  const editId = document.getElementById('c-edit-id').value;
  const fuera = piezasFueraDeBotella(consignaciones.filter(c => c.id !== editId));
  return revisarDisponibilidad(filasDelFormulario(), perfumesPorId, ventas, fuera);
}

function actualizarDisponibilidad() {
  const revision = new Map(revisarFormulario().map(r => [r.perfumeId, r]));
  const vistos = new Set();
  const filas = filasDelFormulario();
  filas.forEach(f => {
    const el = document.getElementById(`aviso-${f.rowId}`);
    if (!el) return;
    const r = revision.get(f.perfumeId);
    // El aviso va una sola vez por perfume (en su primer renglón).
    if (!r || vistos.has(f.perfumeId)) { el.innerHTML = ''; return; }
    vistos.add(f.perfumeId);
    if (r.botella === null) {
      el.innerHTML = '<span class="aviso-gris"><i class="bi bi-info-circle"></i> Este perfume no tiene botella registrada en Costos.</span>';
    } else {
      el.innerHTML = `<span class="${r.alcanza ? 'aviso-ok' : 'aviso-mal'}"><i class="bi ${r.alcanza ? 'bi-droplet' : 'bi-exclamation-triangle'}"></i>
        Sale de la Botella #${r.botella}: quedan ${Math.round(r.restante)} ml, usas ${Math.round(r.ml)} ml →
        ${r.alcanza ? `te quedan ${Math.round(r.despues)} ml` : `<strong>faltan ${Math.round(-r.despues)} ml</strong>`}</span>`;
    }
  });
  const piezas = filas.filter(f => f.perfumeId).reduce((s, f) => s + Math.max(0, f.cantidad - f.vendidos) + f.probadores, 0);
  const tot = document.getElementById('form-total');
  if (tot) tot.textContent = piezas ? `${piezas} decant${piezas > 1 ? 's' : ''} por servir` : '';
}

window.guardarLote = async () => {
  const editId = document.getElementById('c-edit-id').value;
  const lugar = document.getElementById('c-lugar').value.trim();
  if (!lugar) return Swal.fire('Error', 'Ingresa el nombre del lugar', 'error');
  const comision = Math.max(0, parseFloat(document.getElementById('c-comision').value) || 0);

  const filas = filasDelFormulario().filter(f => f.perfumeId && (f.cantidad > 0 || f.probadores > 0 || f.vendidos > 0));
  if (filas.length === 0) return Swal.fire('Error', 'Añade al menos un perfume con decants o probadores', 'error');

  const faltan = revisarFormulario().filter(r => !r.alcanza);
  if (faltan.length) {
    const { isConfirmed } = await Swal.fire({
      title: 'No alcanza en la botella',
      html: faltan.map(r => `${esc(r.nombre)}: faltan ${Math.round(-r.despues)} ml en la Botella #${r.botella}`).join('<br>') +
        '<br><br><small>Si ya compraste otra, regístrala en Costos y márcala como activa.</small>',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Guardar de todos modos', cancelButtonText: 'Revisar',
    });
    if (!isConfirmed) return;
  }

  const items = filas.map(f => {
    const p = perfumesPorId.get(f.perfumeId);
    const asignada = p && botellaAsignada(p);
    return {
      perfumeId: f.perfumeId,
      perfumeNombre: p ? p.nombre : '',
      perfumeMarca: (p && p.marca) || '',
      talla: f.talla,
      cantidad: Math.max(f.cantidad, f.vendidos),
      probadores: f.probadores,
      precio: f.precio,
      vendidos: f.vendidos,
      // La botella de donde se sirvió: lo ya guardado conserva la suya.
      loteId: f.loteId || (asignada ? asignada.id : '')
    };
  });

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerHTML = 'Guardando...';
  try {
    if (editId) {
      await updateDoc(doc(db, 'consignaciones', editId), { lugar, comision, items });
    } else {
      await addDoc(collection(db, 'consignaciones'), { lugar, comision, estado: 'Abierto', creadoEn: Date.now(), items });
    }
    Swal.fire('¡Listo!', editId ? 'Punto actualizado' : 'Perfumes registrados en el punto', 'success');
    closeModal();
    loadData();
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

// ── Acciones de la tarjeta ──────────────────────────────────────────────────
window.registrarVenta = async (loteId, itemIdx) => {
  const lote = consignaciones.find(c => c.id === loteId);
  const item = lote.items[itemIdx];

  const { value: precioStr } = await Swal.fire({
    title: `Venta de ${item.perfumeNombre}`,
    text: `¿A cuánto vendió el barbero/local este decant de ${item.talla}ml?`,
    input: 'number',
    inputValue: item.precio || '',
    inputPlaceholder: 'Ej. 250',
    showCancelButton: true,
    confirmButtonText: 'Registrar',
    cancelButtonText: 'Cancelar'
  });

  if (!precioStr) return;
  const precio = parseFloat(precioStr);
  if (isNaN(precio) || precio <= 0) return Swal.fire('Error', 'Precio inválido', 'error');

  Swal.fire({ title: 'Procesando...', allowOutsideClick: false });
  Swal.showLoading();

  try {
    const perf = perfumesPorId.get(item.perfumeId);
    const ventaData = {
      creadoEn: Date.now(),
      perfumeId: item.perfumeId,
      perfumeNombre: item.perfumeNombre,
      perfumeMarca: item.perfumeMarca || '',
      talla: item.talla,
      cantidad: 1,
      precio: precio,
      canal: 'consignacion',
      cliente: lote.lugar,
      puntoId: lote.id,
      estado: 'pagada',
      // El resto del sistema lee `metodoPago`; con `metodo` este dato se
      // perdía en el historial y en las estadísticas.
      metodoPago: 'efectivo',
      // Lo que se le paga al punto por pieza: se guarda en la venta para que
      // cambiar la comisión después no reescriba lo ya vendido.
      comision: Number(lote.comision) || 0
    };
    // La botella de donde se sirvió este decant.
    const loteVenta = item.loteId || (perf && perf.loteActivo);
    if (loteVenta) ventaData.loteId = loteVenta;
    const ref = await addDoc(collection(db, 'ventas'), ventaData);
    ventas.push({ id: ref.id, ...ventaData });

    lote.items[itemIdx].vendidos = (+lote.items[itemIdx].vendidos || 0) + 1;
    await updateDoc(doc(db, 'consignaciones', loteId), { items: lote.items });

    Swal.fire('Venta Registrada', 'El ingreso se reflejará en tus estadísticas.', 'success');
    renderLotes();
  } catch (e) {
    console.error(e);
    Swal.fire('Error', e.message, 'error');
  }
};

window.reponerProbador = async (loteId, itemIdx) => {
  const lote = consignaciones.find(c => c.id === loteId);
  const item = lote && lote.items[itemIdx];
  if (!item) return;
  const { isConfirmed } = await Swal.fire({
    title: '¿Dejaste otro probador?',
    text: `Se descuentan ${item.talla} ml de ${item.perfumeNombre} de su botella.`,
    icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, uno más', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#C9A84C'
  });
  if (!isConfirmed) return;
  try {
    lote.items[itemIdx].probadores = (+item.probadores || 0) + 1;
    await updateDoc(doc(db, 'consignaciones', loteId), { items: lote.items });
    renderLotes();
  } catch (e) {
    console.error(e);
    Swal.fire('Error', e.message, 'error');
  }
};

window.cerrarLote = async (loteId) => {
  const result = await Swal.fire({
    title: '¿Terminar en este punto?',
    text: 'Ya no podrás registrar más ventas aquí. Los decants no vendidos regresan contigo; los probadores se cuentan como gastados.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, terminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#C9A84C'
  });

  if (result.isConfirmed) {
    try {
      await updateDoc(doc(db, 'consignaciones', loteId), { estado: 'Cerrado' });
      Swal.fire('Punto terminado', '', 'success');
      loadData();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message, 'error');
    }
  }
};

window.eliminarLote = async (loteId) => {
  const result = await Swal.fire({
    title: '¿Eliminar este punto permanentemente?',
    text: 'Esta acción no se puede deshacer. (No afectará las ventas que ya registraste)',
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444'
  });

  if (result.isConfirmed) {
    try {
      await deleteDoc(doc(db, 'consignaciones', loteId));
      Swal.fire('Punto eliminado', '', 'success');
      loadData();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message, 'error');
    }
  }
};
