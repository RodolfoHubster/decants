import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('categorias');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let cats = [], perfCount = {};

async function load() {
  const [cs, ps] = await Promise.all([
    getDocs(collection(db, 'categorias')),
    getDocs(collection(db, 'perfumes'))
  ]);
  perfCount = {};
  ps.forEach(d => { const c = (d.data().categoria || ''); perfCount[c] = (perfCount[c] || 0) + 1; });
  cats = []; cs.forEach(d => cats.push({ id: d.id, ...d.data() }));
  cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
  document.getElementById('count-label').textContent = cats.length + ' categorias';
  const tb = document.getElementById('tbody');
  if (!cats.length) {
    tb.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="bi bi-tags"></i><h3>Sin categorias</h3><p>Agrega la primera.</p></div></td></tr>';
    return;
  }
  tb.innerHTML = cats.map(c => `<tr>
    <td><strong>${c.nombre}</strong></td>
    <td style="color:var(--text-muted);font-size:13px">${c.descripcion || '—'}</td>
    <td><span class="badge badge-gold">${perfCount[c.nombre] || 0} perfumes</span></td>
    <td><div style="display:flex;gap:8px">
      <button class="btn-icon" onclick="window.edit('${c.id}')"><i class="bi bi-pencil"></i></button>
      <button class="btn-icon" onclick="window.del('${c.id}','${c.nombre.replace(/'/g, '')}')"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
    </div></td>
  </tr>`).join('');
}

window.openModal = () => {
  document.getElementById('cat-id').value = '';
  document.getElementById('cat-nombre').value = '';
  document.getElementById('cat-desc').value = '';
  document.getElementById('modal-title').textContent = 'Nueva Categoria';
  document.getElementById('modal').classList.add('open');
};

window.closeModal = () => document.getElementById('modal').classList.remove('open');

window.edit = (id) => {
  const c = cats.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cat-id').value = c.id;
  document.getElementById('cat-nombre').value = c.nombre;
  document.getElementById('cat-desc').value = c.descripcion || '';
  document.getElementById('modal-title').textContent = 'Editar Categoria';
  document.getElementById('modal').classList.add('open');
};

window.save = async () => {
  const id = document.getElementById('cat-id').value;
  const nombre = document.getElementById('cat-nombre').value.trim();
  if (!nombre) { toast('Nombre obligatorio', 'error'); return; }
  const data = { nombre, descripcion: document.getElementById('cat-desc').value.trim() };
  try {
    if (id) await updateDoc(doc(db, 'categorias', id), data);
    else await addDoc(collection(db, 'categorias'), { ...data, creadoEn: Date.now() });
    toast(id ? 'Categoria actualizada' : 'Categoria creada', 'success');
    window.closeModal();
    load();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

window.del = async (id, nombre) => {
  if (!confirm('Eliminar ' + nombre + '?')) return;
  await deleteDoc(doc(db, 'categorias', id));
  toast('Eliminada', 'info');
  load();
};

load();
