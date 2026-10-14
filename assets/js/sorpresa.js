/**
 * sorpresa.js — Paquetes sorpresa (la "Calaverita"): precio y disponibilidad. Sin DOM.
 *
 * Un paquete sorpresa (`esSorpresa: true`) no deja elegir: sus `items` son el
 * caldero del que Fito saca el perfume al preparar el pedido.
 *
 * Precio como extra: en la talla de 3 ml, UNA sorpresa va a `precioExtra` por
 * cada paquete de la MISMA temporada que haya en el carrito (que no sea otra
 * sorpresa). Las demás van a su precio normal. Si se quita un paquete, se
 * recalcula solo: el precio guardado en el carrito siempre es el normal.
 */

/** ml de la talla de un renglón: "Paquete 3" / "3" → 3. */
const mlDe = size => {
  const n = parseFloat(String(size || '').replace(/^\s*paquete\s*/i, ''));
  return Number.isFinite(n) ? n : 0;
};

export const TALLA_EXTRA = 3;

/** ¿Se puede vender? Basta con que quede un perfume del caldero con stock. */
export function sorpresaDisponible(itemsResueltos) {
  return (itemsResueltos || []).some(i => i && !i.agotado);
}

/** Cuántas opciones hay en el caldero ahora mismo (sin decir cuáles). */
export function opcionesSorpresa(itemsResueltos) {
  return (itemsResueltos || []).filter(i => i && !i.agotado).length;
}

/** ¿Este renglón del carrito puede ir a precio de extra? */
const califica = it => !!(it && it.esSorpresa && it.temporada && Number(it.precioExtra) > 0
  && Number(it.precioExtra) < Number(it.price) && mlDe(it.size) === TALLA_EXTRA);

/** ¿Este renglón da derecho a una sorpresa a precio de extra? */
const daCupo = it => !!(it && it.esPaquete && it.temporada && !it.esSorpresa);

/**
 * Precio que se cobra en cada renglón del carrito.
 *
 * @param {Array} cart  Renglones {key, price, qty, size, esPaquete, esSorpresa, temporada, precioExtra}.
 * @returns {{renglones: Array<{key, qty, normal, extra, conExtra, total}>, total: number}}
 *   `conExtra` = cuántas piezas de ese renglón van a `extra`; el resto a `normal`.
 */
export function preciosDelCarrito(cart) {
  const lista = cart || [];
  // Cupo por temporada: un paquete (por pieza) = una sorpresa a precio de extra.
  const cupo = {};
  lista.forEach(it => { if (daCupo(it)) cupo[it.temporada] = (cupo[it.temporada] || 0) + (Number(it.qty) || 1); });

  const renglones = lista.map(it => {
    const qty = Number(it.qty) || 1;
    const normal = Number(it.price) || 0;
    let conExtra = 0;
    if (califica(it) && cupo[it.temporada] > 0) {
      conExtra = Math.min(qty, cupo[it.temporada]);
      cupo[it.temporada] -= conExtra;
    }
    const extra = conExtra ? Number(it.precioExtra) : normal;
    return { key: it.key, qty, normal, extra, conExtra, total: conExtra * extra + (qty - conExtra) * normal };
  });
  return { renglones, total: renglones.reduce((s, r) => s + r.total, 0) };
}

/** Texto del desglose: "1 a $49 (precio con paquete) + 2 a $59". */
export function desgloseSorpresa(r) {
  if (!r || !r.conExtra) return '';
  const resto = r.qty - r.conExtra;
  return `${r.conExtra} a $${r.extra} (precio con paquete)${resto ? ` + ${resto} a $${r.normal}` : ''}`;
}

/**
 * Para vender en el panel (Ventas y la canasta de Perfumes): una sorpresa se
 * maneja como "elige 1", así al registrarla Fito marca qué perfume salió del
 * caldero. Sin esto se guardaban los 11 perfumes y Estadísticas descontaba
 * 3 ml de cada uno. Solo en memoria: no cambia lo guardado.
 */
export function paraVenderEnPanel(paquete) {
  if (!paquete || !paquete.esSorpresa) return paquete;
  return { ...paquete, esPersonalizable: true, maxSeleccion: 1 };
}
