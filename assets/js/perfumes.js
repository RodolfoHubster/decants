import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';
import { FAMILIAS, TIPOS, buildSelectOptions } from './filtros-config.js';

const CLOUDINARY_CLOUD  = 'dxo761td7';
const CLOUDINARY_PRESET = 'FITOSCENTS-DECANTS';
const CLOUDINARY_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('folder', 'fitoscents/perfumes');
  const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Error al subir imagen');
  }
  return (await res.json()).secure_url;
}

renderSidebar('perfumes');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let perfumes = [], cats = [], marcas = [], imgMode = 'url';

// ── Poblar selects de Familia y Tipo (modal + filtros de tabla) ──────────────
function initFiltrosConfig() {
  // Modal: sin especificar como placeholder
  document.getElementById('p-familia').innerHTML =
    buildSelectOptions(FAMILIAS, '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML =
    buildSelectOptions(TIPOS, '', 'Sin especificar');

  // Filtros de tabla
  const fFamOpts = `<option value="">Todas las familias</option>` +
    FAMILIAS.map(f => `<option value="${f.valor}">${f.label}</option>`).join('');
  document.getElementById('f-familia').innerHTML = fFamOpts;

  const fTipoOpts = `<option value="">Todos los tipos</option>` +
    TIPOS.map(t => `<option value="${t.valor}">${t.label}</option>`).join('');
  document.getElementById('f-tipo').innerHTML = fTipoOpts;
}
initFiltrosConfig();

async function loadAll() {
  const [ps, cs, ms] = await Promise.all([
    getDocs(collection(db, 'perfumes')),
    getDocs(collection(db, 'categorias')),
    getDocs(collection(db, 'marcas'))
  ]);
  cats    = []; cs.forEach(d => cats.push({ id: d.id, ...d.data() }));
  cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
  marcas  = []; ms.forEach(d => marcas.push({ id: d.id, ...d.data() }));
  marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  perfumes = []; ps.forEach(d => perfumes.push({ id: d.id, ...d.data() }));

  const cOpts = cats.map(c => `<option>${c.nombre}</option>`).join('');
  document.getElementById('f-cat').innerHTML   = `<option value="">Todas las categorias</option>${cOpts}`;
  document.getElementById('p-cat').innerHTML   = `<option value="">Selecciona</option>${cOpts}`;
  document.getElementById('f-marca').innerHTML = `<option value="">Todas las marcas</option>` +
    marcas.map(m => `<option>${m.nombre}</option>`).join('');
  renderTable();
}

window.loadMarcas = () => {
  const cat = document.getElementById('p-cat').value;
  const fil = cat ? marcas.filter(m => m.categoria === cat) : marcas;
  document.getElementById('p-marca').innerHTML =
    `<option value="">Selecciona</option>` + fil.map(m => `<option>${m.nombre}</option>`).join('');
};

window.renderTable = () => {
  const q       = document.getElementById('search').value.toLowerCase();
  const fg      = document.getElementById('f-genero').value;
  const fc      = document.getElementById('f-cat').value;
  const fm      = document.getElementById('f-marca').value;
  const ffa     = document.getElementById('f-familia').value;
  const fti     = document.getElementById('f-tipo').value;
  const orden   = document.getElementById('f-orden').value;

  let fil = perfumes.filter(p =>
    (!q   || p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q)) &&
    (!fg  || p.genero === fg) &&
    (!fc  || p.categoria === fc) &&
    (!fm  || p.marca === fm) &&
    (!ffa || p.familia === ffa) &&
    (!fti || p.tipo === fti)
  );

  fil.sort((a, b) => {
    if (orden === 'clicks') return (b.clicks || 0) - (a.clicks || 0);
    if (orden === 'az')     return a.nombre.localeCompare(b.nombre);
    if (orden === 'za')     return b.nombre.localeCompare(a.nombre);
    return 0;
  });

  document.getElementById('count-label').textContent = fil.length + ' perfumes';
  const tb = document.getElementById('tbody');

  if (!fil.length) {
    tb.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="bi bi-droplet"></i><h3>Sin resultados</h3><p>Cambia los filtros o agrega perfumes.</p></div></td></tr>';
    return;
  }

  tb.innerHTML = fil.map(p => {
    const pr = p.precios || {};
    const sinPrecio = !Object.values(pr).some(v => +v > 0);
    const tags = Object.entries(pr)
      .filter(([, v]) => +v > 0)
      .map(([k, v]) => `<span class="badge badge-gold">${k}ml $${v}</span>`).join(' ');
    const oculto = p.activo === false
      ? '<span class="badge badge-danger" style="margin-left:6px">Oculto</span>' : '';
    const clicks = p.clicks > 0
      ? `<span class="clicks-badge"><i class="bi bi-eye"></i> ${p.clicks}</span>`
      : `<span class="clicks-zero">&#8212;</span>`;
    const alertaPrecio = (sinPrecio && p.activo !== false)
      ? `<span class="badge badge-danger" style="margin-left:4px" title="Activo sin precios"><i class="bi bi-exclamation-triangle"></i></span>`
      : '';
    const pid  = p.id;
    const pnom = p.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const actv = p.activo !== false;
    return `<tr>
      <td>${p.imagen ? `<img class="td-img" src="${p.imagen}" alt="" loading="lazy">` : '<div class="td-img-placeholder"><i class="bi bi-droplet"></i></div>'}</td>
      <td><strong>${p.nombre}</strong>${oculto}</td>
      <td><span class="badge badge-gold">${p.marca || '&#8212;'}</span></td>
      <td><span class="badge badge-info">${p.categoria || '&#8212;'}</span></td>
      <td><span class="badge badge-muted">${p.genero || '&#8212;'}</span></td>
      <td><span class="badge badge-muted">${p.familia || '&#8212;'}</span></td>
      <td><span class="badge badge-muted">${p.tipo || '&#8212;'}</span></td>
      <td class="col-clicks">${clicks}</td>
      <td>${tags || '<span style="color:var(--text-faint)">Sin precios</span>'}${alertaPrecio}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="copiarLista('${pid}')" title="Copiar lista de precios"><i class="bi bi-clipboard"></i></button>
        <button class="btn-icon" onclick="edit('${pid}')" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon" onclick="toggleV('${pid}',${actv})" title="${actv ? 'Ocultar' : 'Mostrar'}"><i class="bi bi-eye${actv ? '' : '-slash'}"></i></button>
        <button class="btn-icon" onclick="del('${pid}','${pnom}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`;
  }).join('');
};

