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

/**
 * Cambios a guardar en un perfume cuando se compra una botella nueva para
 * decantar (restock). La nueva botella pasa a ser la activa y el perfume deja
 * de estar agotado.
 *
 * Si el perfume es de antes de que existieran los lotes (costoBotella suelto),
 * esa botella vieja se conserva como primer lote: si no, su historial de
 * ventas se quedaría sin costo y la rentabilidad saldría inflada.
 */
export function agregarBotella(perfume, { costo, tamano, fecha = Date.now() } = {}) {
  const p = perfume || {};
  const lotes = Array.isArray(p.lotes) ? p.lotes.map(l => ({ ...l })) : [];
  if (!lotes.length && (p.costoBotella || p.tamanoBotella)) {
    lotes.push({
      id: 'lote-' + (Number(p.creadoEn) || fecha - 1),
      fecha: Number(p.creadoEn) || fecha - 1,
      costo: Number(p.costoBotella) || 0,
      tamano: Number(p.tamanoBotella) || 0
    });
  }
  let id = 'lote-' + fecha;
  while (lotes.some(l => l.id === id)) id += 'b';
  lotes.push({ id, fecha, costo: Number(costo) || 0, tamano: Number(tamano) || 0 });
  return { lotes, loteActivo: id, estadoStock: 'normal' };
}

// Fecha de compra de una botella en ms: se guardó como número o como 'AAAA-MM-DD'.
function fechaDeLote(l) {
  const f = l && l.fecha;
  if (typeof f === 'number') return f;
  const partes = String(f || '').split('-');
  if (partes.length === 3) return new Date(+partes[0], +partes[1] - 1, +partes[2]).getTime();
  const t = new Date(f).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const inicioDelDia = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * De qué botella sale una venta nueva.
 *
 * Manda la botella que el dueño marcó como activa (el círculo en Perfumes):
 * si la venta es del día en que se compró esa botella o después, sale de
 * ella, aunque haya botellas más nuevas guardadas. Antes ganaba siempre la
 * botella más nueva por fecha, y registrar una botella de reserva movía todas
 * las ventas a esa.
 *
 * Una venta con fecha anterior a la botella activa (un día viejo que se
 * registra tarde) sale de la botella que había en ese momento: la más nueva
 * comprada hasta ese día.
 *
 * @param {{lotes?:Array, loteActivo?:string}} p
 * @param {number|null} fechaVenta  ms; sin fecha = hoy.
 * @returns {string} id de la botella.
 */
export function loteParaVenta(p, fechaVenta) {
  if (!p) return 'lote-1';
  const lotes = Array.isArray(p.lotes) ? p.lotes.filter(Boolean) : [];
  if (!lotes.length) return p.loteActivo || 'lote-1';
  const activa = lotes.find(l => l.id === p.loteActivo);
  const venta = Number(fechaVenta);
  if (!fechaVenta || Number.isNaN(venta)) return (activa || lotes[lotes.length - 1]).id;
  if (activa && venta >= inicioDelDia(fechaDeLote(activa))) return activa.id;
  const ordenados = [...lotes].sort((a, b) => fechaDeLote(a) - fechaDeLote(b));
  let mejor = ordenados[0];
  ordenados.forEach(l => { if (inicioDelDia(fechaDeLote(l)) <= venta) mejor = l; });
  return mejor.id;
}
