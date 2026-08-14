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
  if (id) return id;
  const nombre = (venta.cliente || '').trim();
  if (esNombreGenerico(nombre)) return null;
  return `NAMED-${nombre.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}
