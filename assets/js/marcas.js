import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, auth, onAuthStateChanged }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('marcas');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let marcas = [], cats = [], perfCount = {};

async function load() {
  const [ms, cs, ps] = await Promise.all([
    getDocs(collection(db, 'marcas')),
    getDocs(collection(db, 'categorias')),
    getDocs(collection(db, 'perfumes'))
  ]);
  cats = []; cs.forEach(d => cats.push({ id: d.id, ...d.data() })); cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
  perfCount = {}; ps.forEach(d => { const m = (d.data().marca || ''); perfCount[m] = (perfCount[m] || 0) + 1; });
  marcas = []; ms.forEach(d => marcas.push({ id: d.id, ...d.data() })); marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const opts = cats.map(c => `<option>${c.nombre}</option>`).join('');
  document.getElementById('f-cat').innerHTML = `<option value="">Todas las categorias</option>${opts}`;
  document.getElementById('m-cat').innerHTML = `<option value="">Selecciona</option>${opts}`;
  window.render();
}

window.render = () => {
  const q = document.getElementById('search').value.toLowerCase();
  const fc = document.getElementById('f-cat').value;
  const fil = marcas.filter(m => (!q || m.nombre.toLowerCase().includes(q)) && (!fc || m.categoria === fc));
  document.getElementById('count-label').textContent = fil.length + ' marcas';
  const tb = document.getElementById('tbody');
  if (!fil.length) {
    tb.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="bi bi-award"></i><h3>Sin marcas</h3><p>Agrega la primera.</p></div></td></tr>';
    return;
  }
  tb.innerHTML = fil.map(m => `<tr>
    <td><strong>${m.nombre}</strong></td>
    <td><span class="badge badge-info">${m.categoria || '—'}</span></td>
    <td style="color:var(--text-muted);font-size:13px">${m.origen || '—'}</td>
    <td><span class="badge badge-gold">${perfCount[m.nombre] || 0} perfumes</span></td>
    <td><div style="display:flex;gap:8px">
      <button class="btn-icon" onclick="window.edit('${m.id}')"><i class="bi bi-pencil"></i></button>
      <button class="btn-icon" onclick="window.del('${m.id}','${m.nombre.replace(/'/g, '')}')"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
    </div></td>
  </tr>`).join('');
};

window.openModal = () => {
  ['m-id', 'm-nombre', 'm-origen', 'm-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-cat').value = '';
  document.getElementById('modal-title').textContent = 'Nueva Marca';
  document.getElementById('modal').classList.add('open');
};

window.closeModal = () => document.getElementById('modal').classList.remove('open');

window.edit = (id) => {
  const m = marcas.find(x => x.id === id);
  if (!m) return;
  document.getElementById('m-id').value = m.id;
  document.getElementById('m-nombre').value = m.nombre;
  document.getElementById('m-cat').value = m.categoria || '';
  document.getElementById('m-origen').value = m.origen || '';
  document.getElementById('m-desc').value = m.descripcion || '';
  document.getElementById('modal-title').textContent = 'Editar Marca';
  document.getElementById('modal').classList.add('open');
};

window.save = async () => {
  const id = document.getElementById('m-id').value;
  const nombre = document.getElementById('m-nombre').value.trim();
  const categoria = document.getElementById('m-cat').value;
  if (!nombre) { toast('Nombre obligatorio', 'error'); return; }
  if (!categoria) { toast('Selecciona categoria', 'error'); return; }
  const data = { nombre, categoria, origen: document.getElementById('m-origen').value.trim(), descripcion: document.getElementById('m-desc').value.trim() };
  try {
    if (id) await updateDoc(doc(db, 'marcas', id), data);
    else await addDoc(collection(db, 'marcas'), { ...data, creadoEn: Date.now() });
    toast(id ? 'Marca actualizada' : 'Marca creada', 'success');
    window.closeModal();
    load();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

window.del = async (id, nombre) => {
  if (!confirm('Eliminar marca ' + nombre + '?')) return;
  await deleteDoc(doc(db, 'marcas', id));
  toast('Eliminada', 'info');
  load();
};

onAuthStateChanged(auth, user => {
  if (user) load();
});
