import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onAuthStateChanged }
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
// ── Definir addToPosCart para la vista POS Rápido ──
window.addToPosCart = (item) => {
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('posCart') || '[]'); } catch(e){}
  
  const extItem = cart.find(x => x.id === item.id && x.ml === item.ml);
  if (extItem) {
    extItem.cant += 1;
    extItem.addedAt = Date.now();
  } else {
    item.addedAt = Date.now();
    cart.push(item);
  }
  localStorage.setItem('posCart', JSON.stringify(cart));
  if (window.renderPosCart) window.renderPosCart();
};

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

import { matchSearch } from './search-engine.js';

let currentPage = 1;
const pageSize = 100;

window.changePage = (dir) => {
  currentPage += dir;
  renderTable();
};

window.renderPagination = (totalItems, start, end, totalPages) => {
  const pWrap = document.getElementById('pagination-wrap');
  if (!pWrap) return;
  pWrap.innerHTML = `
    <span class="page-info">Mostrando ${start}-${end} de ${totalItems}</span>
    <div class="page-btns">
      <button class="btn btn-outline" onclick="changePage(-1)" ${currentPage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
      <span style="padding:0 10px">Página ${currentPage} de ${totalPages}</span>
      <button class="btn btn-outline" onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
    </div>
  `;
};

