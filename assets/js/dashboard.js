import { db, collection, getDocs } from '../../assets/js/firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import '../../admin/auth-guard.js';
import { resumenVentas, topVendidos, pendientes } from './alertas.js';
import { indiceClientes } from './clientes-util.js';

// Índice ligero de clientes para que la canasta reconozca a quien ya compró.
// Se guarda en el teléfono: la canasta no tiene que leer todas las ventas.
function guardarIndiceClientes(lista) {
  try {
    const idx = indiceClientes(lista).slice(0, 400)
      .map(({ nombre, compras, ultima, ultimoPerfume }) => ({ nombre, compras, ultima, ultimoPerfume }));
    localStorage.setItem('fitoClientes', JSON.stringify(idx));
  } catch (e) { /* sin storage: la canasta funciona igual, solo sin sugerencias */ }
}


renderSidebar('dashboard');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

const $ = id => document.getElementById(id);
const dinero = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function saludo(ahora) {
  const h = new Date(ahora).getHours();
  $('hoy-saludo').textContent = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  $('hoy-fecha').textContent = new Date(ahora).toLocaleDateString('es-MX',
    { weekday: 'long', day: 'numeric', month: 'long' });
}

function pintarDinero(r) {
  $('d-hoy').textContent = dinero(r.hoy);
  $('d-hoy-sub').textContent = r.piezasHoy
    ? `${r.piezasHoy} ${r.piezasHoy === 1 ? 'pieza' : 'piezas'}`
    : 'Todavía nada hoy';
  $('d-semana').textContent = dinero(r.semana);
  $('d-mes').textContent = dinero(r.mes);

  const c = $('d-cambio');
  if (r.cambioMes === null) {
    c.textContent = '';
  } else {
    const sube = r.cambioMes >= 0;
    c.className = 'dinero-cambio ' + (sube ? 'sube' : 'baja');
    c.innerHTML = `<i class="bi bi-arrow-${sube ? 'up' : 'down'}-right"></i> ${Math.abs(r.cambioMes)}% vs. mes pasado`;
    c.title = `El mes pasado a esta misma altura llevabas ${dinero(r.mesPasado)}`;
  }
}

const ICONO = {
  cobrar: 'bi-cash-coin', pedidos: 'bi-globe2', encargos: 'bi-kanban',
  restock: 'bi-arrow-repeat', 'sin-precio': 'bi-tag', 'sin-imagen': 'bi-image',
  'img-externa': 'bi-cloud-arrow-up', puntos: 'bi-shop-window', 'sin-ventas': 'bi-journal-plus'
};

function pintarPendientes(lista) {
  const cont = $('pendientes');
  $('pend-count').textContent = lista.length ? lista.length : '';

  if (!lista.length) {
    cont.innerHTML = `
      <div class="pend-vacio">
        <i class="bi bi-check2-circle"></i>
        <strong>Todo al día</strong>
        <span>No hay nada urgente. Buen momento para subir un perfume nuevo.</span>
      </div>`;
    return;
  }

  cont.innerHTML = lista.map(p => `
    <a class="pend pend-${p.nivel}" href="${esc(p.href)}">
      <span class="pend-ico"><i class="bi ${ICONO[p.clave] || 'bi-dot'}"></i></span>
      <span class="pend-texto">
        <strong>${esc(p.titulo)}</strong>
        <span>${esc(p.detalle)}</span>
        ${p.items.length ? `<ul>${p.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      </span>
      <i class="bi bi-chevron-right pend-ir"></i>
    </a>`).join('');
}

function pintarTop(top) {
  const ol = $('top-mes');
  if (!top.length) {
    ol.innerHTML = '<li class="pend-cargando">Aún no hay ventas este mes.</li>';
    return;
  }
  const max = top[0].unidades;
  ol.innerHTML = top.map((t, i) => `
    <li>
      <span class="top-pos">${i + 1}</span>
      <span class="top-info">
        <strong>${esc(t.nombre)}</strong>
        <span class="top-barra"><span style="width:${Math.max(8, (t.unidades / max) * 100)}%"></span></span>
      </span>
      <span class="top-num">${t.unidades}<small> pzs</small><em>${dinero(t.total)}</em></span>
    </li>`).join('');
}

function pintarCatalogo(perfumes) {
  const vivos = perfumes.filter(p => p.activo !== false && p.archivado !== true);
  const agotados = vivos.filter(p => p.estadoStock === 'agotado').length;
  $('hoy-catalogo').innerHTML = `
    <a href="perfumes.html"><strong>${vivos.length}</strong> perfumes visibles</a>
    <span>·</span>
    <a href="perfumes.html"><strong>${agotados}</strong> agotados</a>`;
}

async function cargar() {
  const ahora = Date.now();
  saludo(ahora);

  // Cada lectura cuesta: solo lo que esta pantalla usa.
  const leer = col => getDocs(collection(db, col))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
    .catch(e => { console.warn(`No se pudo leer ${col}:`, e.message); return []; });

  const [perfumes, ventas, encargos, pedidos, consignaciones] = await Promise.all([
    leer('perfumes'), leer('ventas'), leer('ordenes_completos'), leer('pedidos'), leer('consignaciones')
  ]);

  guardarIndiceClientes(ventas);
  pintarDinero(resumenVentas(ventas, ahora));
  pintarPendientes(pendientes({ perfumes, ventas, encargos, pedidos, consignaciones }, ahora));
  const d = new Date(ahora);
  pintarTop(topVendidos(ventas, new Date(d.getFullYear(), d.getMonth(), 1).getTime()));
  pintarCatalogo(perfumes);
}

cargar();
