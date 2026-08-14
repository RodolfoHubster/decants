/**
 * precios.js — Cómo se presentan los precios de las tallas.
 *
 * Regla de negocio: **nunca se muestra el precio por mililitro**. FitoScents
 * vende el mismo perfume en decant y en botella completa, y la botella sale
 * a un tercio por ml (Hawas for Him: $7/ml en 100ml contra $23/ml en 3ml).
 * Publicar la tarifa por ml le entrega al cliente el número exacto para
 * concluir que el decant es caro, y puede comprobarlo en el mismo sitio.
 *
 * El empujón hacia la talla grande se da en positivo: cuánto se ahorra
 * frente a comprar varias chicas.
 *
 * Módulo puro y sin dependencias: lo importan el catálogo y los tests.
 */

/**
 * Cuánto se ahorra al llevar una talla en vez de varias más chicas.
 *
 * Solo compara contra tallas que caben un número exacto de veces (10ml
 * frente a dos de 5ml), para que la cuenta sea verificable. Se queda con el
 * mayor ahorro encontrado.
 *
 * @param {Array<[string|number, string|number]>} sizes  Pares [ml, precio].
 * @param {string|number} talla   Talla evaluada, en ml.
 * @param {string|number} precio  Precio de esa talla.
 * @returns {number} Ahorro en pesos, redondeado; 0 si no hay comparación.
 */
export function ahorroPorTalla(sizes, talla, precio) {
  const ml = +talla, px = +precio;
  if (!(ml > 0) || !(px > 0)) return 0;

  let mejor = 0;
  for (const [k, v] of (sizes || [])) {
    const kMl = +k, kPx = +v;
    if (!(kMl > 0) || !(kPx > 0) || kMl >= ml) continue;
    if (ml % kMl !== 0) continue;                 // solo múltiplos exactos
    mejor = Math.max(mejor, Math.round((ml / kMl) * kPx - px));
  }
  return mejor;
}
