import { db } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

renderSidebar('perfumes-completos');

const CLOUD_NAME = 'dxo761td7';
const UPLOAD_PRESET = 'FITOSCENTS-DECANTS';
const COL = 'perfumes_completos';

let items = [];
let imgMode = 'url';
let currentTab = 'activos';

// ── Cargar datos ──────────────────────────────────────────
async function load() {
  const snap = await getDocs(collection(db, COL));
  items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable();
}

// ── Render tabla ──────────────────────────────────────────
window.renderTable = function () {
  const q   = document.getElementById('search').value.toLowerCase();
  const gen = document.getElementById('f-genero').value;
  const con = document.getElementById('f-concentracion').value;
  const dis = document.getElementById('f-disponibilidad').value;

  const filtered = items.filter(p => {
    const txt = `${p.nombre} ${p.marca}`.toLowerCase();
    const isAgotado = p.disponibilidad === 'agotado';
    const isActivo = p.activo !== false;

    if (currentTab === 'activos') {
      if (!isActivo || isAgotado) return false;
    } else {
      if (isActivo && !isAgotado) return false;
    }

    return (!q || txt.includes(q))
        && (!gen || p.genero === gen)
        && (!con || p.concentracion === con)
        && (!dis || p.disponibilidad === dis);
  });

  document.getElementById('count-label').textContent = `${filtered.length} perfume${filtered.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted,#888)"><i class="bi bi-bag-heart" style="font-size:28px;display:block;margin-bottom:8px"></i>No se encontraron perfumes completos</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const precios = buildPreciosHTML(p.precios || {});
    const dispClass = p.disponibilidad === 'en-stock' ? 'en-stock' : p.disponibilidad === 'bajo-pedido' ? 'bajo-pedido' : 'agotado';
    const dispLabel = p.disponibilidad === 'en-stock' ? '✅ En Stock' : p.disponibilidad === 'bajo-pedido' ? '🕐 Bajo Pedido' : '❌ Agotado';
    const archiveBtn = p.activo !== false
      ? `<button class="btn btn-sm btn-outline" onclick="toggleActivo('${p.id}', false)" title="Archivar (Ocultar)"><i class="bi bi-eye-slash"></i></button>`
      : `<button class="btn btn-sm btn-outline" style="color:var(--accent)" onclick="toggleActivo('${p.id}', true)" title="Desarchivar (Mostrar)"><i class="bi bi-eye"></i></button>`;

    return `<tr>
      <td><img src="${p.imagen || ''}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#222" onerror="this.src=''"></td>
      <td style="font-weight:500">${p.nombre || '—'}</td>
      <td>${p.marca || '—'}</td>
      <td><span class="concentracion-badge">${p.concentracion || '—'}</span></td>
      <td>${p.genero || '—'}</td>
      <td><span class="stock-badge ${dispClass}">${dispLabel}</span></td>
      <td style="font-size:12px">${precios}</td>
      <td>
        <div style="display:flex;gap:4px">
          ${archiveBtn}
          <button class="btn btn-sm btn-outline" onclick='edit(${JSON.stringify(p.id)})'><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline" style="color:#ef4444" onclick='remove(${JSON.stringify(p.id)})'><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

function buildPreciosHTML(precios) {
  const map = {px30:'30ml',px50:'50ml',px75:'75ml',px100:'100ml',px150:'150ml',px200:'200ml'};
  return Object.entries(map)
    .filter(([k]) => precios[k] && precios[k] > 0)
    .map(([k, lbl]) => `<span style="white-space:nowrap">${lbl}: $${Number(precios[k]).toLocaleString()}</span>`)
    .join('<br>') || '—';
}

// ── Modal ─────────────────────────────────────────────────
window.openModal = function (id = null) {
  const p = id ? items.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = p ? 'Editar Perfume' : 'Nuevo Perfume Completo';
  document.getElementById('p-id').value           = p?.id || '';
  document.getElementById('p-nombre').value       = p?.nombre || '';
  document.getElementById('p-marca').value        = p?.marca || '';
  document.getElementById('p-concentracion').value = p?.concentracion || '';
  document.getElementById('p-genero').value       = p?.genero || '';
  document.getElementById('p-original').checked   = p?.original !== false;
  document.getElementById('p-sellada').checked    = p?.sellada !== false;
  document.getElementById('p-batch').value        = p?.batch || '';
  document.getElementById('p-salida').value       = p?.notasSalida || '';
  document.getElementById('p-corazon').value      = p?.notasCorazon || '';
  document.getElementById('p-fondo').value        = p?.notasFondo || '';
  document.getElementById('p-ocasion').value      = p?.ocasion || '';
  document.getElementById('p-longevidad').value   = p?.longevidad || '';
  document.getElementById('p-proyeccion').value   = p?.proyeccion || '';
  document.getElementById('p-disponibilidad').value = p?.disponibilidad || 'en-stock';
  document.getElementById('p-tiempo').value       = p?.tiempoEstimado || '';
  document.getElementById('p-desc').value         = p?.descripcion || '';
  document.getElementById('p-logistica').value    = p?.logistica || '';
  document.getElementById('p-pago').value         = p?.pago || '';
  document.getElementById('p-img-url').value      = p?.imagen || '';
  document.getElementById('p-activo').checked     = p?.activo !== false;

  const pr = p?.precios || {};
  ['30','50','75','100','150','200'].forEach(t => {
    document.getElementById(`px${t}`).value = pr[`px${t}`] || '';
  });

  document.getElementById('preview-img').src = p?.imagen || '';
  document.getElementById('preview-wrap').style.display = p?.imagen ? 'block' : 'none';

  setMode('url');
  toggleTiempo();
  document.getElementById('modal').classList.add('open');
};

window.edit = (id) => openModal(id);

window.closeModal = function () {
  document.getElementById('modal').classList.remove('open');
};

window.toggleTiempo = function () {
  const disp = document.getElementById('p-disponibilidad').value;
  document.getElementById('wrap-tiempo').style.display = disp === 'bajo-pedido' ? 'block' : 'none';
};

// ── Imagen ────────────────────────────────────────────────
window.setMode = function (mode) {
  imgMode = mode;
  document.getElementById('sec-url').style.display  = mode === 'url'  ? 'block' : 'none';
  document.getElementById('sec-file').style.display = mode === 'file' ? 'block' : 'none';
  document.getElementById('btn-url').classList.toggle('active', mode === 'url');
  document.getElementById('btn-file').classList.toggle('active', mode === 'file');
};

window.previewUrl = function () {
  const url = document.getElementById('p-img-url').value.trim();
  const wrap = document.getElementById('preview-wrap');
  document.getElementById('preview-img').src = url;
  wrap.style.display = url ? 'block' : 'none';
};

window.previewFile = function () {
  const file = document.getElementById('p-img-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
};

async function uploadCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'perfumes-completos');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
  const json = await res.json();
  return json.secure_url;
}

