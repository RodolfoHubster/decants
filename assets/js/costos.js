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
    renderInsumos();
  } catch(e) {
    console.error("Error loading insumos:", e);
    document.getElementById('materia-list').innerHTML = '<div style="color:var(--danger);padding:15px">Error al cargar datos.</div>';
  }
}

function renderInsumos() {
  const list = document.getElementById('materia-list');
  if (insumos.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:13px;">No hay compras registradas.</div>';
    return;
  }
  
  // Sort descending by date
  insumos.sort((a,b) => (b.fecha || 0) - (a.fecha || 0));
  
  const typeIcons = {
    'botella_vidrio': '<i class="bi bi-droplet" style="color:#4f98a3"></i>',
    'botella_plastico': '<i class="bi bi-droplet-half" style="color:#a38b4f"></i>',
    'botella_reforzada': '<i class="bi bi-shield-check" style="color:var(--gold)"></i>',
    'etiquetas': '<i class="bi bi-tags" style="color:#7a4fa3"></i>',
    'bolsas': '<i class="bi bi-bag" style="color:#4fa365"></i>',
    'otro': '<i class="bi bi-box" style="color:#888"></i>'
  };
  
  const typeNames = {
    'botella_vidrio': 'Botella de Vidrio',
    'botella_plastico': 'Botella de Plástico',
    'botella_reforzada': 'Botella Reforzada',
    'etiquetas': 'Etiquetas',
    'bolsas': 'Bolsas / Empaque',
    'otro': 'Otro'
  };

  list.innerHTML = insumos.map(ins => {
    const date = new Date(ins.fecha).toLocaleDateString('es-MX');
    const unitario = (ins.total / ins.cantidad).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    const total = (ins.total).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    
    return `
    <div class="insumo-item">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:24px;width:32px;text-align:center">${typeIcons[ins.tipo] || typeIcons['otro']}</div>
        <div class="insumo-info">
          <div class="insumo-name">${typeNames[ins.tipo] || 'Insumo'} <span style="color:var(--text-muted);font-weight:400;font-size:12px">(${date})</span></div>
          <div class="insumo-detail">${ins.descripcion || 'Sin descripción'} — ${ins.cantidad} unidades a ${unitario} c/u</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:15px;">
        <div style="font-weight:600;font-size:15px;color:var(--accent)">${total}</div>
        <button class="btn-icon" onclick="deleteInsumo('${ins.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div>
    </div>
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

window.saveMateria = async () => {
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
      tipo, descripcion: desc, cantidad: cant, total,
      fecha: Date.now()
    };
    
    await addDoc(collection(db, 'insumos'), data);
    toast('Compra registrada', 'success');
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
  if (!confirm('¿Eliminar este registro de compra?')) return;
  try {
    await deleteDoc(doc(db, 'insumos', id));
    toast('Eliminado', 'info');
    loadInsumos();
  } catch(e) {
    toast('Error al eliminar', 'error');
  }
};
