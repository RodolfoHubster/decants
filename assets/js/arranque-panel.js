/**
 * arranque-panel.js — Lo primero que corre en cada página del panel.
 *
 * Antes los esqueletos los pintaba sidebar.js, que primero espera a que baje
 * Firebase (cientos de KB). Mientras, se veía la página a medio armar con
 * "$0", "0 perfumes" y la tabla vacía; luego todo se cambiaba por barras de
 * carga y luego llegaban los datos: tres pantallas distintas en un segundo.
 *
 * Este módulo solo depende de esqueleto.js y admin-filtros.js (chiquitos, sin
 * Firebase), así que corre en cuanto
 * termina de leerse la página: pinta los esqueletos, cambia las cifras de
 * relleno por barras y marca <html class="panel-listo">, que es lo que
 * global.css espera para mostrar el contenido. Queda: barras → datos.
 *
 * Cada página lo carga con su propia etiqueta (antes que su módulo) y
 * sidebar.js también lo importa, por si alguna página no la trae: es el mismo
 * módulo, así que corre una sola vez.
 */
import { desdeAtributo, esValorDeRelleno, vistaPerfumes } from './esqueleto.js?v=2';
import { initFiltrosAdmin } from './admin-filtros.js';

// Cifras que el HTML trae en 0 y que cada página llena al cargar.
const CIFRAS = '.kpi-value, .stat-mini .val, [id^="k-count-"], #count-label, #kpi-ml, #res-mes-total, #res-por-decant';

document.querySelectorAll('[data-esq]').forEach(el => { el.innerHTML = desdeAtributo(el.dataset.esq); });
document.querySelectorAll(CIFRAS).forEach(el => {
  if (!el.children.length && esValorDeRelleno(el.textContent)) el.innerHTML = '<i class="esq esq-num" aria-hidden="true"></i>';
});
// Perfumes: tabla o tarjetas desde el principio (antes se decidía al bajar
// Firebase y en el celular el esqueleto brincaba de tabla a tarjetas).
const tabla = document.querySelector('.table-wrap');
const rejilla = document.getElementById('pos-grid');
if (tabla && rejilla) {
  let guardada = null;
  try { guardada = localStorage.getItem('adminPerfumeView'); } catch { /* sin almacenamiento */ }
  const pidePos = new URLSearchParams(location.search).get('pos') === '1';
  if (vistaPerfumes({ guardada, pidePos, ancho: window.innerWidth }) === 'grid') {
    tabla.style.display = 'none';
    rejilla.style.display = 'grid';
    const btn = document.getElementById('btn-toggle-view');
    if (btn) btn.innerHTML = '<i class="bi bi-list-ul"></i>';
  }
}

// La búsqueda que tenías se pone desde el principio (antes aparecía hasta que
// llegaban los datos, encima de lo que ya hubieras escrito). Si la caja ya
// trae algo, no se toca: <input data-recordar="claveEnSessionStorage:campo">.
document.querySelectorAll('input[data-recordar]').forEach(el => {
  if (el.value) return;
  const [clave, campo] = el.dataset.recordar.split(':');
  try {
    const v = JSON.parse(sessionStorage.getItem(clave) || '{}')[campo];
    if (typeof v === 'string') el.value = v;
  } catch { /* sin almacenamiento o dato roto: la caja se queda vacía */ }
});

// En el celular los filtros se juntan en un botón; antes eso esperaba a Firebase
// y la búsqueda se veía encimada con el orden mientras tanto.
initFiltrosAdmin();
document.documentElement.classList.add('panel-listo');