// ── Guardar ───────────────────────────────────────────────
window.save = async function () {
  const btn = document.getElementById('btn-save');
  const nombre = document.getElementById('p-nombre').value.trim();
  const marca  = document.getElementById('p-marca').value.trim();
  const conc   = document.getElementById('p-concentracion').value;
  const genero = document.getElementById('p-genero').value;
  const disp   = document.getElementById('p-disponibilidad').value;

  if (!nombre || !marca || !conc || !genero || !disp) {
    alert('Nombre, marca, concentración, género y disponibilidad son obligatorios.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

  try {
    let imagen = document.getElementById('p-img-url').value.trim();
    if (imgMode === 'file') {
      const file = document.getElementById('p-img-file').files[0];
      if (file) imagen = await uploadCloudinary(file);
    }

    const precios = {};
    ['30','50','75','100','150','200'].forEach(t => {
      const v = parseFloat(document.getElementById(`px${t}`).value);
      if (v > 0) precios[`px${t}`] = v;
    });

    const data = {
      nombre, marca,
      concentracion: conc,
      genero,
      disponibilidad: disp,
      tiempoEstimado: disp === 'bajo-pedido' ? document.getElementById('p-tiempo').value.trim() : '',
      original: document.getElementById('p-original').checked,
      sellada: document.getElementById('p-sellada').checked,
      batch: document.getElementById('p-batch').value.trim(),
      notasSalida: document.getElementById('p-salida').value.trim(),
      notasCorazon: document.getElementById('p-corazon').value.trim(),
      notasFondo: document.getElementById('p-fondo').value.trim(),
      ocasion: document.getElementById('p-ocasion').value.trim(),
      longevidad: document.getElementById('p-longevidad').value,
      proyeccion: document.getElementById('p-proyeccion').value,
      descripcion: document.getElementById('p-desc').value.trim(),
      logistica: document.getElementById('p-logistica').value.trim(),
      pago: document.getElementById('p-pago').value.trim(),
      imagen,
      precios,
      activo: document.getElementById('p-activo').checked,
      actualizadoEn: serverTimestamp()
    };

    const id = document.getElementById('p-id').value;
    if (id) {
      await updateDoc(doc(db, COL, id), data);
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, COL), data);
    }

    closeModal();
    await load();
  } catch (e) {
    console.error(e);
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

// ── Eliminar ──────────────────────────────────────────────
window.remove = async function (id) {
  if (!confirm('¿Eliminar este perfume del catálogo?')) return;
  await deleteDoc(doc(db, COL, id));
  await load();
};

// ── Tab view Switcher & Archive helpers ──────────────────────────────────────
window.setCatalogTab = function (tab) {
  currentTab = tab;
  
  const btnActivos = document.getElementById('btn-tab-activos');
  const btnArchivados = document.getElementById('btn-tab-archivados');
  
  if (tab === 'activos') {
    if (btnActivos) { btnActivos.style.background = 'var(--accent)'; btnActivos.style.color = '#000'; btnActivos.style.opacity = '1'; }
    if (btnArchivados) { btnArchivados.style.background = 'transparent'; btnArchivados.style.color = 'var(--text-muted)'; btnArchivados.style.opacity = '0.7'; }
  } else {
    if (btnActivos) { btnActivos.style.background = 'transparent'; btnActivos.style.color = 'var(--text-muted)'; btnActivos.style.opacity = '0.7'; }
    if (btnArchivados) { btnArchivados.style.background = 'var(--accent)'; btnArchivados.style.color = '#000'; btnArchivados.style.opacity = '1'; }
  }
  
  renderTable();
};

window.toggleActivo = async function (id, activo) {
  try {
    await updateDoc(doc(db, COL, id), { activo, actualizadoEn: serverTimestamp() });
    const p = items.find(x => x.id === id);
    if (p) p.activo = activo;
    renderTable();
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  }
};

load();
