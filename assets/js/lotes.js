/**
 * lotes.js — Resolución de a qué botella (lote) pertenece una venta.
 *
 * Módulo puro y sin dependencias: se importa tanto desde el código de la app
 * como desde los tests, para que las pruebas validen la lógica real.
 */

/**
 * Devuelve el id del lote al que corresponde una venta.
 *
 * Las ventas históricas se guardaron con `loteId` vacío o con ids que ya no
 * existen (lotes borrados o reemplazados), así que un match estricto las dejaba
 * fuera de todos los lotes y los ml vendidos salían por debajo de la realidad.
 *
 * @param {Array<{id:string}>} lotes  Lotes actuales del perfume, en orden.
 * @param {string|undefined|null} loteId  `loteId` guardado en la venta.
 * @returns {string|null} Id del lote correspondiente, o null si no hay lotes.
 */
export function resolveLoteId(lotes, loteId) {
  if (!Array.isArray(lotes) || lotes.length === 0) return null;
  if (lotes.length === 1) return lotes[0].id;
  const match = lotes.find(l => l && l.id === loteId);
  return match ? match.id : lotes[0].id;
}

/**
 * Filtra las ventas que pertenecen a un lote concreto.
 *
 * @param {Array<object>} ventas  Historial de ventas del perfume.
 * @param {Array<{id:string}>} lotes  Lotes actuales del perfume, en orden.
 * @param {string} loteId  Lote cuyo historial se quiere obtener.
 * @returns {Array<object>}
 */
export function ventasDeLote(ventas, lotes, loteId) {
  if (!Array.isArray(ventas)) return [];
  return ventas.filter(v => resolveLoteId(lotes, v.loteId) === loteId);
}

/**
 * Detecta si una venta corresponde al "Resto de botella".
 *
 * La talla se guardó de formas distintas según la pantalla que la escribió
 * ("Resto", "resto", "Resto ml"), por eso la comparación es flexible.
 *
 * @param {string} talla
 * @returns {boolean}
 */
export function esResto(talla) {
  return (talla || '').trim().toLowerCase().startsWith('resto');
}
