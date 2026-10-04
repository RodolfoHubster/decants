import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { agregarBotella } from './lotes.js';
import { borrarCache } from './catalogo-cache.js';

let insumos = [];
let perfumes = [];

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('costos');
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadCostosGenerales();
      await Promise.all([loadInsumos(), loadPerfumes()]);
      const qs = new URLSearchParams(location.search);
      if (qs.get('botella') === '1') window.openBotellaModal(qs.get('id'));
      if (qs.get('insumo') === '1') window.openMateriaModal();
    }
  });
  
  // Calcular unitario en tiempo real en modal
  document.getElementById('m-cant').addEventListener('input', calcUnitario);
  document.getElementById('m-total').addEventListener('input', calcUnitario);
  
  // Calcular total insumos en tiempo real
  ['c-botella', 'c-etiqueta', 'c-bolsa'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcTotalInsumos);
  });
});

window.toast = (msg, type = 'info') => {
  const d = document.createElement('div');
  d.className = `toast toast-${type}`;
  d.textContent = msg;
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  setTimeout(() => {
    d.classList.remove('show');
    setTimeout(() => d.remove(), 300);
  }, 3000);
};

// ── COSTOS GENERALES (Documento Fijo) ──
async function loadCostosGenerales() {
  try {
    const docSnap = await getDoc(doc(db, 'config', 'costosOperativos'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('c-botella').value = data.botella || '';
      document.getElementById('c-etiqueta').value = data.etiqueta || '';
      document.getElementById('c-bolsa').value = data.bolsa || '';
      document.getElementById('c-reforzada-venta').value = data.reforzadaVenta || '';
      document.getElementById('c-reforzada-costo').value = data.reforzadaCosto || '';
      document.getElementById('c-disable-2ml').checked = !!data.disable2ml;
      calcTotalInsumos();
    }
  } catch(e) {
    console.error("Error loading config:", e);
  }
}

window.guardarCostosGenerales = async () => {
  const btn = document.getElementById('btn-save-gral');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
  
  try {
    const data = {
      botella: +document.getElementById('c-botella').value || 0,
      etiqueta: +document.getElementById('c-etiqueta').value || 0,
      bolsa: +document.getElementById('c-bolsa').value || 0,
      reforzadaVenta: +document.getElementById('c-reforzada-venta').value || 0,
      reforzadaCosto: +document.getElementById('c-reforzada-costo').value || 0,
      disable2ml: document.getElementById('c-disable-2ml').checked,
      actualizadoEn: Date.now()
    };
    
    await setDoc(doc(db, 'config', 'costosOperativos'), data);
    // La tienda solo lee esto; tus costos quedan privados (config/costosOperativos).
    await setDoc(doc(db, 'config', 'tienda'), { disable2ml: data.disable2ml }, { merge: true });
    toast('Costos actualizados correctamente', 'success');
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar Cambios';
  }
};

function calcTotalInsumos() {
  const b = +document.getElementById('c-botella').value || 0;
  const e = +document.getElementById('c-etiqueta').value || 0;
  const bo = +document.getElementById('c-bolsa').value || 0;
  const total = b + e + bo;
  document.getElementById('c-total-insumos').textContent = total.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  const r = document.getElementById('res-por-decant');
  if (r) r.textContent = total.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
}

// ── CRUD MATERIA PRIMA ──
async function loadInsumos() {
  try {
    const querySnapshot = await getDocs(collection(db, 'insumos'));
    insumos = querySnapshot.docs.map(d => ({id: d.id, ...d.data()}));
    populateMonthFilter();
    renderInsumos();
    updateKPIs();
  } catch(e) {
    console.error("Error loading insumos:", e);
    document.getElementById('materia-list').innerHTML = '<tr><td colspan="7" style="color:var(--danger);padding:15px;text-align:center;">Error al cargar datos.</td></tr>';
  }
}

function populateMonthFilter() {
  const fMes = document.getElementById('f-mes');
  if (!fMes) return;
  const months = new Set();
  insumos.forEach(ins => {
    if (ins.fecha) {
      const d = new Date(ins.fecha);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  });
  
  const sortedMonths = Array.from(months).sort().reverse();
  
  let html = '<option value="todos">Todos los meses</option>';
  sortedMonths.forEach(m => {
    const [y, mo] = m.split('-');
    const dateObj = new Date(y, parseInt(mo)-1, 1);
    const monthName = dateObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    html += `<option value="${m}">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</option>`;
  });
  
  const val = fMes.value;
  fMes.innerHTML = html;
  if (sortedMonths.includes(val)) fMes.value = val;
}

function updateKPIs() {
  const d = new Date();
  const currentMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  
  let totalHist = 0;
  let totalMes = 0;
  let totalUnidadesDecant = 0;
  let totalCostoDecant = 0;
  
  insumos.forEach(ins => {
    const cost = +ins.total || 0;
    const qty = +ins.cantidad || 0;
    
    totalHist += cost;
    
    if (ins.fecha) {
      const insD = new Date(ins.fecha);
      const mKey = `${insD.getFullYear()}-${String(insD.getMonth() + 1).padStart(2, '0')}`;
      if (mKey === currentMonthKey) {
        totalMes += cost;
      }
    }
    
    // Para el promedio automático, consideramos envases (vidrio, plastico, reforzada), etiquetas y bolsas
    if (['botella_vidrio', 'botella_plastico', 'botella_reforzada', 'etiquetas', 'bolsas'].includes(ins.tipo)) {
      totalCostoDecant += cost;
      if (['botella_vidrio', 'botella_plastico', 'botella_reforzada'].includes(ins.tipo)) {
         totalUnidadesDecant += qty; // asumimos que la cantidad de botellas es la base para dividir
      }
    }
  });
  
  document.getElementById('kpi-total-hist').textContent = totalHist.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'});
  document.getElementById('kpi-total-mes').textContent = totalMes.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'});
  document.getElementById('kpi-compras').textContent = insumos.length;
  window._gastoInsumosMes = totalMes;
  renderResumen();
  
  let promedioCalc = 0;
  if (totalUnidadesDecant > 0) {
    promedioCalc = totalCostoDecant / totalUnidadesDecant;
  }
  
  document.getElementById('kpi-promedio').textContent = promedioCalc.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'});
  
  const banner = document.getElementById('promedio-banner');
  if (promedioCalc > 0) {
    const sugVal = document.getElementById('sugerencia-val');
    if (sugVal) sugVal.textContent = promedioCalc.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'});
    if (banner) banner.style.display = 'block';
    window._promedioCalculado = promedioCalc;
  } else if (banner) {
    banner.style.display = 'none';
  }
}

window.aplicarPromedioCalculado = () => {
  if (window._promedioCalculado > 0) {
    // Distribuir equitativamente o solo en botella por simplicidad. Lo ponemos en botella y borramos el resto para que sume el total exacto, o calculamos porcentualmente. 
    // Para simplificar, ponemos todo en 'botella' y 0 en el resto para reflejar el promedio global.
    document.getElementById('c-botella').value = window._promedioCalculado.toFixed(2);
    document.getElementById('c-etiqueta').value = '0';
    document.getElementById('c-bolsa').value = '0';
    calcTotalInsumos();
    toast('Promedio aplicado a Botella. No olvides Guardar Cambios.', 'info');
  }
};

function renderInsumos() {
  const list = document.getElementById('materia-list');
  const fMes = document.getElementById('f-mes')?.value || 'todos';
  
  let filtered = insumos;
  if (fMes !== 'todos') {
    filtered = insumos.filter(ins => {
      if (!ins.fecha) return false;
      const d = new Date(ins.fecha);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mKey === fMes;
    });
  }

  if (filtered.length === 0) {
    list.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-faint);font-size:13px;">No hay compras en este periodo.</td></tr>';
    return;
  }
  
  // Sort descending by date
  filtered.sort((a,b) => (b.fecha || 0) - (a.fecha || 0));
  
  const typeIcons = {
    'botella_vidrio': '<i class="bi bi-droplet" style="color:#4f98a3"></i>',
    'botella_plastico': '<i class="bi bi-droplet-half" style="color:#a38b4f"></i>',
    'botella_reforzada': '<i class="bi bi-shield-check" style="color:var(--gold)"></i>',
    'kit_decant_travel': '<i class="bi bi-airplane" style="color:#f59e0b"></i>',
    'frasco_vidrio': '<i class="bi bi-droplet-fill" style="color:#0ea5e9"></i>',
    'atomizador': '<i class="bi bi-wind" style="color:#6366f1"></i>',
    'etiquetas': '<i class="bi bi-tags" style="color:#7a4fa3"></i>',
    'bolsas': '<i class="bi bi-bag" style="color:#4fa365"></i>',
    'cinta': '<i class="bi bi-tape" style="color:#eab308"></i>',
    'otro': '<i class="bi bi-box" style="color:#888"></i>'
  };
  
  const typeNames = {
    'botella_vidrio': 'Botella de Vidrio',
    'botella_plastico': 'Botella de Plástico',
    'botella_reforzada': 'Botella Reforzada',
    'kit_decant_travel': 'Kit Decant Travel',
    'frasco_vidrio': 'Frasco de Vidrio (Suelto)',
    'atomizador': 'Atomizador',
    'etiquetas': 'Etiquetas',
    'bolsas': 'Bolsas / Empaque',
    'cinta': 'Cinta / Embalaje',
    'otro': 'Otro'
  };

  list.innerHTML = filtered.map(ins => {
    const date = new Date(ins.fecha).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'});
    const unitario = (ins.total / ins.cantidad).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    const total = (ins.total).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    
    return `
    <tr>
      <td style="color:var(--text-muted);font-size:12px;">${date}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:16px;">${typeIcons[ins.tipo] || typeIcons['otro']}</div>
          <div>${typeNames[ins.tipo] || 'Insumo'}</div>
        </div>
      </td>
      <td style="color:var(--text-muted);">${ins.descripcion || '—'}</td>
      <td><span class="badge-ml">${ins.cantidad} ud</span></td>
      <td>${unitario}</td>
      <td><strong>${total}</strong></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="editInsumo('${ins.id}')" title="Editar"><i class="bi bi-pencil-square"></i></button>
          <button class="btn-icon" onclick="deleteInsumo('${ins.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

window.openMateriaModal = () => {
  document.getElementById('m-id').value = '';
  document.getElementById('m-tipo').value = 'botella_vidrio';
  document.getElementById('m-desc').value = '';
  document.getElementById('m-cant').value = '';
  document.getElementById('m-total').value = '';
  document.getElementById('m-unitario').textContent = '$0.00';
  document.getElementById('modal-materia-title').textContent = 'Registrar Compra';
  document.getElementById('modal-materia').classList.add('open');
};

window.closeMateriaModal = () => {
  document.getElementById('modal-materia').classList.remove('open');
};

function calcUnitario() {
  const cant = +document.getElementById('m-cant').value || 0;
  const total = +document.getElementById('m-total').value || 0;
  if (cant > 0) {
    document.getElementById('m-unitario').textContent = (total/cant).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
  } else {
    document.getElementById('m-unitario').textContent = '$0.00';
  }
}

window.editInsumo = (id) => {
  const ins = insumos.find(x => x.id === id);
  if (!ins) return;
  
  document.getElementById('m-id').value = id;
  document.getElementById('m-tipo').value = ins.tipo;
  document.getElementById('m-desc').value = ins.descripcion || '';
  document.getElementById('m-cant').value = ins.cantidad;
  document.getElementById('m-total').value = ins.total;
  calcUnitario();
  
  document.getElementById('modal-materia-title').textContent = 'Editar Compra';
  document.getElementById('modal-materia').classList.add('open');
};

window.saveMateria = async () => {
  const id = document.getElementById('m-id').value;
  const tipo = document.getElementById('m-tipo').value;
  const desc = document.getElementById('m-desc').value.trim();
  const cant = +document.getElementById('m-cant').value;
  const total = +document.getElementById('m-total').value;
  
  if (!cant || !total) {
    toast('Ingresa cantidad y costo total', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-save-materia');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i>...';
  
  try {
    const data = {
      tipo, descripcion: desc, cantidad: cant, total
    };
    
    if (id) {
      await updateDoc(doc(db, 'insumos', id), data);
      toast('Compra actualizada', 'success');
    } else {
      data.fecha = Date.now();
      await addDoc(collection(db, 'insumos'), data);
      toast('Compra registrada', 'success');
    }
    closeMateriaModal();
    loadInsumos();
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

window.deleteInsumo = async (id) => {
  if (confirm('¿Estás seguro de eliminar esta compra?')) {
    try {
      await deleteDoc(doc(db, 'insumos', id));
      toast('Compra eliminada', 'success');
      loadInsumos();
    } catch(e) {
      toast('Error al eliminar: ' + e.message, 'error');
    }
  }
};


// ── BOTELLAS DE PERFUME (lotes) ─────────────────────────────────────────────
// Comprar una botella para decantar es un "lote" dentro del perfume. Antes no
// había dónde registrarlo desde aquí y el gasto más grande no aparecía.

const mx = n => (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const escH = t => String(t ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadPerfumes() {
  try {
    const snap = await getDocs(collection(db, 'perfumes'));
    perfumes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error loading perfumes:', e);
  }
  renderBotellas();
  renderResumen();
}

function botellasCompradas() {
  const out = [];
  perfumes.forEach(p => (p.lotes || []).forEach(l => {
    if (l && l.fecha) out.push({ perfume: p.nombre, pid: p.id, ...l });
  }));
  return out.sort((a, b) => b.fecha - a.fecha);
}

function renderResumen() {
  const d = new Date();
  const mes0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const botMes = botellasCompradas().filter(b => b.fecha >= mes0);
  const gastoBot = botMes.reduce((s, b) => s + (+b.costo || 0), 0);
  const gastoIns = window._gastoInsumosMes || 0;
  const el = document.getElementById('res-mes-total');
  if (!el) return;
  el.textContent = mx(gastoBot + gastoIns);
  const partes = [];
  if (gastoBot) partes.push(`${mx(gastoBot)} en ${botMes.length} ${botMes.length === 1 ? 'botella' : 'botellas'} de perfume`);
  if (gastoIns) partes.push(`${mx(gastoIns)} en insumos`);
  document.getElementById('res-mes-desglose').textContent = partes.length ? partes.join(' · ') : 'Nada registrado este mes';
}

function renderBotellas() {
  const cont = document.getElementById('botellas-list');
  if (!cont) return;
  const desde = Date.now() - 90 * 86400000;
  const lista = botellasCompradas().filter(b => b.fecha >= desde);
  if (!lista.length) {
    cont.innerHTML = '<div class="vacio">No has registrado botellas en los últimos 90 días. Usa el botón de arriba cuando compres una.</div>';
    return;
  }
  cont.innerHTML = lista.slice(0, 20).map(b => `
    <div class="compra-fila">
      <div>
        <strong>${escH(b.perfume)}</strong>
        <span>${new Date(b.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${+b.tamano || '?'} ml</span>
      </div>
      <div class="monto">${mx(+b.costo)}</div>
    </div>`).join('');
}

window.openBotellaModal = (pid) => {
  ['b-buscar', 'b-costo', 'b-perfume-id'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('b-tamano').value = 100;
  // Fecha local: toISOString() da la de UTC y en la tarde ya era "mañana".
  const hoy = new Date();
  document.getElementById('b-fecha').value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  document.getElementById('b-resultados').innerHTML = '';
  document.getElementById('b-elegido').hidden = true;
  document.getElementById('b-buscar').hidden = false;
  document.getElementById('b-aviso').textContent = '';
  document.getElementById('modal-botella').classList.add('open');
  document.body.classList.add('modal-open');
  if (pid) elegirPerfume(pid);
  else setTimeout(() => document.getElementById('b-buscar').focus(), 50);
};

window.closeBotellaModal = () => {
  document.getElementById('modal-botella').classList.remove('open');
  document.body.classList.remove('modal-open');
};

function elegirPerfume(pid) {
  const p = perfumes.find(x => x.id === pid);
  if (!p) return;
  document.getElementById('b-perfume-id').value = pid;
  document.getElementById('b-resultados').innerHTML = '';
  document.getElementById('b-buscar').hidden = true;
  const el = document.getElementById('b-elegido');
  el.hidden = false;
  el.innerHTML = `<span><strong>${escH(p.nombre)}</strong> <small style="color:var(--text-muted)">${escH(p.marca || '')}</small></span>
                  <button type="button" onclick="cambiarPerfumeBotella()">Cambiar</button>`;
  const ultimo = (p.lotes || []).slice(-1)[0];
  if (ultimo) {
    if (+ultimo.tamano) document.getElementById('b-tamano').value = +ultimo.tamano;
    document.getElementById('b-costo').placeholder = `La anterior te costó ${mx(+ultimo.costo)}`;
  }
  document.getElementById('b-aviso').textContent = p.estadoStock === 'agotado'
    ? 'Estaba como agotado: al guardar vuelve a estar disponible en la tienda.'
    : 'Esta botella pasa a ser la activa: las próximas ventas se descuentan de ella.';
  document.getElementById('b-costo').focus();
}
window.elegirPerfumeBotella = elegirPerfume;

window.cambiarPerfumeBotella = () => {
  document.getElementById('b-perfume-id').value = '';
  document.getElementById('b-elegido').hidden = true;
  const b = document.getElementById('b-buscar');
  b.hidden = false; b.value = ''; b.focus();
};

document.addEventListener('input', (e) => {
  if (e.target.id !== 'b-buscar') return;
  const q = e.target.value.trim().toLowerCase();
  const cont = document.getElementById('b-resultados');
  if (q.length < 2) { cont.innerHTML = ''; return; }
  const hits = perfumes
    .filter(p => p.archivado !== true)
    .filter(p => `${p.nombre} ${p.marca || ''}`.toLowerCase().includes(q))
    // Primero los agotados: lo más probable es que estés reponiendo uno de esos.
    .sort((a, b) => (b.estadoStock === 'agotado') - (a.estadoStock === 'agotado'))
    .slice(0, 8);
  cont.innerHTML = hits.length
    ? hits.map(p => `<button type="button" onclick="elegirPerfumeBotella('${p.id}')">${escH(p.nombre)}<small>${escH(p.marca || '')}${p.estadoStock === 'agotado' ? ' · agotado' : ''}</small></button>`).join('')
    : '<div class="vacio">No encontré ese perfume. Primero dalo de alta en Perfumes.</div>';
});

window.saveBotella = async () => {
  const pid = document.getElementById('b-perfume-id').value;
  const costo = +document.getElementById('b-costo').value;
  const tamano = +document.getElementById('b-tamano').value;
  const f = document.getElementById('b-fecha').value;
  if (!pid) return toast('Elige de qué perfume es la botella', 'error');
  if (!(costo > 0)) return toast('¿Cuánto te costó?', 'error');
  if (!(tamano > 0)) return toast('Pon el tamaño en ml', 'error');

  const p = perfumes.find(x => x.id === pid);
  const fecha = f ? new Date(f + 'T12:00:00').getTime() : Date.now();
  const cambios = agregarBotella(p, { costo, tamano, fecha });

  const btn = document.getElementById('btn-save-botella');
  btn.disabled = true;
  try {
    await updateDoc(doc(db, 'perfumes', pid), cambios);
    Object.assign(p, cambios);
    borrarCache();  // que la tienda no muestre el agotado viejo en esta pestaña
    window.closeBotellaModal();
    toast(`Botella de ${p.nombre} registrada`, 'success');
    renderBotellas();
    renderResumen();
  } catch (e) {
    console.error(e);
    toast('No se pudo guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
};
