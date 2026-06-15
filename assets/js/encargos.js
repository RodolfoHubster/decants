import { db } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

renderSidebar('encargos');

const COL = 'ordenes_completos';
let items = [];

// ── Cargar ────────────────────────────────────────────────
async function load() {
  const snap = await getDocs(collection(db, COL));
  items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
  updateStats();
  renderTable();
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
  const q  = document.getElementById('search').value.toLowerCase();
  const fe = document.getElementById('f-estado').value;

  const filtered = items.filter(i => {
    const txt = `${i.perfume} ${i.marca} ${i.cliente}`.toLowerCase();
    return (!q || txt.includes(q)) && (!fe || i.estado === fe);
  });

  document.getElementById('count-label').textContent = `${filtered.length} encargo${filtered.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted,#888)"><i class="bi bi-clock-history" style="font-size:28px;display:block;margin-bottom:8px"></i>No hay encargos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    const fecha = e.creadoEn?.seconds
      ? new Date(e.creadoEn.seconds * 1000).toLocaleDateString('es-MX')
      : '—';
    const precio = e.precio ? `$${Number(e.precio).toLocaleString()}` : '—';
    const waBtn = e.contacto
      ? `<button class="whatsapp-btn" onclick='sendWA(${JSON.stringify(e)})'><i class="bi bi-whatsapp"></i> WA</button>`
      : '';
    return `<tr>
      <td style="font-weight:500">${e.perfume || '—'}<br><span class="resumen-encargo">${e.concentracion || ''}</span></td>
      <td>${e.marca || '—'}</td>
      <td>${e.tamano || '—'}</td>
      <td>${e.cliente || '—'}</td>
      <td style="font-size:12px">${e.contacto || '—'}<br>${waBtn}</td>
      <td>${precio}</td>
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
};

// ── Cambiar estado directo desde tabla ────────────────────
window.changeEstado = async function (id, estado) {
  await updateDoc(doc(db, COL, id), { estado, actualizadoEn: serverTimestamp() });
  const item = items.find(i => i.id === id);
  if (item) item.estado = estado;
  updateStats();
  renderTable();
};

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
  document.getElementById('e-contacto').value    = e?.contacto || '';
  document.getElementById('e-precio').value      = e?.precio || '';
  document.getElementById('e-estado').value      = e?.estado || 'pendiente';
  document.getElementById('e-notas').value       = e?.notas || '';
  document.getElementById('modal').classList.add('open');
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
      contacto: document.getElementById('e-contacto').value.trim(),
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

// ── Eliminar ──────────────────────────────────────────────
window.remove = async function (id) {
  if (!confirm('¿Eliminar este encargo?')) return;
  await deleteDoc(doc(db, COL, id));
  await load();
};

load();
