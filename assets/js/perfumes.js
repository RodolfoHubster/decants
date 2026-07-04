import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { auth } from './firebase-config.js';
import '../../admin/auth-guard.js';
import { imgThumb } from './cloudinary.js';
import { buildSelectOptions } from './filtros-config.js';
import { toast } from './toast.js';

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
let familiasData = [];
let tiposData    = [];
let tableSortCol = null;
let tableSortDir = 'asc';

function initFiltrosSelects() {
  document.getElementById('p-familia').innerHTML =
    buildSelectOptions(familiasData, '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML =
    buildSelectOptions(tiposData, '', 'Sin especificar');

  document.getElementById('f-familia').innerHTML =
    `<option value="">Todas las familias</option>` +
    familiasData.map(f => `<option value="${f.nombre}">${f.emoji ? f.emoji + ' ' : ''}${f.nombre}</option>`).join('');

  document.getElementById('f-tipo').innerHTML =
    `<option value="">Todos los tipos</option>` +
    tiposData.map(t => `<option value="${t.nombre}">${t.emoji ? t.emoji + ' ' : ''}${t.nombre}</option>`).join('');
}

async function loadAll() {
  const [ps, cs, ms, fs, ts, pq] = await Promise.all([
    getDocs(collection(db, 'perfumes')),
    getDocs(collection(db, 'categorias')),
    getDocs(collection(db, 'marcas')),
    getDocs(collection(db, 'familias_olfativas')),
    getDocs(collection(db, 'tipos_perfume')),
    getDocs(collection(db, 'paquetes'))
  ]);

  cats   = []; cs.forEach(d => cats.push({ id: d.id,   ...d.data() }));
  cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
  marcas = []; ms.forEach(d => marcas.push({ id: d.id, ...d.data() }));
  marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));

  familiasData = [];
  fs.forEach(d => familiasData.push({ id: d.id, ...d.data() }));
  familiasData.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre));

  tiposData = [];
  ts.forEach(d => tiposData.push({ id: d.id, ...d.data() }));
  tiposData.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre));

  perfumes = []; ps.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
  
  window.paquetesData = [];
  pq.forEach(d => window.paquetesData.push({ id: d.id, ...d.data(), isPaquete: true }));

  const cOpts = cats.map(c => `<option>${c.nombre}</option>`).join('');
  document.getElementById('f-cat').innerHTML   = `<option value="">Todas las categorias</option>${cOpts}`;
  document.getElementById('p-cat').innerHTML   = `<option value="">Selecciona</option>${cOpts}`;
  document.getElementById('f-marca').innerHTML = `<option value="">Todas las marcas</option>` +
    marcas.map(m => `<option>${m.nombre}</option>`).join('');

  initFiltrosSelects();
  renderTable();
}

window.loadMarcas = () => {
  const cat = document.getElementById('p-cat').value;
  const fil = cat ? marcas.filter(m => m.categoria === cat) : marcas;
  document.getElementById('p-marca').innerHTML =
    `<option value="">Selecciona</option>` + fil.map(m => `<option>${m.nombre}</option>`).join('');
};

window.activeTab = 'main';
window.switchTab = (tab) => {
  window.activeTab = tab;
  document.getElementById('tab-main').style.background = tab === 'main' ? 'var(--bg-card)' : 'transparent';
  document.getElementById('tab-main').style.borderColor = tab === 'main' ? 'var(--gold)' : 'var(--border)';
  document.getElementById('tab-archived').style.background = tab === 'archived' ? 'var(--bg-card)' : 'transparent';
  document.getElementById('tab-archived').style.borderColor = tab === 'archived' ? 'var(--gold)' : 'var(--border)';
  renderTable();
};

