/**
 * esqueleto.js — Esqueletos de carga del panel. Sin DOM: solo arma el HTML.
 *
 * Un contenedor pide el suyo con un atributo y arranque-panel.js (lo primero
 * que corre en cada página del panel) lo pinta antes de que lleguen los datos:
 *
 *   <tbody data-esq="tabla:10:8:foto:150">  columnas, filas, foto en la 1ª columna
 *                                           y alto de la fila (63 px si se omite)
 *   <div data-esq="tarjetas:6:150">      cuántas y de qué alto
 *   <div data-esq="lista:5:44">          renglones y su alto
 *
 * Las filas de tabla son <tr>/<td> reales: toman el ancho y el alto de la tabla
 * de verdad, así al llegar los datos nada cambia de tamaño. Las ruedas se
 * quedan solo para botones.
 */
const ANCHOS = [72, 54, 86, 61, 78, 48, 66];
const ancho = i => ANCHOS[i % ANCHOS.length];
const num = (v, d) => { const n = parseInt(v, 10); return n > 0 ? n : d; };

/** Una barrita brillante del ancho indicado (en %). */
export function barra(pct = 100) {
  return `<i class="esq" style="width:${pct}%"></i>`;
}

/** Filas de tabla. Con `foto`, la primera celda lleva un cuadrito como la miniatura real. */
export function filasTabla(columnas, filas = 8, { foto = false, alto = 63 } = {}) {
  const celdas = i => Array.from({ length: columnas }, (_, c) => (
    `<td>${foto && c === 0 ? '<i class="esq esq-foto"></i>' : barra(ancho(i + c))}</td>`
  )).join('');
  return Array.from({ length: filas }, (_, i) => `<tr class="esq-fila" style="--alto:${alto}px" aria-hidden="true">${celdas(i)}</tr>`).join('');
}

/** Tarjetas del alto indicado; el contenedor decide cuántas caben por fila. */
export function tarjetas(n = 6, alto = 150) {
  return Array.from({ length: n }, (_, i) => `
    <div class="esq-tarjeta" style="min-height:${alto}px" aria-hidden="true">
      ${barra(ancho(i))}${barra(ancho(i + 2))}${barra(ancho(i + 4))}
    </div>`).join('');
}

/** Renglones del alto indicado. */
export function lista(n = 5, alto = 44) {
  return Array.from({ length: n }, (_, i) => `
    <div class="esq-renglon" style="height:${alto}px" aria-hidden="true">
      ${barra(ancho(i))}<i class="esq esq-chico"></i>
    </div>`).join('');
}

/**
 * ¿Es una cifra de relleno del HTML ("0", "$0", "$0.00", "0 perfumes")? Esas se
 * cambian por una barra mientras cargan: antes se veía "$0" y luego el dato real.
 */
export function esValorDeRelleno(texto) {
  return /^\$?0(?:\.00)?(?:\s+(?:perfumes?|ventas?|ml))?$/i.test(String(texto || '').trim());
}

/**
 * Perfumes en el panel: ¿tabla o tarjetas? Lo último que elegiste; si nunca
 * elegiste, tarjetas en el celular (480 px o menos). `?pos=1` siempre tarjetas.
 * La usan arranque-panel.js (para que el esqueleto ya salga en la vista buena)
 * y perfumes.js.
 * @returns {'grid'|'table'}
 */
export function vistaPerfumes({ guardada = null, pidePos = false, ancho = 1024 } = {}) {
  return pidePos || guardada === 'grid' || (ancho <= 480 && guardada !== 'table') ? 'grid' : 'table';
}

/** Lee `data-esq`. Un valor que no reconoce no pinta nada. */
export function desdeAtributo(valor) {
  const [tipo, a, b, c, d] = String(valor || '').split(':');
  if (tipo === 'tabla') return filasTabla(num(a, 5), num(b, 8), { foto: c === 'foto', alto: num(d, 63) });
  if (tipo === 'tarjetas') return tarjetas(num(a, 6), num(b, 150));
  if (tipo === 'lista') return lista(num(a, 5), num(b, 44));
  return '';
}
