import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';

let accesorios = [];

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('accesorios');
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadAccesorios();
    } else {
      window.location.href = '../index.html';
    }
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

async function loadAccesorios() {
  try {
    const querySnapshot = await getDocs(collection(db, 'accesorios'));
    accesorios = querySnapshot.docs.map(d => ({id: d.id, ...d.data()}));
    renderTable();
  } catch(e) {
    console.error("Error loading accesorios:", e);
    document.getElementById('tbody').innerHTML = '<tr><td colspan="6" style="color:var(--danger);padding:15px;text-align:center;">Error al cargar datos.</td></tr>';
  }
}

function renderTable() {
  const tb = document.getElementById('tbody');
  document.getElementById('count-label').textContent = `${accesorios.length} accesorios`;
  
  if (accesorios.length === 0) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-faint)">No hay accesorios registrados.</td></tr>';
    return;
  }
  
  // Sort by name
  accesorios.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));
  
  tb.innerHTML = accesorios.map(acc => {
    const estadoBadge = acc.activo !== false 
      ? '<span class="badge badge-success">Activo</span>' 
      : '<span class="badge badge-warning" style="color:#000">Oculto</span>';
      
    const stockBadge = (acc.stock <= 0) 
      ? '<span class="badge badge-danger">Agotado</span>' 
      : (acc.stock <= 10 ? `<span class="badge badge-warning" style="color:#000">${acc.stock}</span>` : `<span>${acc.stock}</span>`);

    let precioStr = `$${acc.precio || 0}`;
    if ((!acc.precio || acc.precio === 0) && acc.precios) {
      const pVals = Object.values(acc.precios).filter(v => +v > 0);
      if (pVals.length > 0) {
        precioStr = `$${Math.min(...pVals)} - $${Math.max(...pVals)}`;
      }
    }

    return `
    <tr>
      <td style="font-weight:500;">${acc.nombre}</td>
      <td style="color:var(--text-muted)">$${acc.costo || 0}</td>
      <td style="font-weight:600;color:var(--accent)">${precioStr}</td>
      <td>${stockBadge}</td>
      <td>${estadoBadge}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="editAccesorio('${acc.id}')" title="Editar"><i class="bi bi-pencil-square"></i></button>
          <button class="btn-icon" onclick="deleteAccesorio('${acc.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

window.openModal = () => {
  document.getElementById('a-id').value = '';
  document.getElementById('a-nombre').value = '';
  document.getElementById('a-costo').value = '';
  document.getElementById('a-precio').value = '';
  document.getElementById('a-stock').value = '';
  document.getElementById('a-activo').value = 'true';
  [2,3,5,10].forEach(ml => {
    const el = document.getElementById(`a-px${ml}`);
    if (el) el.value = '';
  });
  document.getElementById('modal-title').textContent = 'Nuevo Accesorio';
  document.getElementById('modal').classList.add('open');
};

window.closeModal = () => {
  document.getElementById('modal').classList.remove('open');
};

window.editAccesorio = (id) => {
  const acc = accesorios.find(x => x.id === id);
  if (!acc) return;
  
  document.getElementById('a-id').value = id;
  document.getElementById('a-nombre').value = acc.nombre;
  document.getElementById('a-costo').value = acc.costo || '';
  document.getElementById('a-precio').value = acc.precio || '';
  document.getElementById('a-stock').value = acc.stock || 0;
  document.getElementById('a-activo').value = acc.activo !== false ? 'true' : 'false';
  
  [2,3,5,10].forEach(ml => {
    const el = document.getElementById(`a-px${ml}`);
    if (el) el.value = acc.precios && acc.precios[ml] ? acc.precios[ml] : '';
  });
  
  document.getElementById('modal-title').textContent = 'Editar Accesorio';
  document.getElementById('modal').classList.add('open');
};

window.save = async () => {
  const id = document.getElementById('a-id').value;
  const nombre = document.getElementById('a-nombre').value.trim();
  const costo = +document.getElementById('a-costo').value;
  const precio = +document.getElementById('a-precio').value;
  const stock = +document.getElementById('a-stock').value;
  const activo = document.getElementById('a-activo').value === 'true';
  
  if (!nombre || isNaN(costo) || isNaN(precio) || isNaN(stock)) {
    toast('Completa todos los campos correctamente', 'error');
    return;
  }
  
  const precios = {};
  [2,3,5,10].forEach(ml => {
    const el = document.getElementById(`a-px${ml}`);
    if (el && el.value) precios[ml] = +el.value;
  });
  
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i>...';
  
  try {
    const data = { nombre, costo, precio, stock, activo, precios };
    
    if (id) {
      data.actualizadoEn = Date.now();
      await updateDoc(doc(db, 'accesorios', id), data);
      toast('Accesorio actualizado', 'success');
    } else {
      data.creadoEn = Date.now();
      await addDoc(collection(db, 'accesorios'), data);
      toast('Accesorio creado', 'success');
    }
    closeModal();
    loadAccesorios();
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

window.deleteAccesorio = async (id) => {
  if (confirm('¿Estás seguro de eliminar este accesorio?')) {
    try {
      await deleteDoc(doc(db, 'accesorios', id));
      toast('Accesorio eliminado', 'success');
      loadAccesorios();
    } catch(e) {
      toast('Error al eliminar: ' + e.message, 'error');
    }
  }
};
