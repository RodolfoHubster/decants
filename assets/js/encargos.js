import { db, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

renderSidebar('encargos');

const COL = 'ordenes_completos';
let items = [];
let currentPage = 1;
let pageSize = 10;
let currentView = localStorage.getItem('encargos_view') || 'table';

// ── Cargar ────────────────────────────────────────────────
async function load() {
  const snap = await getDocs(collection(db, COL));
  items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
  updateStats();
  setView(currentView);
}

function updateStats() {
  const keys = ['pendiente','buscando','conseguido','avisado','entregado'];
  keys.forEach(k => {
    const el = document.getElementById(`s-${k}`);
    if (el) el.textContent = items.filter(i => i.estado === k).length;
  });
}

// ── Render ────────────────────────────────────────────────
window.renderTable = function () {
  if (currentView === 'kanban') {
    renderKanban();
    return;
  }
  const q  = document.getElementById('search').value.toLowerCase();
  const fe = document.getElementById('f-estado').value;

  const filtered = items.filter(i => {
    const txt = `${i.perfume} ${i.marca} ${i.cliente}`.toLowerCase();
    return (!q || txt.includes(q)) && (!fe || i.estado === fe);
  });

  // Pagination calculations
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  document.getElementById('count-label').textContent = `${total} encargo${total !== 1 ? 's' : ''}`;

  // Render table rows
  const tbody = document.getElementById('tbody');
  if (!pageItems.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted,#888)"><i class="bi bi-clock-history" style="font-size:28px;display:block;margin-bottom:8px"></i>No hay encargos registrados</td></tr>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = pageItems.map(e => {
    const fecha = e.creadoEn?.seconds ? new Date(e.creadoEn.seconds * 1000).toLocaleDateString('es-MX') : '—';
    
    // Price and Adelanto
    const precioBase = e.precio || 0;
    const adelanto = e.adelanto || 0;
    const restan = precioBase - adelanto;
    const precioStr = `$${precioBase.toLocaleString()}`;
    const restanStr = adelanto > 0 ? `<br><span style="font-size:11px;color:var(--accent);font-weight:600">Restan: $${restan.toLocaleString()}</span>` : '';

    // Contact
    let contactHTML = '—';
    if (e.contacto) {
      const medio = e.medio || 'whatsapp';
      if (medio === 'whatsapp') {
        contactHTML = `<div style="display:flex;flex-direction:column;gap:4px">
          <span><i class="bi bi-whatsapp" style="color:#25d366"></i> ${e.contacto}</span>
          <button class="whatsapp-btn" onclick='sendWA(${JSON.stringify(e)})'><i class="bi bi-whatsapp"></i> Enviar WA</button>
        </div>`;
      } else if (medio === 'instagram') {
        const clean = e.contacto.replace('@', '');
        contactHTML = `<a href="https://instagram.com/${clean}" target="_blank" style="color:var(--accent);display:inline-flex;align-items:center;gap:4px">
          <i class="bi bi-instagram" style="color:#e1306c"></i> ${e.contacto}
        </a>`;
      } else if (medio === 'tiktok') {
        const clean = e.contacto.replace('@', '');
        contactHTML = `<a href="https://tiktok.com/@${clean}" target="_blank" style="color:var(--accent);display:inline-flex;align-items:center;gap:4px">
          <i class="bi bi-tiktok" style="color:#fff"></i> ${e.contacto}
        </a>`;
      } else if (medio === 'messenger') {
        let href = e.contacto.startsWith('http') ? e.contacto : `https://facebook.com/search/top/?q=${encodeURIComponent(e.contacto)}`;
        contactHTML = `<a href="${href}" target="_blank" style="color:var(--accent);display:inline-flex;align-items:center;gap:4px">
          <i class="bi bi-facebook" style="color:#1877f2"></i> ${e.contacto}
        </a>`;
      } else {
        contactHTML = `<span><i class="bi bi-person"></i> ${e.contacto}</span>`;
      }
    }

    // Notes
    const notasStr = e.notas
      ? `<br><span style="font-size:11.5px;color:var(--text-muted,#888);font-style:italic"><i class="bi bi-sticky" style="font-size:10px"></i> ${e.notas}</span>`
      : '';

    return `<tr>
      <td><input type="checkbox" class="row-select" data-id="${e.id}"/></td>
      <td style="font-weight:500">
        ${e.perfume || '—'}<br>
        <span class="resumen-encargo">${e.concentracion || ''}</span>
        ${notasStr}
      </td>
      <td>${e.marca || '—'}</td>
      <td>${e.tamano || '—'}</td>
      <td>${e.cliente || '—'}</td>
      <td style="font-size:12px">${contactHTML}</td>
      <td>${precioStr}${restanStr}</td>
      <td>
        <select class="estado-badge estado-${e.estado} estado-select" onchange='changeEstado(${JSON.stringify(e.id)}, this.value)'>
          <option value="pendiente"  ${e.estado==='pendiente'  ?'selected':''}>⏳ Pendiente</option>
          <option value="buscando"   ${e.estado==='buscando'   ?'selected':''}>🔍 Buscando</option>
          <option value="conseguido" ${e.estado==='conseguido' ?'selected':''}>✅ Conseguido</option>
          <option value="avisado"    ${e.estado==='avisado'    ?'selected':''}>📱 Avisado</option>
          <option value="entregado"  ${e.estado==='entregado'  ?'selected':''}>📦 Entregado</option>
          <option value="cancelado"  ${e.estado==='cancelado'  ?'selected':''}>❌ Cancelado</option>
        </select>
      </td>
      <td style="font-size:12px">${fecha}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick='edit(${JSON.stringify(e.id)})'><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline" style="color:#ef4444" onclick='remove(${JSON.stringify(e.id)})'><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  renderPagination(totalPages);
};

// ── Cambiar estado directo desde tabla ────────────────────
window.changeEstado = async function (id, estado) {
  await updateDoc(doc(db, COL, id), { estado, actualizadoEn: serverTimestamp() });
  const item = items.find(i => i.id === id);
  if (item) item.estado = estado;
  updateStats();
  renderTable();
};

// ── Bulk actions ─────────────────────────────────────
window.applyBulkAction = function () {
  const action = document.getElementById('bulk-action').value;
  if (!action) return;
  const selected = Array.from(document.querySelectorAll('.row-select:checked')).map(el => el.dataset.id);
  if (!selected.length) { alert('Selecciona al menos un encargo.'); return; }
  if (action === 'export') {
    // Simple CSV export
    const rows = items.filter(i => selected.includes(i.id));
    const csv = ['Perfume,Marca,Tamaño,Cliente,Contacto,Precio,Estado,Fecha'];
    rows.forEach(i => {
      const fecha = i.creadoEn?.seconds ? new Date(i.creadoEn.seconds * 1000).toLocaleDateString('es-MX') : '';
      csv.push(`"${i.perfume}","${i.marca}","${i.tamano}","${i.cliente}","${i.contacto}","${i.precio}","${i.estado}","${fecha}"`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'encargos.csv'; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (action === 'cancelado') {
    if (!confirm('¿Eliminar los encargos seleccionados?')) return;
    Promise.all(selected.map(id => deleteDoc(doc(db, COL, id)))).then(() => load());
    return;
  }
  // status change actions
  Promise.all(selected.map(id => updateDoc(doc(db, COL, id), { estado: action, actualizadoEn: serverTimestamp() })))
    .then(() => load());
};

// Change page size
window.changePageSize = function (size) {
  pageSize = parseInt(size, 10) || 10;
  currentPage = 1;
  renderTable();
};

// Render pagination controls
function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    const active = p === currentPage ? 'active' : '';
    html += `<button class="btn btn-sm ${active}" onclick="goToPage(${p})">${p}</button>`;
  }
  container.innerHTML = html;
}

window.goToPage = function (p) {
  currentPage = p;
  renderTable();
};

// Select-all handling
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'select-all') {
    const checked = e.target.checked;
    document.querySelectorAll('.row-select').forEach(cb => cb.checked = checked);
  }
});

// ── WhatsApp ──────────────────────────────────────────────
window.sendWA = function (e) {
  const msg = encodeURIComponent(
    `¡Hola ${e.cliente}! 👋\n` +
    `Te avisamos que ya conseguimos tu pedido:\n` +
    `🌿 *${e.perfume}* ${e.concentracion ? '(' + e.concentracion + ')' : ''} — ${e.tamano}\n` +
    `💰 Precio: $${Number(e.precio || 0).toLocaleString()} MXN\n\n` +
    `¿Cuándo puedes pasar a recogerlo? 😊`
  );
  const num = e.contacto.replace(/\D/g,'');
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
};

// ── Modal ─────────────────────────────────────────────────
window.openModal = function (id = null) {
  const e = id ? items.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = e ? 'Editar Encargo' : 'Nuevo Encargo';
  document.getElementById('e-id').value          = e?.id || '';
  document.getElementById('e-perfume').value     = e?.perfume || '';
  document.getElementById('e-marca').value       = e?.marca || '';
  document.getElementById('e-tamano').value      = e?.tamano || '';
  document.getElementById('e-concentracion').value = e?.concentracion || '';
  document.getElementById('e-cliente').value     = e?.cliente || '';
  document.getElementById('e-medio').value       = e?.medio || 'whatsapp';
  document.getElementById('e-contacto').value    = e?.contacto || '';
  document.getElementById('e-adelanto').value    = e?.adelanto || 0;
  document.getElementById('e-precio').value      = e?.precio || '';
  document.getElementById('e-estado').value      = e?.estado || 'pendiente';
  document.getElementById('e-notas').value       = e?.notas || '';

  window.actualizarContactoPlaceholder();

  document.getElementById('modal').classList.add('open');
};

window.actualizarContactoPlaceholder = function () {
  const medio = document.getElementById('e-medio').value;
  const lbl = document.getElementById('lbl-contacto');
  const input = document.getElementById('e-contacto');
  if (!lbl || !input) return;

  if (medio === 'whatsapp') {
    lbl.textContent = 'Teléfono (WhatsApp) *';
    input.placeholder = '+52 999 000 0000';
  } else if (medio === 'instagram') {
    lbl.textContent = 'Usuario de Instagram *';
    input.placeholder = '@usuario';
  } else if (medio === 'messenger') {
    lbl.textContent = 'Facebook / Messenger *';
    input.placeholder = 'Nombre o Link';
  } else if (medio === 'tiktok') {
    lbl.textContent = 'Usuario de TikTok *';
    input.placeholder = '@usuario';
  } else {
    lbl.textContent = 'Detalles de contacto *';
    input.placeholder = 'Email, teléfono, etc.';
  }
};

window.edit = (id) => openModal(id);

window.closeModal = function () {
  document.getElementById('modal').classList.remove('open');
};

// ── Guardar ───────────────────────────────────────────────
window.save = async function () {
  const btn = document.getElementById('btn-save');
  const perfume = document.getElementById('e-perfume').value.trim();
  const marca   = document.getElementById('e-marca').value.trim();
  const tamano  = document.getElementById('e-tamano').value;
  const cliente = document.getElementById('e-cliente').value.trim();

  if (!perfume || !marca || !tamano || !cliente) {
    alert('Perfume, marca, tamaño y cliente son obligatorios.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

  try {
    const data = {
      perfume, marca,
      tamano,
      concentracion: document.getElementById('e-concentracion').value,
      cliente,
      medio: document.getElementById('e-medio').value,
      contacto: document.getElementById('e-contacto').value.trim(),
      adelanto: parseFloat(document.getElementById('e-adelanto').value) || 0,
      precio: parseFloat(document.getElementById('e-precio').value) || 0,
      estado: document.getElementById('e-estado').value,
      notas: document.getElementById('e-notas').value.trim(),
      actualizadoEn: serverTimestamp()
    };

    const id = document.getElementById('e-id').value;
    if (id) {
      await updateDoc(doc(db, COL, id), data);
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, COL), data);
    }

    closeModal();
    await load();
  } catch (err) {
    console.error(err);
    alert('Error al guardar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar Encargo';
  }
};

// ── View Switcher & Kanban Board Helpers ─────────────────────────────────────
window.setView = function (view) {
  currentView = view;
  localStorage.setItem('encargos_view', view);
  
  const tableContainer = document.getElementById('table-container');
  const kanbanContainer = document.getElementById('kanban-container');
  const btnTable = document.getElementById('btn-view-table');
  const btnKanban = document.getElementById('btn-view-kanban');
  const bulkRow = document.querySelector('.toolbar');
  
  if (view === 'kanban') {
    if (tableContainer) tableContainer.style.display = 'none';
    if (kanbanContainer) kanbanContainer.style.display = 'block';
    if (bulkRow) bulkRow.style.display = 'none'; // Hide bulk actions in Kanban view
    if (btnTable) { btnTable.style.background = 'transparent'; btnTable.style.color = 'var(--text-muted)'; btnTable.style.opacity = '0.7'; }
    if (btnKanban) { btnKanban.style.background = 'var(--accent)'; btnKanban.style.color = '#000'; btnKanban.style.opacity = '1'; }
    renderKanban();
  } else {
    if (tableContainer) tableContainer.style.display = 'block';
    if (kanbanContainer) kanbanContainer.style.display = 'none';
    if (bulkRow) bulkRow.style.display = 'flex';
    if (btnTable) { btnTable.style.background = 'var(--accent)'; btnTable.style.color = '#000'; btnTable.style.opacity = '1'; }
    if (btnKanban) { btnKanban.style.background = 'transparent'; btnKanban.style.color = 'var(--text-muted)'; btnKanban.style.opacity = '0.7'; }
    renderTable();
  }
};

window.renderKanban = function () {
  const q  = document.getElementById('search').value.toLowerCase();
  const fe = document.getElementById('f-estado').value;

  const filtered = items.filter(i => {
    const txt = `${i.perfume} ${i.marca} ${i.cliente}`.toLowerCase();
    return (!q || txt.includes(q)) && (!fe || i.estado === fe);
  });

  const columns = ['pendiente', 'buscando', 'conseguido', 'avisado', 'entregado', 'cancelado'];
  const grouped = {};
  columns.forEach(col => grouped[col] = []);

  filtered.forEach(item => {
    if (grouped[item.estado]) {
      grouped[item.estado].push(item);
    } else {
      grouped['pendiente'].push(item);
    }
  });

  columns.forEach(col => {
    const cardsContainer = document.getElementById(`k-cards-${col}`);
    const countBadge = document.getElementById(`k-count-${col}`);
    if (!cardsContainer) return;

    const list = grouped[col];
    if (countBadge) countBadge.textContent = list.length;

    if (!list.length) {
      cardsContainer.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-faint);font-size:11.5px;border:1px dashed var(--border);border-radius:6px">Arrastra aquí</div>`;
      return;
    }

    cardsContainer.innerHTML = list.map(e => {
      const precioBase = e.precio || 0;
      const adelanto = e.adelanto || 0;
      const restan = precioBase - adelanto;
      const precioStr = `$${precioBase.toLocaleString()} MXN`;
      const restanStr = adelanto > 0 ? `<div style="font-size:11px;color:var(--accent);font-weight:600;margin-top:2px">Restan: $${restan.toLocaleString()}</div>` : '';

      // Contact Action Button
      let contactActionBtn = '';
      if (e.contacto) {
        const medio = e.medio || 'whatsapp';
        if (medio === 'whatsapp') {
          contactActionBtn = `<button class="btn btn-xs btn-outline" style="border-color:#25d366;color:#25d366" onclick='sendWA(${JSON.stringify(e)})' title="Enviar WhatsApp"><i class="bi bi-whatsapp"></i></button>`;
        } else if (medio === 'instagram') {
          const clean = e.contacto.replace('@', '');
          contactActionBtn = `<a href="https://instagram.com/${clean}" target="_blank" class="btn btn-xs btn-outline" style="border-color:#e1306c;color:#e1306c;display:inline-flex;align-items:center" title="Abrir Instagram"><i class="bi bi-instagram"></i></a>`;
        } else if (medio === 'tiktok') {
          const clean = e.contacto.replace('@', '');
          contactActionBtn = `<a href="https://tiktok.com/@${clean}" target="_blank" class="btn btn-xs btn-outline" style="border-color:#fff;color:#fff;display:inline-flex;align-items:center" title="Abrir TikTok"><i class="bi bi-tiktok"></i></a>`;
        } else if (medio === 'messenger') {
          let href = e.contacto.startsWith('http') ? e.contacto : `https://facebook.com/search/top/?q=${encodeURIComponent(e.contacto)}`;
          contactActionBtn = `<a href="${href}" target="_blank" class="btn btn-xs btn-outline" style="border-color:#1877f2;color:#1877f2;display:inline-flex;align-items:center" title="Abrir Facebook"><i class="bi bi-facebook"></i></a>`;
        } else {
          contactActionBtn = `<button class="btn btn-xs btn-outline" style="border-color:var(--text-muted);color:var(--text-muted)" onclick="alert('Contacto: ${e.contacto}')" title="Ver contacto"><i class="bi bi-person"></i></button>`;
        }
      }

      // Notes
      const notasStr = e.notas
        ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:6px;border-top:1px dashed var(--border);padding-top:6px;word-break:break-word"><i class="bi bi-sticky"></i> ${e.notas}</div>`
        : '';

      return `<div class="kanban-card" id="card-${e.id}" draggable="true" ondragstart="drag(event)" ondragend="dragEnd(event)">
        <div style="font-weight:600;color:var(--accent);font-size:13px;margin-bottom:4px;word-break:break-word">${e.perfume || '—'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
          ${e.marca || '—'} ${e.concentracion ? '• ' + e.concentracion : ''} ${e.tamano ? '• ' + e.tamano : ''}
        </div>
        <div style="font-size:11.5px;color:var(--text-primary);margin-bottom:8px">
          <i class="bi bi-person" style="color:var(--accent);opacity:0.8"></i> ${e.cliente || '—'}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <div style="font-weight:700;font-size:12px;color:var(--text-primary)">
            ${precioStr}
            ${restanStr}
          </div>
          <div style="display:flex;gap:4px">
            ${contactActionBtn}
            <button class="btn btn-xs btn-outline" onclick='edit(${JSON.stringify(e.id)})'><i class="bi bi-pencil"></i></button>
            <button class="btn btn-xs btn-outline" style="color:#ef4444" onclick='remove(${JSON.stringify(e.id)})'><i class="bi bi-trash"></i></button>
          </div>
        </div>
        ${notasStr}
      </div>`;
    }).join('');
  });
};

