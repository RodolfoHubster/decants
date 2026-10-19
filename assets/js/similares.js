/**
 * similares.js — "Productos similares" en la página de cada perfume. Sin DOM.
 *
 * Puntos por parecido: misma familia olfativa (3), mismo tipo — Diseñador,
 * Árabe, Nicho — (2), mismo género (2; Unisex combina con todos a 1), misma
 * marca (1) y precio parecido (1). Nunca sale el mismo producto, ni
 * accesorios, ni lo agotado o archivado.
 *
 * Para un paquete: primero los perfumes que trae y luego otros paquetes.
 */

const precioMin = p => {
  const vals = Object.values((p && p.precios) || {}).map(Number).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : (Number(p && p.precio) || 0);
};

const vendible = (p, agotado) => p && p.tipo !== 'accesorio' && p.activo !== false && !p.archivado && !(agotado && agotado(p));

function puntos(base, q) {
  let n = 0;
  if (base.familia && q.familia === base.familia) n += 3;
  if (base.categoria && q.categoria === base.categoria) n += 2;
  if (base.genero && q.genero) {
    if (q.genero === base.genero) n += 2;
    else if (q.genero === 'Unisex' || base.genero === 'Unisex') n += 1;
  }
  if (base.marca && q.marca === base.marca) n += 1;
  const a = precioMin(base), b = precioMin(q);
  if (a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= 0.25) n += 1;
  return n;
}

/**
 * @param {object} base  El producto de la página.
 * @param {Array} todos  Catálogo completo.
 * @param {{n?: number, agotado?: Function}} [op]
 * @returns {Array} hasta `n` productos, del más parecido al menos.
 */
export function similares(base, todos, { n = 10, agotado } = {}) {
  if (!base) return [];
  const lista = (todos || []).filter(q => q && q.id !== base.id && vendible(q, agotado));

  if (base.tipo === 'paquete') {
    const ids = new Set((base.items || []).map(i => i && i.id));
    const incluidos = lista.filter(q => ids.has(q.id));
    const paquetes = lista.filter(q => q.tipo === 'paquete' && !ids.has(q.id))
      .sort((a, b) => (Number(b.clicks) || 0) - (Number(a.clicks) || 0));
    return [...incluidos, ...paquetes].slice(0, n);
  }

  return lista
    .filter(q => q.tipo !== 'paquete')
    .map(q => ({ q, n: puntos(base, q) }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n || (Number(b.q.clicks) || 0) - (Number(a.q.clicks) || 0))
    .slice(0, n)
    .map(x => x.q);
}