window.renderTable = () => {
  const q      = document.getElementById('search').value.toLowerCase();
  const fg     = document.getElementById('f-genero').value;
  const fc     = document.getElementById('f-cat').value;
  const fm     = document.getElementById('f-marca').value;
  const ffa    = document.getElementById('f-familia').value;
  const fti    = document.getElementById('f-tipo').value;
  const fnov   = document.getElementById('f-novedad').value;
  const orden  = document.getElementById('f-orden').value;

  let fil = perfumes.filter(p =>
    (!q    || p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q)) &&
    (!fg   || p.genero    === fg)  &&
    (!fc   || p.categoria === fc)  &&
    (!fm   || p.marca     === fm)  &&
    (!ffa  || p.familia   === ffa) &&
    (!fti  || p.tipo      === fti) &&
    (!fnov || p.novedad   === true)
  );

  if (window.activeTab === 'archived') {
    fil = fil.filter(p => p.archivado === true);
  } else {
    fil = fil.filter(p => p.archivado !== true);
  }

  fil.sort((a, b) => {
    if (tableSortCol) {
      const vA = a[tableSortCol] || (tableSortCol === 'clicks' ? 0 : '');
      const vB = b[tableSortCol] || (tableSortCol === 'clicks' ? 0 : '');
      let cmp = 0;
      if (typeof vA === 'string' && typeof vB === 'string') {
        cmp = vA.localeCompare(vB);
      } else {
        cmp = vA > vB ? 1 : vA < vB ? -1 : 0;
      }
      return tableSortDir === 'asc' ? cmp : -cmp;
    } else {
      if (orden === 'clicks') return (b.clicks || 0) - (a.clicks || 0);
      if (orden === 'recientes') return (b.creadoEn || 0) - (a.creadoEn || 0);
      if (orden === 'antiguos') return (a.creadoEn || 0) - (b.creadoEn || 0);
      if (orden === 'az')     return a.nombre.localeCompare(b.nombre);
      if (orden === 'za')     return b.nombre.localeCompare(a.nombre);
      return 0;
    }
  });

  document.querySelectorAll('.sort-icon').forEach(el => {
    el.className = 'bi bi-chevron-expand sort-icon';
    el.style.opacity = '0.3';
  });
  if (tableSortCol) {
    const icon = document.getElementById('sort-' + tableSortCol);
    if (icon) {
      icon.className = tableSortDir === 'asc' ? 'bi bi-chevron-up sort-icon' : 'bi bi-chevron-down sort-icon';
      icon.style.opacity = '1';
    }
  }

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
    
    let estadoBadge = '';
    if (p.archivado === true) estadoBadge = '<span class="badge badge-danger" style="margin-left:6px">Archivado</span>';
    else if (p.activo === false) estadoBadge = '<span class="badge badge-warning" style="margin-left:6px;color:#000">Oculto</span>';
    
    const novedadBadge = p.novedad
      ? '<span class="badge badge-info" style="margin-left:6px">✨ Novedad</span>' : '';
    const clicks = p.clicks > 0
      ? `<span class="clicks-badge"><i class="bi bi-eye"></i> ${p.clicks}</span>`
      : `<span class="clicks-zero">&#8212;</span>`;
    const alertaPrecio = (sinPrecio && p.activo !== false)
      ? `<span class="badge badge-danger" style="margin-left:4px" title="Activo sin precios"><i class="bi bi-exclamation-triangle"></i></span>`
      : '';
    const pid  = p.id;
    const pnom = p.nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<tr>
      <td>${p.imagen ? `<img class="td-img" src="${imgThumb(p.imagen)}" alt="" loading="lazy">` : '<div class="td-img-placeholder"><i class="bi bi-droplet"></i></div>'}</td>
      <td><strong>${p.nombre}</strong>${estadoBadge}${novedadBadge}</td>
      <td><span class="badge badge-gold">${p.marca || '&#8212;'}</span></td>
      <td><span class="badge badge-info">${p.categoria || '&#8212;'}</span></td>
      <td><span class="badge badge-muted">${p.genero || '&#8212;'}</span></td>
      <td><span class="badge badge-muted">${p.familia || '&#8212;'}</span></td>
      <td><span class="badge badge-muted">${p.tipo || '&#8212;'}</span></td>
      <td class="col-clicks">${clicks}</td>
      <td>${tags || '<span style="color:var(--text-faint)">Sin precios</span>'}${alertaPrecio}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="promptAddPos('${pid}')" title="Añadir a Canasta"><i class="bi bi-cart-plus" style="color:var(--accent)"></i></button>
        <button class="btn btn-outline btn-sm" onclick="copiarLista('${pid}')" title="Copiar lista de precios"><i class="bi bi-clipboard"></i></button>
        <button class="btn-icon" onclick="edit('${pid}')" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon" onclick="del('${pid}','${pnom}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  // ── Renderizar Grid POS ──
  const posGrid = document.getElementById('pos-grid');
  if (posGrid) {
    let posItems = [...fil];
    if (window.paquetesData) {
      const q = document.getElementById('search').value.toLowerCase();
      const activePkgs = window.paquetesData.filter(p => p.activo !== false);
      const pkgs = activePkgs.filter(p => (!q || p.nombre.toLowerCase().includes(q)));
      posItems = posItems.concat(pkgs);
    }
    posGrid.innerHTML = posItems.map(p => {
      const imgHTML = p.imagen ? `<img class="pcard-img" src="${imgThumb(p.imagen)}" loading="lazy">` : `<div class="pcard-img" style="display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--text-faint)"><i class="bi bi-droplet"></i></div>`;
      return `<div class="pcard" onclick="openPosItemModal('${p.id}')">
        ${imgHTML}
        <div class="pcard-body">
          <div class="pcard-title">${p.isPaquete ? '📦 ' + p.nombre : p.nombre}</div>
          <div class="pcard-sub">${p.isPaquete ? 'Combos Fitoscents' : (p.marca || '—')}</div>
        </div>
      </div>`;
    }).join('');
  }
};

