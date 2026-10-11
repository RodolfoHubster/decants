/**
 * puntos-externos.js — Lo que dejas en barberías y otros puntos. Sin DOM.
 *
 * Cada perfume que dejas en un punto es un renglón con:
 *   cantidad    → decants para vender
 *   vendidos    → los que el punto ya vendió
 *   probadores  → decants de prueba (no se cobran; se gastan)
 *   loteId      → la botella de donde se sirvieron (la asignada al perfume)
 *
 * Todo sale de la botella en cuanto se sirve: lo que está en exhibición y los
 * probadores ya no están en tu frasco aunque no se hayan vendido.
 */
import { mlDeTalla, lotesDe, loteDeVenta, insumoUnitario, consumoPorBotella } from './rentabilidad.js';

/** La botella de la que se sirve hoy: la asignada (loteActivo) o la más nueva. */
export function botellaAsignada(p) {
  const lotes = lotesDe(p);
  if (!lotes.length) return null;
  return lotes.find(l => l.id === p.loteActivo) || lotes[lotes.length - 1];
}

const abierto = punto => (punto && punto.estado) !== 'Cerrado';

/**
 * Piezas que ya salieron de tus botellas por un punto, en el formato que usa
 * consumoDePerfume: lo que sigue en exhibición (si el punto sigue abierto) y
 * los probadores (siempre: ya se gastaron). Lo vendido va por su venta.
 */
export function piezasFueraDeBotella(puntos) {
  const out = [];
  (puntos || []).forEach(pt => {
    (pt.items || []).forEach(it => {
      const enExhibicion = abierto(pt) ? Math.max(0, (+it.cantidad || 0) - (+it.vendidos || 0)) : 0;
      const piezas = enExhibicion + (+it.probadores || 0);
      if (piezas > 0) out.push({ perfumeId: it.perfumeId, talla: it.talla, cantidad: piezas, loteId: it.loteId });
    });
  });
  return out;
}

/** Ventas de un punto: las nuevas traen puntoId; las viejas, el lugar como cliente. */
export function ventasDelPunto(punto, ventas) {
  return (ventas || []).filter(v => v && v.estado !== 'cancelada' && v.canal === 'consignacion' && (
    v.puntoId ? v.puntoId === punto.id
      : (v.cliente || '').trim().toLowerCase() === (punto.lugar || '').trim().toLowerCase()
        && (Number(v.creadoEn) || 0) >= (Number(punto.creadoEn) || 0)));
}

/** Números de la tarjeta de un punto. */
export function resumenPunto(punto, ventas) {
  const items = (punto && punto.items) || [];
  const dejados = items.reduce((s, it) => s + (+it.cantidad || 0), 0);
  const vendidos = items.reduce((s, it) => s + Math.min(+it.vendidos || 0, +it.cantidad || 0), 0);
  const probadores = items.reduce((s, it) => s + (+it.probadores || 0), 0);
  const vs = ventasDelPunto(punto, ventas);
  const vendido = vs.reduce((s, v) => s + (+v.precio || 0) * (+v.cantidad || 1), 0);
  const comision = vs.reduce((s, v) => s + (+v.comision || 0) * (+v.cantidad || 1), 0);
  const quedan = dejados - vendidos;
  const valorEnExhibicion = items.reduce((s, it) =>
    s + Math.max(0, (+it.cantidad || 0) - (+it.vendidos || 0)) * (+it.precio || 0), 0);
  return { dejados, vendidos, quedan, probadores, vendido, comision, paraTi: vendido - comision, valorEnExhibicion };
}

/**
 * ¿Alcanza la botella asignada para lo que vas a dejar?
 *
 * @param {Array} filas  [{perfumeId, talla, cantidad, probadores}] del formulario.
 *   En una edición, `cantidad` es lo que sigue sin vender + lo nuevo; lo ya
 *   guardado de este punto NO debe venir en `fuera` para no contarlo doble.
 * @param {Map} perfumesPorId
 * @param {Array} ventas
 * @param {Array} fuera  piezasFueraDeBotella() de los OTROS puntos.
 * @returns {Array<{perfumeId, nombre, ml, botella, restante, despues, alcanza}>}
 */
export function revisarDisponibilidad(filas, perfumesPorId, ventas, fuera = []) {
  const porPerfume = new Map();
  (filas || []).forEach(f => {
    if (!f || !f.perfumeId) return;
    const piezas = Math.max(0, (+f.cantidad || 0) - (+f.vendidos || 0)) + (+f.probadores || 0);
    porPerfume.set(f.perfumeId, (porPerfume.get(f.perfumeId) || 0) + piezas * mlDeTalla(f.talla));
  });
  return [...porPerfume].map(([perfumeId, ml]) => {
    const p = perfumesPorId.get(perfumeId);
    const asignada = p && botellaAsignada(p);
    if (!asignada) return { perfumeId, nombre: p ? p.nombre : '', ml, botella: null, restante: null, despues: null, alcanza: true };
    const b = consumoPorBotella(p, ventas, fuera).botellas.find(x => x.id === asignada.id);
    const despues = b.restante - ml;
    return { perfumeId, nombre: p.nombre, ml, botella: b.idx + 1, restante: b.restante, despues, alcanza: despues >= 0 };
  });
}

/**
 * Lo que te costaron los probadores dejados desde `desde` (líquido de su
 * botella + frasco y etiqueta). Es gasto de promoción: se resta de la ganancia.
 */
export function costoProbadores(puntos, ctx, desde = 0) {
  const op = (ctx && ctx.costosOp) || {};
  const insumo = insumoUnitario(op) - (+op.bolsa || 0); // un probador no lleva bolsa
  let total = 0, piezas = 0;
  (puntos || []).forEach(pt => {
    if ((Number(pt.creadoEn) || 0) < desde) return;
    (pt.items || []).forEach(it => {
      const n = +it.probadores || 0;
      if (!n) return;
      const p = ctx.perfumesPorId.get(it.perfumeId);
      const l = loteDeVenta(p, it.loteId || (p && p.loteActivo));
      const costoMl = l ? (+l.costo || 0) / (parseFloat(l.tamano) || 100) : 0;
      total += n * (mlDeTalla(it.talla) * costoMl + insumo);
      piezas += n;
    });
  });
  return { total, piezas };
}
