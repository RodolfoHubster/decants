import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';

let insumos = [];

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('costos');
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadCostosGenerales();
      await loadInsumos();
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
      actualizadoEn: Date.now()
    };
    
    await setDoc(doc(db, 'config', 'costosOperativos'), data);
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