window.toggleAdminView = () => {
  const tableWrap = document.querySelector('.table-wrap');
  const posGrid = document.getElementById('pos-grid');
  const btn = document.getElementById('btn-toggle-view');
  if(!tableWrap || !posGrid) return;
  
  if(tableWrap.style.display !== 'none') {
    tableWrap.style.display = 'none';
    posGrid.style.display = 'grid';
    if(btn) btn.innerHTML = '<i class="bi bi-list-ul"></i>';
    localStorage.setItem('adminPerfumeView', 'grid');
  } else {
    tableWrap.style.display = '';
    posGrid.style.display = 'none';
    if(btn) btn.innerHTML = '<i class="bi bi-grid-fill"></i>';
    localStorage.setItem('adminPerfumeView', 'table');
  }
};

window.sortBy = (col) => {
  if (tableSortCol === col) {
    tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    tableSortCol = col;
    tableSortDir = 'asc';
  }
  document.getElementById('f-orden').value = '';
  renderTable();
};

window.sortByDropdown = () => {
  tableSortCol = null;
  renderTable();
};

document.addEventListener('DOMContentLoaded', () => {
  const v = localStorage.getItem('adminPerfumeView');
  if(v === 'grid' || (window.innerWidth <= 480 && v !== 'table')) {
    const tableWrap = document.querySelector('.table-wrap');
    const posGrid = document.getElementById('pos-grid');
    const btn = document.getElementById('btn-toggle-view');
    if(tableWrap && posGrid) {
      tableWrap.style.display = 'none';
      posGrid.style.display = 'grid';
      if(btn) btn.innerHTML = '<i class="bi bi-list-ul"></i>';
    }
  }
});

// ── Modal Rápido POS ──
let currentPosId = null;

window.openPosItemModal = (id) => {
  currentPosId = id;
  let p = perfumes.find(x => x.id === id);
  let isPaquete = false;
  if (!p && window.paquetesData) {
    p = window.paquetesData.find(x => x.id === id);
    if (p) isPaquete = true;
  }
  if(!p) return;
  const imgEl = document.getElementById('pos-m-img');
  if(p.imagen) {
    imgEl.src = p.imagen;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }
  document.getElementById('pos-m-nombre').textContent = p.nombre;
  document.getElementById('pos-m-marca').textContent = isPaquete ? 'Combos Fitoscents' : (p.marca || 'Sin marca');
  document.getElementById('pos-m-familia').textContent = isPaquete ? 'Paquete Especial' : (p.familia || 'Sin familia');
  
  const btnContainer = document.getElementById('pos-m-precios');
  btnContainer.innerHTML = '';
  const pr = p.precios || {};
  const available = Object.entries(pr).filter(([,v])=>+v>0);
  
  if(available.length === 0) {
    btnContainer.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:10px">No hay precios configurados</div>';
  } else {
    available.forEach(([ml, precio]) => {
      btnContainer.innerHTML += `<button class="btn btn-outline" style="width:100%;justify-content:space-between;padding:14px 20px;font-size:16px;border-radius:12px;border-color:var(--border);" onclick="fastAddToCart('${p.id}', '${ml}', ${precio})">
        <span style="font-weight:600">${isPaquete ? 'Paquete ' : ''}${ml}ml</span>
        <span style="color:var(--accent);font-weight:700">$${precio}</span>
      </button>`;
    });
  }
  document.getElementById('modal-pos').classList.add('open');
};