// HTML5 Drag and Drop Handlers
window.drag = function (ev) {
  ev.dataTransfer.setData("text/plain", ev.currentTarget.id);
  ev.currentTarget.classList.add('dragging');
};

window.dragEnd = function (ev) {
  ev.currentTarget.classList.remove('dragging');
};

window.allowDrop = function (ev) {
  ev.preventDefault();
};

window.dragEnter = function (ev) {
  ev.preventDefault();
  const container = ev.currentTarget;
  if (container.classList.contains('kanban-cards')) {
    container.classList.add('drag-over');
  }
};

window.dragLeave = function (ev) {
  const container = ev.currentTarget;
  if (container.classList.contains('kanban-cards')) {
    container.classList.remove('drag-over');
  }
};

window.drop = async function (ev) {
  ev.preventDefault();
  const container = ev.currentTarget;
  if (container.classList.contains('kanban-cards')) {
    container.classList.remove('drag-over');
  }

  const idStr = ev.dataTransfer.getData("text/plain");
  const cardEl = document.getElementById(idStr);
  if (!cardEl) return;
  
  const newStatus = container.dataset.status;
  const id = idStr.replace('card-', '');
  
  await window.changeEstado(id, newStatus);
};

// ── Eliminar ──────────────────────────────────────────────
window.remove = async function (id) {
  if (!confirm('¿Eliminar este encargo?')) return;
  await deleteDoc(doc(db, COL, id));
  await load();
};

onAuthStateChanged(auth, user => {
  if (user) load();
});
