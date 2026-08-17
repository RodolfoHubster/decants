import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onAuthStateChanged }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import { auth } from './firebase-config.js';
import '../../admin/auth-guard.js';
import { imgThumb } from './cloudinary.js';
import { matchSearch } from './search-engine.js';

const CLOUDINARY_CLOUD  = 'dxo761td7';
const CLOUDINARY_PRESET = 'FITOSCENTS-DECANTS';
const CLOUDINARY_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('folder', 'fitoscents/paquetes');
  const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Error al subir imagen');
  }
  return (await res.json()).secure_url;
}

renderSidebar('paquetes');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let paquetes = [], perfumes = [], imgMode = 'url';
let paqueteItems = []; // List of selected perfumes for the current package

async function loadAll() {
  const [pq, pf] = await Promise.all([
    getDocs(collection(db, 'paquetes')),
    getDocs(collection(db, 'perfumes'))
  ]);

  perfumes = []; 
  pf.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
  perfumes.sort((a, b) => a.nombre.localeCompare(b.nombre));

  paquetes = [];
  pq.forEach(d => paquetes.push({ id: d.id, ...d.data() }));
  paquetes.sort((a, b) => a.nombre.localeCompare(b.nombre));

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  const countLabel = document.getElementById('count-label');
  
  const qEl = document.getElementById('q');
  const q = qEl ? qEl.value.toLowerCase().trim() : '';
  
  const eEl = document.getElementById('f-estado');
  const estado = eEl ? eEl.value : 'todos';
  
  const cEl = document.getElementById('f-cat');
  const cat = cEl ? cEl.value : 'todos';
  
  const oEl = document.getElementById('f-orden');
  const orden = oEl ? oEl.value : 'recientes';

  let f = paquetes.filter(p => {
    if (q && !matchSearch(q, p.nombre)) return false;
    
    if (estado === 'activos' && p.activo === false) return false;
    if (estado === 'ocultos' && p.activo !== false) return false;

    if (cat !== 'todos') {
      const pCat = p.categoria || '';
      if (cat === 'mixto' && pCat !== '') return false;
      if (cat !== 'mixto' && pCat !== cat) return false;
    }
    return true;
  });

  if (orden === 'az') f.sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (orden === 'za') f.sort((a,b) => b.nombre.localeCompare(a.nombre));
  if (orden === 'recientes') f.sort((a,b) => (b.creadoEn || 0) - (a.creadoEn || 0));

  if (countLabel) countLabel.textContent = `${f.length} paquete${f.length !== 1 ? 's' : ''}`;

  if (!f.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-faint)">No se encontraron paquetes con estos filtros</td></tr>';
    return;
  }

  tbody.innerHTML = f.map(p => {
    let bundleInfo = '';
    let bundleBtn = '';
    let packageIsAgotado = false;
    let itemsAgotados = 0;

    if (p.items && p.items.length > 0) {
      const itemsHtml = p.items.map(i => {
        let isAgotado = false;
        let subPerf = perfumes.find(x => x.id === i.id || x.nombre === i.nombre);
        if (subPerf && subPerf.estadoStock === 'agotado') {
          isAgotado = true;
          itemsAgotados++;
        }
        return `
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:var(--text-primary); font-size:12px;">↳ ${i.nombre} <span style="color:var(--text-muted); font-size:11px;">(${i.marca||''})</span>
          ${isAgotado ? '<span class="badge badge-danger" style="margin-left:4px;font-size:9px;padding:2px 4px">Agotado</span>' : ''}
          </span>
        </div>
      `}).join('');
      
      bundleInfo = `<div id="sub-pkg-${p.id}" style="display:none; margin-top:8px; padding:8px 12px; background:var(--bg-card2); border-radius:6px; border:1px solid rgba(255,255,255,0.05);">${itemsHtml}</div>`;
      bundleBtn = `<button class="btn-icon" onclick="const e = document.getElementById('sub-pkg-${p.id}'); e.style.display = e.style.display === 'none' ? 'block' : 'none';" title="Ver fragancias" style="margin-left:8px; background:rgba(201,168,76,0.1); color:var(--gold); width:24px; height:24px; border-radius:50%; font-size:10px;"><i class="bi bi-chevron-down"></i></button>`;
      
      if (p.esPersonalizable) {
        if ((p.items.length - itemsAgotados) < (p.maxSeleccion || 3)) {
          packageIsAgotado = true;
        }
      } else {
        if (itemsAgotados > 0) packageIsAgotado = true;
      }
    }
    
    return `
    <tr style="${p.activo === false ? 'opacity:0.5' : ''}">
      <td>
        <div style="width:40px;height:40px;border-radius:6px;background:var(--bg-card2);overflow:hidden;flex-shrink:0;">
          ${p.imagen ? `<img src="${imgThumb(p.imagen)}" style="width:100%;height:100%;object-fit:cover">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-faint)"><i class="bi bi-box2-heart"></i></div>'}
        </div>
      </td>
      <td>
        <div style="display:flex; align-items:center;">
          <strong style="font-weight:600">${p.nombre}</strong>
          ${bundleBtn}
        </div>
        ${bundleInfo}
      </td>
      <td style="font-size:12px;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.descripcion || '-'}</td>
      <td>
        ${p.precios ? Object.entries(p.precios).filter(([,v]) => v > 0).map(([k,v]) => `<div style="font-size:13px"><span style="font-weight:600;width:35px;display:inline-block">${k} ml</span> <span style="color:var(--accent);font-weight:600">$${v} MXN</span></div>`).join('') : `<div style="font-size:13px"><span style="font-weight:600;width:35px;display:inline-block">${p.ml} ml</span> <span style="color:var(--accent);font-weight:600">$${p.precio} MXN</span></div>`}
        <div style="font-size:11px;color:var(--text-faint);margin-top:4px;">${p.items?.length || 0} fragancias permitidas</div>
      </td>
      <td>${packageIsAgotado ? '<span class="badge badge-danger">Agotado</span>' : (p.activo === false ? '<span class="badge badge-warning"><i class="bi bi-eye-slash"></i> Oculto</span>' : '<span class="badge badge-gold">Activo</span>')}</td>
      <td>
        <button class="btn-icon" onclick="edit('${p.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon" onclick="toggleV('${p.id}', ${p.activo!==false})" style="color:${p.activo!==false?'var(--text-muted)':'#22c55e'}"><i class="bi ${p.activo!==false?'bi-eye-slash':'bi-eye'}"></i></button>
        <button class="btn-icon" onclick="del('${p.id}', '${p.nombre}')" style="color:#ef4444"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `}).join('');
}

window.setMode = (m) => {
  imgMode = m;
  document.getElementById('sec-url').style.display = m === 'url' ? 'block' : 'none';
  document.getElementById('sec-file').style.display = m === 'file' ? 'block' : 'none';
  document.getElementById('btn-url').classList.toggle('active', m === 'url');
  document.getElementById('btn-file').classList.toggle('active', m === 'file');
};

window.previewUrl = () => {
  const ds = localStorage.getItem('adminDataSaver') === '1';
  const url = document.getElementById('p-img-url').value.trim();
  if (ds) {
    document.getElementById('preview-wrap').style.display = 'none';
    return;
  }
  document.getElementById('preview-img').src = url;
  document.getElementById('preview-wrap').style.display = url ? 'block' : 'none';
};

window.previewFile = () => {
  const ds = localStorage.getItem('adminDataSaver') === '1';
  const f = document.getElementById('p-img-file').files[0];
  if (!f) return;
  if (ds) {
    document.getElementById('preview-wrap').style.display = 'none';
    return;
  }
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-wrap').style.display = 'block';
  };
  r.readAsDataURL(f);
};

/**
 * Deja el formulario en blanco.
 *
 * Lo usan tanto "Nuevo" como "Editar": antes sólo limpiaba el alta, y al
 * editar sobrevivían restos del paquete anterior —el texto del buscador de
 * perfumes y, peor, el archivo de imagen ya elegido, que podía terminar
 * subiéndose al paquete equivocado—.
 */
function limpiarFormulario() {
  document.getElementById('p-id').value = '';
  document.getElementById('p-nombre').value = '';
  ['3','5','10'].forEach(k => document.getElementById('px'+k).value = '');
  document.getElementById('p-cat').value = '';
  document.getElementById('p-desc').value = '';
  document.getElementById('p-activo').checked = true;

  document.getElementById('p-personalizable').checked = false;
  document.getElementById('p-max-sel').value = '';
  window.togglePersonalizable();

  paqueteItems = [];
  renderPaqueteItems();

  // Imagen: modo, URL y archivo. Si el archivo no se limpia, al guardar otro
  // paquete se sube la foto que quedó seleccionada la vez anterior.
  setMode('url');
  document.getElementById('p-img-url').value = '';
  document.getElementById('p-img-file').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('preview-wrap').style.display = 'none';

  // Buscador de perfumes y su lista de sugerencias.
  const buscador = document.getElementById('search-perfume');
  if (buscador) buscador.value = '';
  const sug = document.getElementById('sugerencias-box');
  if (sug) sug.style.display = 'none';
}

window.openModal = () => {
  limpiarFormulario();
  document.getElementById('modal-title').textContent = 'Nuevo Paquete';
  document.getElementById('modal').classList.add('open');
};

window.closeModal = () => {
  document.getElementById('modal').classList.remove('open');
  document.getElementById('sugerencias-box').style.display = 'none';
};

window.edit = (id) => {
  const p = paquetes.find(x => x.id === id);
  if (!p) return;

  // Partir de cero antes de cargar: así no queda nada del paquete anterior.
  limpiarFormulario();

  document.getElementById('p-id').value = p.id;
  document.getElementById('p-nombre').value = p.nombre;

  if (p.precios) {
    ['3','5','10'].forEach(k => { document.getElementById('px'+k).value = p.precios[k] || ''; });
  } else if (p.ml && p.precio) {
    const mlStr = String(p.ml);
    const input = document.getElementById('px' + mlStr);
    if (input) input.value = p.precio;
  }
  
  document.getElementById('p-cat').value = p.categoria || '';
  document.getElementById('p-desc').value = p.descripcion || '';
  document.getElementById('p-activo').checked = p.activo !== false;
  
  document.getElementById('p-personalizable').checked = p.esPersonalizable === true;
  document.getElementById('p-max-sel').value = p.maxSeleccion || '';
  window.togglePersonalizable();
  
  paqueteItems = [...(p.items || [])];
  renderPaqueteItems();

  if (p.imagen) {
    setMode('url');
    document.getElementById('p-img-url').value = p.imagen;
    previewUrl();
  } else {
    document.getElementById('preview-wrap').style.display = 'none';
  }
  
  document.getElementById('modal-title').textContent = 'Editar Paquete';
  document.getElementById('modal').classList.add('open');
};

window.togglePersonalizable = () => {
  const isPers = document.getElementById('p-personalizable').checked;
  document.getElementById('pers-options').style.display = isPers ? 'block' : 'none';
  document.getElementById('lbl-perfumes').textContent = isPers ? 'Opciones disponibles para el cliente *' : 'Perfumes incluidos en el paquete *';
};

// ── Lógica de búsqueda y agregado de perfumes ──
const searchInput = document.getElementById('search-perfume');
const sugBox = document.getElementById('sugerencias-box');
const sugList = document.getElementById('sugerencias-list');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) {
    sugBox.style.display = 'none';
    return;
  }
  
  // Los que ya están en el paquete no se ofrecen: sólo estorbaban, porque
  // al elegirlos lo único que pasaba era un aviso de "ya está agregado".
  const yaEnPaquete = new Set(paqueteItems.map(i => i.id));
  const coincidencias = perfumes.filter(p =>
    p.activo !== false && matchSearch(q, p.nombre + ' ' + (p.marca || '')));
  // Se recorta a 10 después de descartar, para no perder resultados válidos.
  const matches = coincidencias.filter(p => !yaEnPaquete.has(p.id)).slice(0, 10);

  if (matches.length === 0) {
    // Distinguir "no hay" de "ya los tienes todos" evita que parezca un error.
    const mensaje = coincidencias.length
      ? 'Ya agregaste todos los que coinciden'
      : 'No se encontraron perfumes';
    sugList.innerHTML = `<div style="padding:10px;text-align:center;color:var(--text-faint);font-size:13px;">${mensaje}</div>`;
  } else {
    sugList.innerHTML = matches.map(p => `
      <div class="sug-item" onclick="addPerfumeToPaquete('${p.id}')">
        <div style="width:32px;height:32px;border-radius:4px;background:var(--bg-card2);overflow:hidden;flex-shrink:0;">
          ${p.imagen ? `<img src="${imgThumb(p.imagen)}" style="width:100%;height:100%;object-fit:cover">` : ''}
        </div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${p.nombre}</div>
          <div style="font-size:11px;color:var(--text-muted);">${p.marca || ''}</div>
        </div>
      </div>
    `).join('');
  }
  sugBox.style.display = 'block';
});

// Ocultar sugerencias al hacer clic fuera
document.addEventListener('click', (e) => {
  if (e.target !== searchInput && !sugBox.contains(e.target)) {
    sugBox.style.display = 'none';
  }
});

window.addPerfumeToPaquete = (id) => {
  const p = perfumes.find(x => x.id === id);
  if (!p) return;
  
  if (paqueteItems.find(x => x.id === id)) {
    toast('Este perfume ya está en el paquete', 'info');
    return;
  }
  
  paqueteItems.push({
    id: p.id,
    nombre: p.nombre,
    marca: p.marca || '',
    imagen: p.imagen || ''
  });
  
  searchInput.value = '';
  sugBox.style.display = 'none';
  renderPaqueteItems();
};

window.removePerfumeFromPaquete = (idx) => {
  paqueteItems.splice(idx, 1);
  renderPaqueteItems();
};

function renderPaqueteItems() {
  const listEl = document.getElementById('paquete-items-list');
  const emptyEl = document.getElementById('empty-items');
  
  if (paqueteItems.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-faint);text-align:center;font-size:13px;margin:10px 0;" id="empty-items">No has agregado perfumes aún.</div>';
    return;
  }
  
  listEl.innerHTML = paqueteItems.map((item, i) => `
    <div class="item-selected">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;border-radius:6px;background:var(--bg-card);overflow:hidden;">
          ${item.imagen ? `<img src="${imgThumb(item.imagen)}" style="width:100%;height:100%;object-fit:cover">` : ''}
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${item.nombre}</div>
          <div style="font-size:11px;color:var(--text-muted);">${item.marca}</div>
        </div>
      </div>
      <button class="item-selected-remove" onclick="removePerfumeFromPaquete(${i})"><i class="bi bi-x-circle-fill"></i></button>
    </div>
  `).join('');
}

window.save = async () => {
  const id = document.getElementById('p-id').value;
  const nombre = document.getElementById('p-nombre').value.trim();
  
  const precios = {
    '3':  +document.getElementById('px3').value  || 0,
    '5':  +document.getElementById('px5').value  || 0,
    '10': +document.getElementById('px10').value || 0
  };
  const tamanos = Object.keys(precios).filter(k => precios[k] > 0);
  
  if (!nombre || tamanos.length === 0) {
    toast('Completa el nombre y al menos un precio', 'error');
    return;
  }
  
  if (paqueteItems.length === 0) {
    toast('Agrega al menos un perfume al paquete', 'error');
    return;
  }

  const btnSave = document.getElementById('btn-save');
  btnSave.disabled = true;
  btnSave.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

  try {
    let imagen = '';
    if (imgMode === 'url') {
      imagen = document.getElementById('p-img-url').value.trim();
    } else {
      const file = document.getElementById('p-img-file').files[0];
      if (file) {
        toast('Subiendo imagen a Cloudinary...', 'info');
        imagen = await uploadToCloudinary(file);
      } else {
        const currentImg = document.getElementById('preview-img').src;
        imagen = currentImg.startsWith('data:') ? '' : currentImg;
      }
    }
    
    const isPers = document.getElementById('p-personalizable').checked;
    const data = {
      tipo: 'paquete',
      nombre,
      precios,
      tamanos,
      categoria: document.getElementById('p-cat').value,
      descripcion: document.getElementById('p-desc').value.trim(),
      imagen,
      items: paqueteItems,
      activo: document.getElementById('p-activo').checked,
      esPersonalizable: isPers,
      maxSeleccion: isPers ? (parseInt(document.getElementById('p-max-sel').value) || 1) : null
    };

    if (id) {
      await updateDoc(doc(db, 'paquetes', id), data);
    } else {
      await addDoc(collection(db, 'paquetes'), { ...data, clicks: 0, creadoEn: Date.now() });
    }
    
    toast(id ? 'Paquete actualizado' : 'Paquete creado', 'success');
    closeModal();
    loadAll();
  } catch (e) {
    console.error(e);
    toast('Error: ' + e.message, 'error');
  } finally {
    btnSave.disabled  = false;
    btnSave.innerHTML = '<i class="bi bi-check2"></i> Guardar Paquete';
  }
};

window.toggleV = async (id, activo) => {
  await updateDoc(doc(db, 'paquetes', id), { activo: !activo });
  toast(activo ? 'Paquete ocultado' : 'Paquete visible', 'info');
  loadAll();
};

window.del = async (id, nombre) => {
  if (!confirm('Eliminar ' + nombre + '?')) return;
  await deleteDoc(doc(db, 'paquetes', id));
  toast('Eliminado', 'info');
  loadAll();
};

window.renderTable = renderTable;
window.loadAll = loadAll;

onAuthStateChanged(auth, user => {
  if (user) loadAll();
});