window.copyPosPrices = () => {
  if (!currentPosId) return;
  let p = perfumes.find(x => x.id === currentPosId);
  let isPaquete = false;
  if (!p && window.paquetesData) {
    p = window.paquetesData.find(x => x.id === currentPosId);
    if (p) isPaquete = true;
  }
  if (!p) return;

  let text = `✨ *${p.nombre}*${p.marca ? ' - ' + p.marca : ''}\n\n`;
  const pr = p.precios || {};
  const sizes = Object.entries(pr).filter(([, v]) => +v > 0).sort((a, b) => +a[0] - +b[0]);
  
  if (sizes.length === 0) {
    text += 'Sin presentaciones disponibles.';
  } else {
    sizes.forEach(([ml, price]) => {
      text += `💧 ${ml}ml — $${price} MXN\n`;
    });
  }
  text += `\n📦 *Decants 100% Originales*`;
  
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-pos');
    if (btn) {
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-check2" style="color:var(--gold,#C9A84C);"></i>';
      setTimeout(() => btn.innerHTML = origHTML, 1500);
    }
    if (window.showToast) window.showToast('¡Copiado!');
    else if (window.toast) window.toast('¡Copiado!', 'success');
  }).catch(() => {
    if (window.showToast) window.showToast('Error al copiar', 'error');
    else if (window.toast) window.toast('Error al copiar', 'error');
  });
};

window.closePosModal = () => {
  currentPosId = null;
  document.getElementById('modal-pos').classList.remove('open');
};

window.fastAddToCart = (id, ml, precio) => {
  let p = perfumes.find(x => x.id === id);
  let isPaquete = false;
  if (!p && window.paquetesData) {
    p = window.paquetesData.find(x => x.id === id);
    if (p) isPaquete = true;
  }
  if(!p) return;

  let finalNombre = p.nombre;
  let finalMarca = isPaquete ? 'Combos Fitoscents' : (p.marca || '');

  const finishAdd = (nombre) => {
    if(window.addToPosCart) {
      window.addToPosCart({
        id: p.id,
        nombre: nombre,
        marca: finalMarca,
        imagen: p.imagen || '',
        ml: ml,
        precio: precio,
        cant: 1
      });
    }
    closePosModal();
  };

  if (isPaquete && p.esPersonalizable) {
    if (window.openPackageSelectionModal) {
      window.openPackageSelectionModal(p, (selecciones) => {
        if (selecciones) {
          finishAdd(finalNombre + ` [${selecciones}]`);
        }
      });
    } else {
      const selecciones = prompt(`Este paquete requiere ${p.maxSeleccion || 3} perfumes.\\nEscribe aquí los perfumes elegidos (se añadirán al carrito):`, "");
      if (selecciones) finishAdd(finalNombre + ` [${selecciones}]`);
    }
  } else {
    finishAdd(finalNombre);
  }
};

