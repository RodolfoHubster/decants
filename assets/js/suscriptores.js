import { db, collection, getDocs, doc, deleteDoc, onAuthStateChanged, auth } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import '../../admin/auth-guard.js';
import { novedadesDesde, armarCorreo } from './newsletter.js';
import { imgCard } from './cloudinary.js';
import { rutaProducto } from './slug.js?v=2';

// Suscriptores del newsletter y correo de novedades para pegar en Brevo.
// Los links del correo van al sitio publicado (no a localhost).
const SITIO = 'https://rodolfohubster.github.io/decants/';

let suscriptores = [];
let perfumes = [];
let completos = [];
let correo = { html: '', texto: '', total: 0 };

renderSidebar('suscriptores');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, type = 'info') {
  const c = $('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
}

async function copiar(texto, aviso) {
  try { await navigator.clipboard.writeText(texto); toast(aviso, 'success'); }
  catch (e) { toast('No se pudo copiar. Intenta de nuevo.', 'error'); }
}

function pintarSuscriptores() {
  $('sus-total').innerHTML = `${suscriptores.length}<small>${suscriptores.length === 1 ? 'persona' : 'personas'}</small>`;
  $('sus-lista').innerHTML = suscriptores.length
    ? suscriptores.map(s => `
        <div class="sus-item">
          <span class="sus-mail">${esc(s.email)}</span>
          <small>${new Date(s.creadoEn || 0).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</small>
          <button class="btn-icon" data-quitar="${esc(s.id)}" title="Quitar de la lista"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
        </div>`).join('')
    : '<div class="sus-vacio">Todavía nadie se anota. La cajita está en el pie de la tienda.</div>';
}

window.armarNovedades = () => {
  const dias = Number($('nov-desde').value) || 7;
  const novedades = novedadesDesde({ perfumes, completos }, Date.now() - dias * 86400000);
  correo = armarCorreo(novedades, { base: SITIO, link: rutaProducto, img: imgCard });
  $('nov-resumen').textContent = correo.total
    ? `${novedades.decants.length} decant${novedades.decants.length === 1 ? '' : 's'} y ${novedades.completos.length} perfume${novedades.completos.length === 1 ? '' : 's'} completo${novedades.completos.length === 1 ? '' : 's'}`
    : 'No agregaste nada nuevo en ese periodo.';
  $('nov-preview').srcdoc = `<!doctype html><meta charset="utf-8"><body style="margin:0">${correo.html}</body>`;
};

// El correo va en data-quitar (no dentro del onclick): uno con apóstrofo rompía el botón.
document.addEventListener('click', e => {
  const b = e.target.closest('[data-quitar]');
  if (b) window.quitarSuscriptor(b.dataset.quitar);
});

window.copiarCorreos = () => copiar(suscriptores.map(s => s.email).join('\n'), `${suscriptores.length} correos copiados`);
window.copiarHTML = () => copiar(correo.html, 'HTML copiado: pégalo en Brevo');
window.copiarTexto = () => copiar(correo.texto, 'Texto copiado');

window.descargarCSV = () => {
  // Una celda que empieza con = + - @ Excel la toma como fórmula: se antepone ' .
  const celda = v => { const t = String(v ?? ''); return /^[=+\-@]/.test(t) ? `'${t}` : t; };
  const filas = [['EMAIL', 'FECHA_ALTA'], ...suscriptores.map(s => [celda(s.email), new Date(s.creadoEn || 0).toISOString().slice(0, 10)])];
  const csv = filas.map(f => f.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `suscriptores-fitoscents-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

window.quitarSuscriptor = async (id) => {
  if (!confirm(`¿Quitar a ${id} de la lista?`)) return;
  try {
    await deleteDoc(doc(db, 'suscriptores', id));
    suscriptores = suscriptores.filter(s => s.id !== id);
    pintarSuscriptores();
    toast('Quitado de la lista', 'success');
  } catch (e) {
    console.error(e);
    toast('No se pudo quitar: ' + e.message, 'error');
  }
};

async function cargar() {
  try {
    const [sSnap, pSnap, qSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'suscriptores')),
      getDocs(collection(db, 'perfumes')),
      getDocs(collection(db, 'paquetes')),
      getDocs(collection(db, 'perfumes_completos')),
    ]);
    suscriptores = [];
    sSnap.forEach(d => suscriptores.push({ id: d.id, ...d.data() }));
    suscriptores.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
    perfumes = [];
    pSnap.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
    qSnap.forEach(d => perfumes.push({ id: d.id, tipo: 'paquete', ...d.data() }));
    completos = [];
    cSnap.forEach(d => completos.push({ id: d.id, ...d.data() }));
    pintarSuscriptores();
    window.armarNovedades();
  } catch (e) {
    console.error(e);
    $('sus-lista').innerHTML = `<div class="sus-vacio">No se pudo cargar: ${esc(e.message)}. ¿Ya publicaste las reglas de Firestore?</div>`;
  }
}

onAuthStateChanged(auth, user => { if (user) cargar(); });