window.renderTable = () => {
  const q      = document.getElementById('search').value.toLowerCase();
  const fg     = document.getElementById('f-genero').value;
  const fc     = document.getElementById('f-cat').value;
  const fm     = document.getElementById('f-marca').value;
  const ffa    = document.getElementById('f-familia').value;
  const fti    = document.getElementById('f-tipo').value;
  const fnov   = document.getElementById('f-novedad').value;
  const fstock = document.getElementById('f-stock').value;
  const orden  = document.getElementById('f-orden').value;

  let fil = perfumes.filter(p =>
    (!q      || matchSearch(q, p.nombre + ' ' + (p.marca || ''))) &&
    (!fg     || p.genero    === fg)  &&
    (!fc     || p.categoria === fc)  &&
    (!fm     || p.marca     === fm)  &&
    (!ffa    || p.familia   === ffa) &&
    (!fti    || p.tipo      === fti) &&
    (!fnov   || p.novedad   === true) &&
    (!fstock || p.estadoStock === fstock)
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
    const ds = localStorage.getItem('adminDataSaver') === '1';

    // Pagination calc
    const totalPages = Math.max(1, Math.ceil(fil.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, fil.length);
    const pageItems = fil.slice(start, end);

    if (!fil.length) {
      tb.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="bi bi-search"></i><h3>No hay resultados</h3><p>Prueba buscando otra cosa.</p></div></td></tr>';
      renderPagination(0, 0, 0, 1);
      return;
    }

    tb.innerHTML = pageItems.map(p => {
      const pr = p.precios || {};
      const sinPrecio = !Object.values(pr).some(v => +v > 0);
      const tags = Object.entries(pr)
        .filter(([, v]) => +v > 0)
        .map(([k, v]) => `<span class="badge badge-gold">${k}ml $${v}</span>`).join(' ');
      
      let estadoBadge = '';
      if (p.archivado === true) estadoBadge = '<span class="badge badge-danger" style="margin-left:6px">Archivado</span>';
      else if (p.activo === false) estadoBadge = '<span class="badge badge-warning" style="margin-left:6px;color:#000">Oculto</span>';
      
      let stockBadge = '';
      if (p.estadoStock === 'por_acabarse') stockBadge = '<span class="badge badge-warning" style="margin-left:6px;color:#000">🟡 Por acabarse</span>';
      else if (p.estadoStock === 'agotado') stockBadge = '<span class="badge badge-danger" style="margin-left:6px">🔴 Agotado</span>';

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
        <td>${(!ds && p.imagen) ? `<img class="td-img" src="${imgThumb(p.imagen)}" alt="" loading="lazy">` : '<div class="td-img-placeholder"><i class="bi bi-droplet"></i></div>'}</td>
        <td><strong>${p.nombre}</strong>${estadoBadge}${novedadBadge}${stockBadge}</td>
        <td><span class="badge badge-gold">${p.marca || '&#8212;'}</span></td>
        <td><span class="badge badge-info">${p.categoria || '&#8212;'}</span></td>
        <td><span class="badge badge-muted">${p.genero || '&#8212;'}</span></td>
        <td><span class="badge badge-muted">${p.familia || '&#8212;'}</span></td>
        <td><span class="badge badge-muted">${p.tipo || '&#8212;'}</span></td>
        <td class="col-clicks">${clicks}</td>
        <td>${tags || '<span style="color:var(--text-faint)">Sin precios</span>'}${alertaPrecio}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick="openPosItemModal('${pid}')" title="Añadir a Canasta"><i class="bi bi-cart-plus" style="color:var(--accent)"></i></button>
          <button class="btn btn-outline btn-sm" onclick="copiarLista('${pid}')" title="Copiar lista de precios"><i class="bi bi-clipboard"></i></button>
          <button class="btn-icon" onclick="edit('${pid}')" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="btn-icon" onclick="del('${pid}','${pnom}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
        </div></td>
      </tr>`;
    }).join('');

    renderPagination(fil.length, start + 1, end, totalPages);

    // ── Renderizar Grid POS ──
    const posGrid = document.getElementById('pos-grid');
    if (posGrid) {
      let posItems = [...fil];
      if (window.paquetesData && window.activeTab !== 'archived') {
        const q = document.getElementById('search').value.toLowerCase();
        const activePkgs = window.paquetesData.filter(p => p.activo !== false);
        const pkgs = activePkgs.filter(p => (!q || matchSearch(q, p.nombre)));
        posItems = posItems.concat(pkgs);
      }
      posGrid.innerHTML = posItems.map(p => {
        const imgHTML = (!ds && p.imagen) ? `<img class="pcard-img" src="${imgThumb(p.imagen)}" loading="lazy">` : `<div class="pcard-img" style="display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--text-faint)"><i class="bi bi-droplet"></i></div>`;
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

window.calcSavingsAdmin = (paquete, size) => {
  if (!paquete || !paquete.items || paquete.items.length === 0) return { saving: 0, original: 0 };
  const pkgPrice = paquete.precios && paquete.precios[size] ? paquete.precios[size] : (paquete.ml == size ? paquete.precio : 0);
  if (!pkgPrice) return { saving: 0, original: 0 };
  
  let itemPrices = [];
  for (const item of paquete.items) {
    const perfume = perfumes.find(x => x.id === item.id);
    if (perfume && perfume.precios && perfume.precios[size]) {
      itemPrices.push(perfume.precios[size]);
    }
  }
  
  const requiredCount = paquete.esPersonalizable ? (paquete.maxSeleccion || 3) : paquete.items.length;
  if (itemPrices.length < requiredCount) return { saving: 0, original: 0 };
  
  itemPrices.sort((a,b) => b - a);
  let totalIndiv = itemPrices.slice(0, requiredCount).reduce((a,b) => a + b, 0);

  return {
    saving: totalIndiv > pkgPrice ? totalIndiv - pkgPrice : 0,
    original: totalIndiv > pkgPrice ? totalIndiv : 0
  };
};

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
  const ds = localStorage.getItem('adminDataSaver') === '1';
  if (ds) {
    imgEl.style.display = 'none';
  } else if(p.imagen) {
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
      let savingHtml = '';
      let crossHtml = '';
      if (isPaquete) {
        const sv = window.calcSavingsAdmin(p, ml);
        if (sv.saving > 0) {
          savingHtml = `<div style="font-size:11px;color:#000;background:var(--accent);padding:2px 6px;border-radius:4px;font-weight:700;margin-left:8px;">Ahorras $${sv.saving}</div>`;
        }
        if (sv.original > 0) {
          crossHtml = `<del style="opacity:0.6;font-size:0.85em;margin-right:6px;font-weight:normal;">$${sv.original}</del>`;
        }
      }
      btnContainer.innerHTML += `<button class="btn btn-outline" style="width:100%;justify-content:space-between;padding:14px 20px;font-size:16px;border-radius:12px;border-color:var(--border);" onclick="fastAddToCart('${p.id}', '${ml}', ${precio})">
        <div style="display:flex;align-items:center;">
          <span style="font-weight:600">${isPaquete ? 'Paquete ' : ''}${ml}ml</span>
          ${savingHtml}
        </div>
        <span style="color:var(--accent);font-weight:700">${crossHtml}$${precio}</span>
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

  const finishAdd = (nombre, pItems = null) => {
    if(window.addToPosCart) {
      window.addToPosCart({
        id: p.id,
        nombre: nombre,
        marca: finalMarca,
        imagen: p.imagen || '',
        ml: ml,
        precio: precio,
        cant: 1,
        loteId: p.loteActivo || null,
        paqueteItems: pItems
      });
      if(window.showToast) window.showToast('Añadido a la canasta', 'success');
      if(window.closePosModal) window.closePosModal();
    }
  };

  if (isPaquete && p.esPersonalizable) {
    if (window.openPackageSelectionModal) {
      window.openPackageSelectionModal(p, (selecciones) => {
        if (selecciones && Array.isArray(selecciones)) {
          const names = selecciones.map(x => x.nombre).join(', ');
          finishAdd(finalNombre + ` [${names}]`, selecciones);
        } else if (selecciones) {
          finishAdd(finalNombre + ` [${selecciones}]`);
        }
      }, ml);
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
      cant: 1,
      loteId: p.loteActivo || null
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

window.currentLotes = [];
window.activeLoteId = null;

window.renderLotesUI = () => {
  const container = document.getElementById('lotes-container');
  if (!container) return;
  container.innerHTML = window.currentLotes.map((l, i) => {
    // Fix timezone issues by creating date string locally
    const d = new Date(l.fecha);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `
    <div style="display:flex; gap:10px; align-items:center; background:var(--bg-card2); padding:10px; border-radius:8px; border:1px solid ${window.activeLoteId===l.id ? 'var(--accent)' : 'var(--border)'}">
      <input type="radio" name="loteActivo" value="${l.id}" ${window.activeLoteId===l.id ? 'checked' : ''} onchange="window.activeLoteId='${l.id}'; window.renderLotesUI();" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;margin-bottom:4px;display:flex;align-items:center;gap:8px">
          Botella #${i+1} 
          <input type="date" class="form-control" style="padding:2px 6px;font-size:11px;width:auto" value="${dateStr}" onchange="window.currentLotes[${i}].fecha=new Date(this.value+'T12:00:00').getTime()">
        </div>
        <div style="display:flex;gap:10px">
          <input type="number" class="form-control" style="padding:4px 8px;font-size:12px" placeholder="Costo $" value="${l.costo}" onchange="window.currentLotes[${i}].costo=Number(this.value)">
          <input type="number" class="form-control" style="padding:4px 8px;font-size:12px" placeholder="Tamaño ml" value="${l.tamano}" onchange="window.currentLotes[${i}].tamano=Number(this.value)">
        </div>
      </div>
      <button class="btn-icon" style="color:var(--danger)" onclick="window.currentLotes.splice(${i},1); if(window.activeLoteId==='${l.id}') window.activeLoteId=window.currentLotes[0]?.id || null; window.renderLotesUI()"><i class="bi bi-trash"></i></button>
    </div>
  `}).join('');
  if(window.currentLotes.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:12px;padding:10px">No hay botellas registradas.</div>';
  }
};

window.addLoteUI = () => {
  const newId = 'lote-' + Date.now();
  window.currentLotes.push({
    id: newId,
    fecha: Date.now(),
    costo: 0,
    tamano: 100
  });
  if (!window.activeLoteId) window.activeLoteId = newId;
  window.renderLotesUI();
};

window.openModal = () => {
  document.getElementById('p-id').value = '';
  document.getElementById('p-nombre').value = '';
  document.getElementById('p-genero').value = 'Caballero';
  document.getElementById('p-cat').value = 'Diseñador';
  document.getElementById('p-familia').innerHTML = buildSelectOptions(familiasData, '', 'Sin especificar');
  document.getElementById('p-tipo').innerHTML = buildSelectOptions(tiposData, '', 'Sin especificar');
  loadMarcas();
  setTimeout(() => { document.getElementById('p-marca').value = ''; }, 80);
  document.getElementById('p-desc').value = '';
  
  ['2','3','5','10'].forEach(k => { document.getElementById('px' + k).value = ''; });
  
  document.getElementById('p-estado').value = 'visible';
  document.getElementById('p-stock').value = 'normal';
  
  window.currentLotes = [];
  window.activeLoteId = null;
  window.renderLotesUI();
  
  document.getElementById('p-novedad').checked = false;
  document.getElementById('p-img-url').value = '';
  if (document.getElementById('p-img-file')) document.getElementById('p-img-file').value = '';
  document.getElementById('preview-wrap').style.display = 'none';
  document.getElementById('preview-img').src = '';
  
  document.getElementById('modal-title').textContent = 'Nuevo Perfume';
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
  const ds = localStorage.getItem('adminDataSaver') === '1';
  const u = document.getElementById('p-img-url').value;
  if (ds) {
    document.getElementById('preview-wrap').style.display = 'none';
    return;
  }
  document.getElementById('preview-img').src = u;
  document.getElementById('preview-wrap').style.display = u ? 'block' : 'none';
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
  const pr = p.precios || {};
  ['2','3','5','10'].forEach(k => { document.getElementById('px' + k).value = pr[k] || ''; });
  
  if (p.archivado) document.getElementById('p-estado').value = 'archivado';
  else if (p.activo === false) document.getElementById('p-estado').value = 'oculto';
  else document.getElementById('p-estado').value = 'visible';

  document.getElementById('p-stock').value = p.estadoStock || 'normal';

  window.currentLotes = p.lotes ? JSON.parse(JSON.stringify(p.lotes)) : [];
  window.activeLoteId = p.loteActivo || null;
  if (window.currentLotes.length === 0 && (p.costoBotella || p.tamanoBotella)) {
    const fallbackId = 'lote-' + (p.creadoEn || Date.now());
    window.currentLotes.push({
      id: fallbackId,
      fecha: p.creadoEn || Date.now(),
      costo: p.costoBotella || 0,
      tamano: p.tamanoBotella || 0
    });
    window.activeLoteId = fallbackId;
  }
  window.renderLotesUI();

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
    const estadoStock = document.getElementById('p-stock').value || 'normal';

    const data = {
      nombre, genero, categoria, marca,
      familia:     document.getElementById('p-familia').value || '',
      tipo:        document.getElementById('p-tipo').value    || '',
      descripcion: document.getElementById('p-desc').value.trim(),
      imagen, precios, tamanos,
      activo:    (estado === 'visible'),
      archivado: (estado === 'archivado'),
      novedad: document.getElementById('p-novedad').checked,
      lotes: window.currentLotes, loteActivo: window.activeLoteId, estadoStock
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
  const result = await Swal.fire({
    title: '¿Eliminar perfume?',
    text: `Estás a punto de eliminar "${nombre}" del catálogo.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#4f98a3',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });
  
  if (result.isConfirmed) {
    await deleteDoc(doc(db, 'perfumes', id));
    toast('Eliminado', 'info');
    loadAll();
  }
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

onAuthStateChanged(auth, user => {
  if (user) loadAll();
});

window.openPackageSelectionModal = (p, onComplete, selectedMl = null) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '99999';
  
  const max = p.maxSeleccion || 3;
  const targetMl = selectedMl || p.ml || '5';
  
  let itemsHTML = (p.items||[]).map((i) => {
    let pxStr = '';
    let fullPerf = perfumes.find(x => x.id === i.id);
    if (!fullPerf) fullPerf = perfumes.find(x => x.nombre === i.nombre);
    if (fullPerf && fullPerf.precios && fullPerf.precios[targetMl]) {
      pxStr = ` <span style="color:var(--text-faint); font-weight:normal; margin-left:auto; font-size:13px;">$${fullPerf.precios[targetMl]}</span>`;
    }
    return `
    <label style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-card2);border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.05)">
      <input type="checkbox" class="pkg-custom-chk" value="${i.nombre}" data-id="${i.id}" data-max="${max}" style="width:18px;height:18px;accent-color:var(--gold)">
      <span style="font-size:14px;color:var(--text-primary)">${i.nombre} <small style="color:var(--text-muted)">(${i.marca||''})</small></span>
      ${pxStr}
    </label>
    `;
  }).join('');

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
    const arr = Array.from(checked).map(c => ({ id: c.dataset.id, nombre: c.value }));
    onComplete(arr);
    close();
  };
};