window.promptAddPos = (id) => {
  const p = perfumes.find(x => x.id === id);
  if(!p) return;
  const pr = p.precios || {};
  const available = Object.entries(pr).filter(([,v])=>+v>0);
  if(available.length === 0) {
    if(window.showToast) window.showToast('No tiene precios configurados', 'error');
    return;
  }
  let ml = available[0][0];
  let precio = available[0][1];
  
  if(available.length > 1) {
    const opts = available.map(x => `${x[0]}ml ($${x[1]})`).join(' | ');
    const res = prompt(`Selecciona ML para ${p.nombre}:\nOpciones: ${opts}\nEscribe solo el número (ej: ${ml})`, ml);
    if(!res) return;
    ml = res;
    precio = pr[ml] || 0;
  }
  if(precio == 0) return;

  if(window.addToPosCart) {
    window.addToPosCart({
      id: p.id,
      nombre: p.nombre,
      marca: p.marca || '',
      imagen: p.imagen || '',
      ml: ml,
      precio: precio,
      cant: 1
    });
  }
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
  document.getElementById('p-img-file').value = '';
  document.getElementById('p-genero').value   = '';
  document.getElementById('p-cat').value      = '';
  document.getElementById('p-familia').innerHTML = buildSelectOptions(familiasData, '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML    = buildSelectOptions(tiposData,    '', 'Sin especificar');
  document.getElementById('p-marca').innerHTML   = '<option>Selecciona</option>';
  document.getElementById('p-estado').value      = 'visible';
  document.getElementById('p-novedad').checked   = false;
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
  document.getElementById('p-familia').innerHTML = buildSelectOptions(familiasData, p.familia || '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML    = buildSelectOptions(tiposData,    p.tipo    || '', 'Sin especificar');
  loadMarcas();
  setTimeout(() => { document.getElementById('p-marca').value = p.marca || ''; }, 80);
  document.getElementById('p-desc').value    = p.descripcion || '';
  document.getElementById('p-novedad').checked = !!p.novedad;  // ← nuevo
  const pr = p.precios || {};
  ['2','3','5','10'].forEach(k => { document.getElementById('px' + k).value = pr[k] || ''; });
  
  if (p.archivado) document.getElementById('p-estado').value = 'archivado';
  else if (p.activo === false) document.getElementById('p-estado').value = 'oculto';
  else document.getElementById('p-estado').value = 'visible';

  document.getElementById('p-novedad').checked = p.novedad === true;
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
    const estado = document.getElementById('p-estado').value;
    const data = {
      nombre, genero, categoria, marca,
      familia:     document.getElementById('p-familia').value || '',
      tipo:        document.getElementById('p-tipo').value    || '',
      descripcion: document.getElementById('p-desc').value.trim(),
      imagen, precios, tamanos,
      activo:    (estado === 'visible'),
      archivado: (estado === 'archivado'),
      novedad: document.getElementById('p-novedad').checked
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


window.del = async (id, nombre) => {
  if (!confirm('Eliminar ' + nombre + '?')) return;
  await deleteDoc(doc(db, 'perfumes', id));
  toast('Eliminado', 'info');
  loadAll();
};

window.exportPrices = () => {
  if (!perfumes || perfumes.length === 0) {
    toast('No hay perfumes para exportar', 'error');
    return;
  }
  
  let mainPerfumes = perfumes.filter(p => p.archivado !== true);
  let archPerfumes = perfumes.filter(p => p.archivado === true);
  
  let csv = 'Nombre,Marca,Familia,Categoria,Genero,2ml,3ml,5ml,10ml\n';
  
  const escapeCsv = (str) => {
    if (!str) return '""';
    return '"' + str.replace(/"/g, '""') + '"';
  };

  mainPerfumes.forEach(p => {
    const pr = p.precios || {};
    const p2 = pr['2'] || '';
    const p3 = pr['3'] || '';
    const p5 = pr['5'] || '';
    const p10 = pr['10'] || '';
    csv += `${escapeCsv(p.nombre)},${escapeCsv(p.marca)},${escapeCsv(p.familia)},${escapeCsv(p.categoria)},${escapeCsv(p.genero)},${p2},${p3},${p5},${p10}\n`;
  });
  
  if (archPerfumes.length > 0) {
    csv += '\n--- PERFUMES ARCHIVADOS (NO EN EXHIBICIÓN) ---\n';
    archPerfumes.forEach(p => {
      csv += `${escapeCsv(p.nombre)},${escapeCsv(p.marca)},,,,,\n`;
    });
  }

  const blob = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', 'Precios_Decants_Fitoscents.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Lista exportada con éxito', 'success');
};

loadAll();

window.openPackageSelectionModal = (p, onComplete) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '99999';
  
  const max = p.maxSeleccion || 3;
  let itemsHTML = (p.items||[]).map((i) => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-card2);border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.05)">
      <input type="checkbox" class="pkg-custom-chk" value="${i.nombre}" data-max="${max}" style="width:18px;height:18px;accent-color:var(--gold)">
      <span style="font-size:14px;color:var(--text-primary)">${i.nombre} <small style="color:var(--text-muted)">(${i.marca||''})</small></span>
    </label>
  `).join('');

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:400px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px">
      <div class="modal-header">
        <h3 style="margin:0;font-size:16px;color:var(--gold)">📦 ${p.nombre}</h3>
        <button class="btn-icon close-pkg-modal"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Elige <strong>${max}</strong> perfumes de la lista:</p>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;padding-right:4px">
          ${itemsHTML}
        </div>
      </div>
      <div class="modal-footer" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <button class="btn btn-primary" id="btn-pkg-confirm" style="width:100%">Confirmar Selección</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const checkboxes = overlay.querySelectorAll('.pkg-custom-chk');
  checkboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      const checked = overlay.querySelectorAll('.pkg-custom-chk:checked');
      if (checked.length > max) {
        chk.checked = false;
        if(window.toast) toast(`Solo puedes elegir ${max}`, 'warning');
      }
    });
  });

  const close = () => overlay.remove();
  overlay.querySelector('.close-pkg-modal').onclick = close;
  overlay.querySelector('#btn-pkg-confirm').onclick = () => {
    const checked = overlay.querySelectorAll('.pkg-custom-chk:checked');
    if (checked.length < max) {
      if(window.toast) toast(`Selecciona ${max} perfumes`, 'warning');
      return;
    }
    const result = Array.from(checked).map(c => c.value).join(', ');
    onComplete(result);
    close();
  };
};
