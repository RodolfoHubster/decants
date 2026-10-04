/**
 * clientes-util.js — Identidad de clientes (reales vs. temporales).
 *
 * En Sobre Ruedas la gente llega, compra y se va: se registran como "Cliente 8",
 * "Cliente 12", etc. Esos números se reinician en cada jornada, así que el mismo
 * texto NO representa a la misma persona entre días distintos. Agruparlos por
 * nombre inventa clientes recurrentes que no existen.
 *
 * Al guardar la venta, ventas.js ya asigna:
 *   - `SR-<fecha>-<num>`  para clientes temporales (atado al día)
 *   - `NAMED-<slug>`      para clientes con nombre real
 *
 * Módulo puro y sin dependencias: lo importan la app y los tests.
 */

const RE_GENERICO = /^cliente\s*\d*$/i;

// Quita acentos convirtiéndolos (é → e), no borrándolos: antes "Pérez" acababa
// como "prez", distinto de "Perez".
const normNombre = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * ¿El nombre es un marcador genérico del punto de venta, no un nombre real?
 *
 * @param {string} nombre
 * @returns {boolean} true también si viene vacío.
 */
export function esNombreGenerico(nombre) {
  const n = (nombre || '').trim().toLowerCase();
  if (!n) return true;
  return RE_GENERICO.test(n) || n === 'cliente (sin nombre)';
}

/**
 * ¿La venta corresponde a un cliente de paso (no debe contarse como recurrente)?
 *
 * Se confía en `clienteId` cuando existe; si no (datos viejos), se cae al nombre.
 *
 * @param {{clienteId?:string, cliente?:string}} venta
 * @returns {boolean}
 */
export function esClienteTemporal(venta) {
  if (!venta) return true;
  const id = (venta.clienteId || '').trim();
  if (id) return id.startsWith('SR-');
  return esNombreGenerico(venta.cliente);
}

/**
 * Clave estable para agrupar ventas del mismo cliente real.
 *
 * @param {{clienteId?:string, cliente?:string}} venta
 * @returns {string|null} null si no hay un cliente identificable.
 */
export function claveCliente(venta) {
  if (!venta) return null;
  const id = (venta.clienteId || '').trim();
  if (id.startsWith('SR-')) return id;
  const nombre = (venta.cliente || '').trim();
  // Los NAMED- viejos se guardaron borrando la letra acentuada ("María" →
  // "mara"), así que la misma persona tenía dos ids. Se recalcula del nombre.
  if (nombre && !esNombreGenerico(nombre)) return `NAMED-${normNombre(nombre)}`;
  return id || null;
}

/**
 * Id que se guarda en la venta: `SR-<fecha>-<num>` para los "Cliente N" de
 * paso (atado al día) y `NAMED-<nombre sin acentos>` para clientes reales, así
 * "María López" y "Maria Lopez" son la misma persona.
 *
 * @param {string} nombre
 * @param {string} fechaStr  Día de la venta (YYYY-MM-DD).
 */
export function idCliente(nombre, fechaStr) {
  const n = String(nombre || '').trim();
  if (!n) return '';
  if (esNombreGenerico(n) || n.toLowerCase() === 'cliente (sin nombre)') {
    const num = (n.match(/\d+/) || ['000'])[0].padStart(3, '0');
    return `SR-${fechaStr}-${num}`;
  }
  return `NAMED-${normNombre(n)}`;
}

/**
 * Clientes con nombre que ya han comprado, agrupados por su clave (así "Juan
 * Pérez" y "juan perez" cuentan como uno). Excluye a los "Cliente N" de paso y
 * las ventas canceladas. Ordenado por compra más reciente.
 *
 * Una "compra" es un día distinto: cinco decants en el mismo ticket cuentan
 * como una visita, que es lo que importa para saber si alguien regresa.
 */

export function indiceClientes(ventas) {
  const por = new Map();
  (ventas || []).forEach(v => {
    // Las ventas de puntos externos llevan el nombre del lugar, no de una persona.
    if (!v || v.estado === 'cancelada' || v.canal === 'consignacion' || esClienteTemporal(v)) return;
    const nombre = (v.cliente || '').trim();
    const clave = normNombre(nombre);
    if (!clave) return;
    const t = typeof v.creadoEn === 'number' ? v.creadoEn
      : (v.creadoEn && typeof v.creadoEn.seconds === 'number') ? v.creadoEn.seconds * 1000 : 0;
    const dia = t ? new Date(t).toDateString() : '';
    const g = por.get(clave) || { clave, nombre, dias: new Set(), total: 0, ultima: 0, ultimoPerfume: '' };
    if (dia) g.dias.add(dia);
    g.total += (Number(v.precio) || 0) * (Number(v.cantidad) || 1);
    if (t >= g.ultima) { g.ultima = t; g.nombre = nombre; g.ultimoPerfume = v.perfumeNombre || ''; }
    por.set(clave, g);
  });
  return [...por.values()]
    .map(({ dias, ...g }) => ({ ...g, compras: dias.size || 1 }))
    .sort((a, b) => b.ultima - a.ultima);
}

/** Busca en el índice a alguien por nombre, ignorando mayúsculas y acentos. */
export function buscarCliente(indice, nombre) {
  const n = normNombre(nombre);
  if (!n) return null;
  return (indice || []).find(c => normNombre(c.nombre) === n) || null;
}
