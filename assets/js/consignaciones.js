import { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, onAuthStateChanged, auth } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';

let perfumes = [];
let consignaciones = [];
let itemRowCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('consignaciones');
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadData();
    }
  });
});

async function loadData() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('cons-grid').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';

  try {
    const [pSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'perfumes')),
      getDocs(collection(db, 'consignaciones'))
    ]);
    
    perfumes = [];
    pSnap.forEach(d => {
      const p = d.data();
      if (!p.archivado) perfumes.push({ id: d.id, ...p });
    });
    
    consignaciones = [];
    cSnap.forEach(d => {
      consignaciones.push({ id: d.id, ...d.data() });
    });
    
    consignaciones.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
    
    renderLotes();
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

function renderLotes() {
  const grid = document.getElementById('cons-grid');
  const empty = document.getElementById('empty-state');
  
  if (consignaciones.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  empty.style.display = 'none';
  
  grid.innerHTML = consignaciones.map((c, idx) => {
    const isClosed = c.estado === 'Cerrado';
    const dateStr = new Date(c.creadoEn).toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'numeric' });
    
    let itemsHtml = c.items.map((item, itemIdx) => {
      const isItemDone = item.vendidos >= item.cantidad;
      const precioStr = item.precio ? ` - $${item.precio}` : '';
      return `
        <div class="cons-item">
          <div class="cons-item-info">
            <div class="cons-item-name">${item.perfumeNombre} <span style="color:var(--accent)">(${item.talla}ml${precioStr})</span></div>
            <div class="cons-item-meta">
              <span>Dejados: ${item.cantidad}</span>
              <span style="color:${isItemDone ? '#22c55e' : 'var(--text-muted)'}">Vendidos: ${item.vendidos}</span>
            </div>
          </div>
          <div class="cons-item-actions">
            <button class="btn-sell" ${isClosed || isItemDone ? 'disabled' : ''} onclick="registrarVenta('${c.id}', ${itemIdx})">
              +1 Vendido
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    let totalDejados = c.items.reduce((s, i) => s + i.cantidad, 0);
    let totalVendidos = c.items.reduce((s, i) => s + (i.vendidos||0), 0);
    
    return `
      <div class="cons-card">
        <div class="cons-header">
          <div>
            <h3 class="cons-title">${c.lugar}</h3>
            <div class="cons-date"><i class="bi bi-calendar3"></i> ${dateStr} • ${totalVendidos}/${totalDejados} vendidos</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="cons-status ${isClosed ? 'status-closed' : 'status-open'}">${c.estado}</div>
            <button class="btn-icon" style="color:var(--text-muted); width:24px; height:24px; display:flex; align-items:center; justify-content:center;" onclick="editarLote('${c.id}')" title="Editar Lote"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon" style="color:#ef4444; width:24px; height:24px; display:flex; align-items:center; justify-content:center;" onclick="eliminarLote('${c.id}')" title="Eliminar Lote"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        
        <div class="cons-items">
          ${itemsHtml}
        </div>
        
        ${!isClosed ? `
        <div style="text-align:right; margin-top:10px;">
          <button class="btn btn-sm btn-outline" style="color:var(--text-faint); border-color:var(--border);" onclick="cerrarLote('${c.id}')">Marcar Lote como Terminado</button>
        </div>` : ''}
      </div>
    `;
  }).join('');
}

// Global functions
window.openModal = () => {
  document.getElementById('modal-title').textContent = 'Crear Lote de Consignación';
  document.getElementById('c-edit-id').value = '';
  document.getElementById('c-lugar').value = '';
  document.getElementById('items-container').innerHTML = '';
  itemRowCounter = 0;
  addItemRow();
  document.getElementById('modal-nuevo').classList.add('open');
};

window.closeModal = () => {
  document.getElementById('modal-nuevo').classList.remove('open');
};

window.editarLote = (loteId) => {
  const lote = consignaciones.find(c => c.id === loteId);
  if(!lote) return;
  
  document.getElementById('modal-title').textContent = 'Editar Lote de Consignación';
  document.getElementById('c-edit-id').value = lote.id;
  document.getElementById('c-lugar').value = lote.lugar;
  document.getElementById('items-container').innerHTML = '';
  itemRowCounter = 0;
  
  lote.items.forEach(item => addItemRow(item));
  
  document.getElementById('modal-nuevo').classList.add('open');
};

window.addItemRow = (itemData = null) => {
  itemRowCounter++;
  const id = itemRowCounter;
  
  const div = document.createElement('div');
  div.className = 'item-row';
  div.id = `item-row-${id}`;
  
  // Data for editing
  const pId = itemData ? itemData.perfumeId : '';
  const talla = itemData ? itemData.talla : '5';
  const cant = itemData ? itemData.cantidad : 1;
  const precio = itemData && itemData.precio ? itemData.precio : '';
  const vendidos = itemData ? (itemData.vendidos || 0) : 0;
  
  const options = perfumes.map(p => `<option value="${p.id}" ${p.id === pId ? 'selected' : ''}>${p.nombre} (${p.marca})</option>`).join('');
  
  div.innerHTML = `
    <input type="hidden" class="p-vendidos" value="${vendidos}">
    <div class="form-group">
      <label>Perfume</label>
      <select class="form-control p-sel" id="sel-p-${id}">${options}</select>
    </div>
    <div class="form-group">
      <label>Tamaño</label>
      <select class="form-control p-talla" id="sel-t-${id}">
        <option value="2" ${talla==='2'?'selected':''}>2ml</option>
        <option value="3" ${talla==='3'?'selected':''}>3ml</option>
        <option value="5" ${talla==='5'?'selected':''}>5ml</option>
        <option value="10" ${talla==='10'?'selected':''}>10ml</option>
      </select>
    </div>
    <div class="form-group">
      <label>Cantidad</label>
      <input type="number" class="form-control p-cant" id="sel-c-${id}" value="${cant}" min="${vendidos > 0 ? vendidos : 1}">
    </div>
    <div class="form-group">
      <label>Precio $</label>
      <input type="number" class="form-control p-precio" id="sel-pr-${id}" value="${precio}" placeholder="Ej. 350" min="0">
    </div>
    <div style="padding-bottom:5px;">
      <button class="btn-icon" style="color:#ef4444" onclick="document.getElementById('item-row-${id}').remove()" ${vendidos > 0 ? 'disabled title="Ya tiene ventas"' : ''}><i class="bi bi-trash"></i></button>
    </div>
  `;
  document.getElementById('items-container').appendChild(div);
};

window.guardarLote = async () => {
  const editId = document.getElementById('c-edit-id').value;
  const lugar = document.getElementById('c-lugar').value.trim();
  if (!lugar) return Swal.fire('Error', 'Ingresa el nombre del lugar', 'error');
  
  const rows = document.querySelectorAll('.item-row');
  if (rows.length === 0) return Swal.fire('Error', 'Añade al menos un perfume', 'error');
  
  let items = [];
  for (let row of rows) {
    const selP = row.querySelector('.p-sel');
    const selT = row.querySelector('.p-talla');
    const selC = row.querySelector('.p-cant');
    const selPr = row.querySelector('.p-precio');
    const selV = row.querySelector('.p-vendidos');
    
    if (!selP.value) continue;
    const p = perfumes.find(x => x.id === selP.value);
    
    items.push({
      perfumeId: p.id,
      perfumeNombre: p.nombre,
      perfumeMarca: p.marca,
      talla: selT.value,
      cantidad: parseInt(selC.value) || 1,
      precio: parseFloat(selPr.value) || null,
      vendidos: parseInt(selV.value) || 0
    });
  }
  
  if (items.length === 0) return Swal.fire('Error', 'Lote vacío', 'error');
  
  document.getElementById('btn-save').disabled = true;
  document.getElementById('btn-save').innerHTML = 'Guardando...';
  
  try {
    if (editId) {
      await updateDoc(doc(db, 'consignaciones', editId), { lugar, items });
      Swal.fire('¡Éxito!', 'Lote actualizado', 'success');
    } else {
      const data = {
        lugar,
        estado: 'Abierto',
        creadoEn: Date.now(),
        items
      };
      await addDoc(collection(db, 'consignaciones'), data);
      Swal.fire('¡Éxito!', 'Lote de consignación creado', 'success');
    }
    
    closeModal();
    loadData();
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo guardar: ' + e.message, 'error');
  } finally {
    document.getElementById('btn-save').disabled = false;
    document.getElementById('btn-save').innerHTML = '<i class="bi bi-check2"></i> Guardar Lote';
  }
};

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
    // 1. Create standard venta record for financial tracking
    const ventaData = {
      creadoEn: Date.now(),
      perfumeId: item.perfumeId,
      perfumeNombre: item.perfumeNombre,
      perfumeMarca: item.perfumeMarca,
      talla: item.talla,
      cantidad: 1,
      precio: precio,
      canal: 'consignacion',
      cliente: lote.lugar,
      estado: 'pagada',
      // El resto del sistema lee `metodoPago`; con `metodo` este dato se
      // perdía en el historial y en las estadísticas.
      metodoPago: 'efectivo'
    };
    await addDoc(collection(db, 'ventas'), ventaData);
    
    // 2. Increment sold counter in consignment
    lote.items[itemIdx].vendidos += 1;
    await updateDoc(doc(db, 'consignaciones', loteId), { items: lote.items });
    
    Swal.fire('Venta Registrada', 'El ingreso se reflejará en tus estadísticas.', 'success');
    renderLotes();
  } catch(e) {
    console.error(e);
    Swal.fire('Error', e.message, 'error');
  }
};

window.cerrarLote = async (loteId) => {
  const result = await Swal.fire({
    title: '¿Terminar lote?',
    text: "Ya no podrás registrar más ventas de este lote. Los decants no vendidos se considerarán devueltos a tu inventario.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, terminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#C9A84C'
  });
  
  if (result.isConfirmed) {
    try {
      await updateDoc(doc(db, 'consignaciones', loteId), { estado: 'Cerrado' });
      Swal.fire('Lote Cerrado', '', 'success');
      loadData();
    } catch(e) {
      console.error(e);
      Swal.fire('Error', e.message, 'error');
    }
  }
};

window.eliminarLote = async (loteId) => {
  const result = await Swal.fire({
    title: '¿Eliminar lote permanentemente?',
    text: "Esta acción no se puede deshacer. (No afectará las ventas que ya hayas liquidado)",
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444'
  });
  
  if (result.isConfirmed) {
    try {
      await deleteDoc(doc(db, 'consignaciones', loteId));
      Swal.fire('Lote eliminado', '', 'success');
      loadData();
    } catch(e) {
      console.error(e);
      Swal.fire('Error', e.message, 'error');
    }
  }
};
