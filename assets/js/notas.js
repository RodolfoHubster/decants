import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, writeBatch }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('notas');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

// ── Estado ───────────────────────────────────────────────────────────────────
let activeTab = 'familias';   // 'familias' | 'tipos'
let familias = [];
let tipos    = [];

// ── Tabs ─────────────────────────────────────────────────────────────────────
window.setTab = (tab) => {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  renderTable();
};

// ── Cargar ────────────────────────────────────────────────────────────────────
async function loadAll() {
  const [fs, ts] = await Promise.all([
    getDocs(collection(db, 'familias_olfativas')),
    getDocs(collection(db, 'tipos_perfume'))
  ]);
  familias = [];
  fs.forEach(d => familias.push({ id: d.id, ...d.data() }));
  familias.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre));

  tipos = [];
  ts.forEach(d => tipos.push({ id: d.id, ...d.data() }));
  tipos.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre));

  renderTable();
}

// ── Render tabla ──────────────────────────────────────────────────────────────
function renderTable() {
  const lista = activeTab === 'familias' ? familias : tipos;
  const label = activeTab === 'familias' ? 'familia olfativa' : 'tipo de perfume';

  document.getElementById('count-label').textContent = lista.length + ' ' +
    (lista.length === 1 ? label : label + 's');

  const tbody = document.getElementById('tbody');
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <i class="bi bi-flower1"></i>
        <h3>Sin ${label}s</h3>
        <p>Agrega tu primera ${label} con el botón de arriba.</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((item, idx) => `
    <tr>
      <td style="font-size:22px;text-align:center;width:48px"><i class="${item.emoji || 'bi bi-dash'}"></i></td>
      <td><strong>${item.nombre}</strong></td>
      <td style="color:var(--text-muted);font-size:13px">${item.descripcion || '—'}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn-icon" onclick="openModal('${item.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon" onclick="del('${item.id}','${item.nombre.replace(/'/g,"&apos;")}')"
          title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
window.openModal = (id = null) => {
  const lista = activeTab === 'familias' ? familias : tipos;
  const item  = id ? lista.find(x => x.id === id) : null;

  document.getElementById('n-id').value          = item?.id          || '';
  document.getElementById('n-nombre').value      = item?.nombre      || '';
  document.getElementById('n-emoji').value       = item?.emoji       || '';
  document.getElementById('n-descripcion').value = item?.descripcion || '';
  document.getElementById('emoji-live-icon').className = item?.emoji || 'bi bi-question-circle';
  document.getElementById('modal-title').textContent = item
    ? `Editar ${activeTab === 'familias' ? 'familia olfativa' : 'tipo'}`
    : `Nueva ${activeTab === 'familias' ? 'familia olfativa' : 'tipo'}`;
  document.getElementById('modal').classList.add('open');
  document.getElementById('n-nombre').focus();
};

window.closeModal = () => document.getElementById('modal').classList.remove('open');

window.save = async () => {
  const id     = document.getElementById('n-id').value.trim();
  const nombre = document.getElementById('n-nombre').value.trim();
  const emoji  = document.getElementById('n-emoji').value.trim();
  const desc   = document.getElementById('n-descripcion').value.trim();

  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }

  const colName = activeTab === 'familias' ? 'familias_olfativas' : 'tipos_perfume';
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

  try {
    const data = { nombre, emoji, descripcion: desc };
    if (id) {
      await updateDoc(doc(db, colName, id), data);
      toast(`${activeTab === 'familias' ? 'Familia' : 'Tipo'} actualizado`, 'success');
    } else {
      const lista = activeTab === 'familias' ? familias : tipos;
      await addDoc(collection(db, colName), { ...data, orden: lista.length });
      toast(`${activeTab === 'familias' ? 'Familia' : 'Tipo'} creado`, 'success');
    }
    closeModal();
    loadAll();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

window.del = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  const colName = activeTab === 'familias' ? 'familias_olfativas' : 'tipos_perfume';
  await deleteDoc(doc(db, colName, id));
  toast('Eliminado', 'info');
  loadAll();
};

loadAll();
