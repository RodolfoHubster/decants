/**
 * admin-filtros.js — Agrupa los filtros del panel en un botón, sólo en móvil.
 *
 * En pantallas chicas los selects van a una columna (si no, el texto se corta),
 * y en Perfumes son ocho: la barra medía más que la pantalla y había que
 * desplazarse un buen rato antes de ver el primer producto.
 *
 * En vez de duplicar los controles, **se mueven los mismos nodos** al panel y
 * se devuelven a su sitio en escritorio. Así conservan su `id` y su `onchange`
 * en línea, y el resto del código de cada página sigue funcionando sin cambios.
 */

const BREAKPOINT   = 768;   // por debajo de esto, los filtros se agrupan
const MIN_SELECTS  = 3;     // con uno o dos no vale la pena esconderlos

let estado = null;          // { bar, selects: [{el, padre, siguiente}], … }

/** ¿El select está en algo distinto a su opción neutra ("Todas las marcas")? */
const estaActivo = (sel) => sel.selectedIndex > 0;

/** Texto de la primera opción: sirve de etiqueta del campo en el panel. */
const etiquetaDe = (sel) => (sel.options[0]?.text || 'Filtro').trim();

function contarActivos(selects) {
  return selects.filter(s => estaActivo(s.el)).length;
}

function actualizarBadge() {
  if (!estado) return;
  const n = contarActivos(estado.selects);
  const badge = estado.boton.querySelector('.fbtn-badge');
  badge.textContent = n;
  badge.hidden = n === 0;
  estado.boton.classList.toggle('con-filtros', n > 0);
}

function abrir() {
  estado.panel.classList.add('open');
  estado.overlay.classList.add('open');
  document.body.classList.add('filtros-open');
}

function cerrar() {
  estado.panel.classList.remove('open');
  estado.overlay.classList.remove('open');
  document.body.classList.remove('filtros-open');
}

/** Construye el botón y el panel, y traslada los selects adentro. */
function agrupar(bar) {
  const selects = [...bar.querySelectorAll('select')];
  if (selects.length < MIN_SELECTS) return;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'fbtn-filtros';
  boton.innerHTML = '<i class="bi bi-sliders"></i> Filtros <span class="fbtn-badge" hidden>0</span>';

  const overlay = document.createElement('div');
  overlay.className = 'admin-filtros-overlay';

  const panel = document.createElement('div');
  panel.className = 'admin-filtros-panel';
  panel.innerHTML = `
    <div class="afp-head">
      <span class="afp-title"><i class="bi bi-sliders"></i> Filtros</span>
      <button type="button" class="afp-close" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="afp-body"></div>
    <div class="afp-foot">
      <button type="button" class="afp-clear">Limpiar</button>
      <button type="button" class="afp-apply">Ver resultados</button>
    </div>`;

  const cuerpo = panel.querySelector('.afp-body');

  // Guardar de dónde salió cada select para poder devolverlo tal cual.
  const movidos = selects.map(el => {
    const ref = { el, padre: el.parentNode, siguiente: el.nextSibling };
    const campo = document.createElement('label');
    campo.className = 'afp-campo';
    const txt = document.createElement('span');
    txt.textContent = etiquetaDe(el);
    campo.appendChild(txt);
    campo.appendChild(el);          // mover, no clonar
    cuerpo.appendChild(campo);
    return ref;
  });

  bar.appendChild(boton);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  estado = { bar, boton, panel, overlay, selects: movidos };

  boton.addEventListener('click', abrir);
  overlay.addEventListener('click', cerrar);
  panel.querySelector('.afp-close').addEventListener('click', cerrar);
  panel.querySelector('.afp-apply').addEventListener('click', cerrar);
  panel.querySelector('.afp-clear').addEventListener('click', () => {
    movidos.forEach(({ el }) => {
      if (!estaActivo(el)) return;
      el.selectedIndex = 0;
      // Disparar el mismo evento que usa la página para repintar.
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    actualizarBadge();
  });

  // Cada cambio actualiza el contador del botón.
  movidos.forEach(({ el }) => el.addEventListener('change', actualizarBadge));

  actualizarBadge();
}

/** Devuelve los selects a la barra y desmonta el panel. */
function desagrupar() {
  if (!estado) return;
  estado.selects.forEach(({ el, padre, siguiente }) => padre.insertBefore(el, siguiente));
  estado.boton.remove();
  estado.panel.remove();
  estado.overlay.remove();
  document.body.classList.remove('filtros-open');
  estado = null;
}

function sincronizar() {
  const bar = document.querySelector('.page-body .filter-bar');
  if (!bar) return;
  const movil = window.innerWidth <= BREAKPOINT;
  if (movil && !estado) agrupar(bar);
  else if (!movil && estado) desagrupar();
}

/** Arranca el agrupado y lo mantiene al rotar o cambiar de tamaño. */
export function initFiltrosAdmin() {
  sincronizar();
  let t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(sincronizar, 150);
  });
}