window.copiarLista = (id) => {
  const p = perfumes.find(x => x.id === id);
  if (!p) return;
  const pr = p.precios || {};
  const lineas = Object.entries(pr)
    .filter(([, v]) => +v > 0)
    .sort(([a], [b]) => +a - +b)
    .map(([k, v]) => `${k}ml -> $${v}`);
  if (!lineas.length) { toast('Este perfume no tiene precios configurados', 'error'); return; }
  const texto = `${p.nombre}\n${lineas.join(' | ')}`;
  navigator.clipboard.writeText(texto)
    .then(() => toast('Lista copiada al portapapeles ✅', 'success'))
    .catch(() => toast('No se pudo copiar', 'error'));
};

window.openModal = () => {
  ['p-id','p-nombre','p-desc','p-img-url','px2','px3','px5','px10'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('p-img-file').value    = '';
  document.getElementById('p-genero').value       = '';
  document.getElementById('p-cat').value          = '';
  // Re-poblar con valor vacío (sin especificar)
  document.getElementById('p-familia').innerHTML =
    buildSelectOptions(FAMILIAS, '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML =
    buildSelectOptions(TIPOS, '', 'Sin especificar');
  document.getElementById('p-marca').innerHTML    = '<option>Selecciona</option>';
  document.getElementById('p-activo').checked     = true;
  document.getElementById('preview-wrap').style.display = 'none';
  document.getElementById('modal-title').textContent    = 'Nuevo Perfume';
  setMode('url');
  document.getElementById('modal').classList.add('open');
};

window.closeModal = () => document.getElementById('modal').classList.remove('open');

window.setMode = (m) => {
  imgMode = m;
  document.getElementById('sec-url').style.display  = m === 'url'  ? 'block' : 'none';
  document.getElementById('sec-file').style.display = m === 'file' ? 'block' : 'none';
  document.getElementById('btn-url').style.borderColor  = m === 'url'  ? 'var(--accent)' : 'var(--border)';
  document.getElementById('btn-file').style.borderColor = m === 'file' ? 'var(--accent)' : 'var(--border)';
};

window.previewUrl = () => {
  const u = document.getElementById('p-img-url').value;
  document.getElementById('preview-img').src = u;
  document.getElementById('preview-wrap').style.display = u ? 'block' : 'none';
};

window.previewFile = () => {
  const f = document.getElementById('p-img-file').files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-wrap').style.display = 'block';
  };
  r.readAsDataURL(f);
};

window.edit = (id) => {
  const p = perfumes.find(x => x.id === id);
  if (!p) return;
  document.getElementById('p-id').value     = p.id;
  document.getElementById('p-nombre').value = p.nombre;
  document.getElementById('p-genero').value = p.genero || '';
  document.getElementById('p-cat').value    = p.categoria || '';
  // Poblar selects con el valor actual del perfume pre-seleccionado
  document.getElementById('p-familia').innerHTML =
    buildSelectOptions(FAMILIAS, p.familia || '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML =
    buildSelectOptions(TIPOS, p.tipo || '', 'Sin especificar');
  loadMarcas();
  setTimeout(() => { document.getElementById('p-marca').value = p.marca || ''; }, 80);
  document.getElementById('p-desc').value    = p.descripcion || '';
  const pr = p.precios || {};
  ['2','3','5','10'].forEach(k => { document.getElementById('px' + k).value = pr[k] || ''; });
  document.getElementById('p-activo').checked = p.activo !== false;
  if (p.imagen) {
    setMode('url');
    document.getElementById('p-img-url').value = p.imagen;
    previewUrl();
  } else {
    document.getElementById('preview-wrap').style.display = 'none';
  }
  document.getElementById('modal-title').textContent = 'Editar Perfume';
  document.getElementById('modal').classList.add('open');
};

window.save = async () => {
  const id        = document.getElementById('p-id').value;
  const nombre    = document.getElementById('p-nombre').value.trim();
  const genero    = document.getElementById('p-genero').value;
  const categoria = document.getElementById('p-cat').value;
  const marca     = document.getElementById('p-marca').value;
  if (!nombre || !genero || !categoria || !marca) {
    toast('Completa todos los campos (*)', 'error');
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
    const precios = {
      '2':  +document.getElementById('px2').value  || 0,
      '3':  +document.getElementById('px3').value  || 0,
      '5':  +document.getElementById('px5').value  || 0,
      '10': +document.getElementById('px10').value || 0
    };
    const tamanos = Object.keys(precios).filter(k => precios[k] > 0);
    const data = {
      nombre, genero, categoria, marca,
      familia:     document.getElementById('p-familia').value || '',
      tipo:        document.getElementById('p-tipo').value    || '',
      descripcion: document.getElementById('p-desc').value.trim(),
      imagen, precios, tamanos,
      activo: document.getElementById('p-activo').checked
    };
    if (id) {
      await updateDoc(doc(db, 'perfumes', id), data);
    } else {
      await addDoc(collection(db, 'perfumes'), { ...data, clicks: 0, creadoEn: Date.now() });
    }
    toast(id ? 'Perfume actualizado ✅' : 'Perfume creado ✅', 'success');
    closeModal();
    loadAll();
  } catch (e) {
    console.error(e);
    toast('Error: ' + e.message, 'error');
  } finally {
    btnSave.disabled  = false;
    btnSave.innerHTML = '<i class="bi bi-check2"></i> Guardar Perfume';
  }
};

window.toggleV = async (id, activo) => {
  await updateDoc(doc(db, 'perfumes', id), { activo: !activo });
  toast(activo ? 'Perfume ocultado' : 'Perfume visible', 'info');
  loadAll();
};

window.del = async (id, nombre) => {
  if (!confirm('Eliminar ' + nombre + '?')) return;
  await deleteDoc(doc(db, 'perfumes', id));
  toast('Eliminado', 'info');
  loadAll();
};

loadAll();
