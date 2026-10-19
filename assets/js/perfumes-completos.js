import { db } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { toast } from './toast.js';
import { imgThumb } from './cloudinary.js';
import { matchSearch } from './search-engine.js';
import { parsearRespuesta } from './ia-perfume.js';
import { construirPromptCompleto, interpretarCompleto, referenciasDe } from './ia-completos.js';

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
    const dispLabel = p.disponibilidad === 'en-stock' ? '<i class="bi bi-check-circle-fill"></i> En Stock' : p.disponibilidad === 'bajo-pedido' ? '<i class="bi bi-clock"></i> Bajo Pedido' : '<i class="bi bi-x-circle-fill"></i> Agotado';
    const archiveBtn = p.activo !== false
      ? `<button class="btn btn-sm btn-outline" onclick="toggleActivo('${p.id}', false)" title="Archivar (Ocultar)"><i class="bi bi-eye-slash"></i></button>`
      : `<button class="btn btn-sm btn-outline" style="color:var(--accent)" onclick="toggleActivo('${p.id}', true)" title="Desarchivar (Mostrar)"><i class="bi bi-eye"></i></button>`;

    return `<tr>
      <td><img src="${p.imagen ? imgThumb(p.imagen) : ''}" loading="lazy" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#222" onerror="this.src=''"></td>
      <td style="font-weight:500">${p.nombre || '—'}</td>
      <td>${p.marca || '—'}</td>
      <td><span class="concentracion-badge">${p.concentracion || '—'}</span></td>
      <td>${p.genero || '—'}</td>
      <td><button class="stock-badge ${dispClass} disp-btn" onclick="cambiarDisponibilidad('${p.id}')" title="Toca para cambiar">${dispLabel}</button></td>
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

  document.getElementById('foto-buscar').value = '';
  const sug = document.getElementById('ia-precios');
  if (sug) { sug.hidden = true; sug.innerHTML = ''; }
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
  document.getElementById('sec-decant').style.display = mode === 'decant' ? 'block' : 'none';
  document.getElementById('btn-url').classList.toggle('active', mode === 'url');
  document.getElementById('btn-file').classList.toggle('active', mode === 'file');
  document.getElementById('btn-decant').classList.toggle('active', mode === 'decant');
  if (mode === 'decant') abrirFotosDecant();
};

// ── Foto de un decant: el mismo perfume ya tiene foto en la tienda; se reusa
// la URL (nada se sube a Cloudinary). Se guarda igual que una URL pegada.
let fotosDecant = null;
async function abrirFotosDecant() {
  const buscar = document.getElementById('foto-buscar');
  if (!buscar.value) buscar.value = document.getElementById('p-nombre').value.trim();
  if (!fotosDecant) {
    document.getElementById('foto-grid').innerHTML = '<div class="foto-vacio">Cargando fotos…</div>';
    try {
      const snap = await getDocs(collection(db, 'perfumes'));
      fotosDecant = [];
      snap.forEach(d => { const x = d.data(); if (x.imagen) fotosDecant.push({ nombre: x.nombre || '', marca: x.marca || '', imagen: x.imagen }); });
      fotosDecant.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch (e) {
      console.error(e);
      document.getElementById('foto-grid').innerHTML = '<div class="foto-vacio">No se pudieron cargar las fotos.</div>';
      return;
    }
  }
  pintarFotosDecant();
  buscar.focus();
}

window.pintarFotosDecant = function () {
  const grid = document.getElementById('foto-grid');
  if (!fotosDecant) return;
  const q = document.getElementById('foto-buscar').value.trim();
  const actual = document.getElementById('p-img-url').value.trim();
  const lista = (q ? fotosDecant.filter(f => matchSearch(q, f.nombre + ' ' + f.marca)) : fotosDecant).slice(0, 40);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  grid.innerHTML = lista.length
    ? lista.map(f => `<button type="button" class="foto-op${f.imagen === actual ? ' sel' : ''}" data-url="${esc(f.imagen)}">
        <img src="${esc(imgThumb(f.imagen))}" loading="lazy" alt="">
        <span>${esc(f.nombre)}</span>${f.marca ? `<small>${esc(f.marca)}</small>` : ''}
      </button>`).join('')
    : '<div class="foto-vacio">Ningún decant con foto coincide. Prueba con otra palabra.</div>';
};

document.addEventListener('click', e => {
  const op = e.target.closest('.foto-op');
  if (!op) return;
  document.getElementById('p-img-url').value = op.dataset.url;
  previewUrl();
  document.querySelectorAll('.foto-op.sel').forEach(b => b.classList.remove('sel'));
  op.classList.add('sel');
  toast('Foto del decant elegida', 'success');
});

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
// ── IA: alta por nombre (botella completa) ────────────────
// El prompt vive en ia-completos.js (probado). Busca en la web: Fragrantica y
// Parfumo para las notas; Mercado Libre, Amazon y Liverpool para el precio.
// Antes contestaba de memoria y por eso los precios salían disparatados.
async function consultarIACompleto(promptText, apiKey) {
  const SITIOS = ['fragrantica.com', 'fragrantica.mx', 'parfumo.com',
    'mercadolibre.com.mx', 'amazon.com.mx', 'liverpool.com.mx'];
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.6',
        input: promptText,
        tools: [{ type: 'web_search', filters: { allowed_domains: SITIOS } }],
      }),
    });
    if (!res.ok) throw new Error(`búsqueda web no disponible (${res.status})`);
    const data = await res.json();
    // Con búsqueda la respuesta trae la llamada de búsqueda y el mensaje: se busca el mensaje.
    const mensaje = (data.output || []).find(o => o.type === 'message');
    const texto = mensaje?.content?.find(c => typeof c.text === 'string')?.text;
    if (!texto) throw new Error('respuesta sin texto');
    return texto;
  } catch (e) {
    console.warn('Sin búsqueda web, se usa la consulta normal:', e.message);
    toast('Sin búsqueda web: revisa bien los precios', 'info');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI respondió ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
}

// Sugerencia de precio: se muestra debajo de las tallas con "Usar" por talla.
let sugerenciaIA = {};
const pesos = n => '$' + Number(n).toLocaleString('es-MX');
function pintarSugerenciaPrecios(ia) {
  const box = document.getElementById('ia-precios');
  if (!box) return;
  sugerenciaIA = ia.precios;
  const filas = Object.entries(ia.precios).map(([ml, v]) => `
    <div class="ia-precio-fila">
      <b>${ml} ml</b>
      <span>${v.mercado ? `Mercado ≈ ${pesos(v.mercado)}` : 'Mercado: sin dato'}</span>
      <span class="ia-sug">Sugerido ${pesos(v.sugerido)}</span>
      <button type="button" class="btn btn-outline btn-sm" data-usar-precio="${ml}">Usar</button>
    </div>`).join('');
  const fuera = ia.descartados.map(d => `${d.ml} ml (${d.razon})`).join(', ');
  const duda = ia.confianza === 'baja' ? ' <em>· poco segura, verifícalo</em>' : '';
  box.innerHTML = filas
    ? `<div class="ia-precios-tit"><i class="bi bi-stars"></i> Precio sugerido por la IA${duda}</div>${filas}${fuera ? `<small>Descartado: ${fuera}</small>` : ''}`
    : `<div class="ia-precios-tit"><i class="bi bi-stars"></i> La IA no encontró un precio confiable${fuera ? ` (descartado: ${fuera})` : ''}. Ponlo tú.</div>`;
  box.hidden = false;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-usar-precio]');
  if (!b) return;
  const v = sugerenciaIA[b.dataset.usarPrecio];
  const inp = document.getElementById(`px${b.dataset.usarPrecio}`);
  if (!v || !inp) return;
  inp.value = v.sugerido;
  inp.classList.remove('ia-lleno'); void inp.offsetWidth; inp.classList.add('ia-lleno');
});

document.getElementById('btn-ia-name')?.addEventListener('click', async () => {
  const nombre = document.getElementById('p-nombre').value.trim();
  if (!nombre) { toast('Por favor, escribe el nombre del perfume primero.', 'warning'); return; }
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) { toast('Configura tu API Key en Ajustes para usar la IA.', 'warning'); return; }

  const btn = document.getElementById('btn-ia-name');
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  btn.disabled = true;
  toast('Buscando el perfume y su precio en México…', 'info');

  try {
    const conc = [...document.getElementById('p-concentracion').options]
      .filter(o => o.value).map(o => ({ value: o.value, text: o.text }));
    const marcaEscrita = document.getElementById('p-marca').value.trim();
    const idActual = document.getElementById('p-id').value;
    const prompt = construirPromptCompleto({
      nombre,
      marcaPista: marcaEscrita,
      concentraciones: conc.map(o => o.value),
      referencias: referenciasDe(items.filter(x => x.id !== idActual)),
    });
    const ia = interpretarCompleto(parsearRespuesta(await consultarIACompleto(prompt, apiKey)), { concentraciones: conc });

    const poner = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    if (!marcaEscrita) poner('p-marca', ia.marca);   // la marca que escribiste se respeta
    poner('p-genero', ia.genero);
    poner('p-concentracion', ia.concentracion);
    poner('p-salida', ia.salida);
    poner('p-corazon', ia.corazon);
    poner('p-fondo', ia.fondo);
    poner('p-ocasion', ia.ocasion);
    poner('p-longevidad', ia.longevidad);
    poner('p-proyeccion', ia.proyeccion);
    poner('p-desc', ia.desc);

    // Precios: en un perfume nuevo se llenan las tallas vacías que existen;
    // al editar no se toca ninguna (un precio vacío = esa talla no se vende).
    let llenadas = 0;
    if (!idActual) {
      for (const [ml, v] of Object.entries(ia.precios)) {
        const inp = document.getElementById(`px${ml}`);
        if (inp && !inp.value) { inp.value = v.sugerido; inp.classList.add('ia-lleno'); llenadas++; }
      }
    }
    pintarSugerenciaPrecios(ia);

    if (ia.confianza === 'baja') toast('La IA no está segura de este perfume: revisa notas y precios.', 'warning');
    else toast(llenadas ? 'Ficha lista. Revisa el precio sugerido antes de guardar.' : 'Ficha lista.', 'success');
  } catch (e) {
    console.error('IA completos:', e);
    toast('Error al consultar la IA: ' + e.message, 'error');
  } finally {
    btn.innerHTML = '<i class="bi bi-magic"></i> IA';
    btn.disabled = false;
  }
});

window.save = async function () {
  const btn = document.getElementById('btn-save');
  const nombre = document.getElementById('p-nombre').value.trim();
  const marca  = document.getElementById('p-marca').value.trim();
  const conc   = document.getElementById('p-concentracion').value;
  const genero = document.getElementById('p-genero').value;
  const disp   = document.getElementById('p-disponibilidad').value;

  // Solo lo indispensable: lo demás frenaba dar de alta una botella.
  if (!nombre || !marca) {
    toast('Pon al menos el nombre y la marca', 'error');
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

// Un toque: En stock → Agotado → Bajo pedido → En stock. Sin abrir el formulario.
const SIGUIENTE_DISP = { 'en-stock': 'agotado', 'agotado': 'bajo-pedido', 'bajo-pedido': 'en-stock' };
const NOMBRE_DISP = { 'en-stock': 'En stock', 'agotado': 'Agotado', 'bajo-pedido': 'Bajo pedido' };
window.cambiarDisponibilidad = async function (id) {
  const p = items.find(x => x.id === id);
  if (!p) return;
  const antes = p.disponibilidad || 'en-stock';
  const despues = SIGUIENTE_DISP[antes] || 'en-stock';
  p.disponibilidad = despues;
  renderTable();
  try {
    await updateDoc(doc(db, COL, id), { disponibilidad: despues, actualizadoEn: serverTimestamp() });
    toast(`${p.nombre}: ${NOMBRE_DISP[despues]}`, 'success');
  } catch (err) {
    p.disponibilidad = antes;
    renderTable();
    toast('No se pudo cambiar: ' + err.message, 'error');
  }
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
