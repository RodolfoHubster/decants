/**
 * hero.js — Datos del encabezado del catálogo público.
 *
 * Módulo puro y sin dependencias: se importa desde catalog.js y desde los tests.
 */

const esPerfume = p => p && !p.isAccesorio && p.tipo !== 'accesorio' && p.tipo !== 'paquete';

/** Solo entra al hero lo que se ve bien y se puede comprar. */
const mostrable = p => esPerfume(p) && p.imagen && p.estadoStock !== 'agotado';

/**
 * Cifras en vivo que se muestran bajo el título del hero.
 *
 * @param {Array<object>} items  Catálogo cargado (perfumes, paquetes, accesorios).
 * @returns {{perfumes:number, marcas:number, desde:number}}
 */
export function heroStats(items) {
  const perfumes = (Array.isArray(items) ? items : []).filter(esPerfume);
  const marcas = new Set(perfumes.map(p => p.marca).filter(Boolean));
  const precios = perfumes
    .flatMap(p => Object.values(p.precios || {}))
    .map(Number)
    .filter(v => v > 0);

  return {
    perfumes: perfumes.length,
    marcas: marcas.size,
    desde: precios.length ? Math.min(...precios) : 0
  };
}

/**
 * Elige los productos que se muestran en el collage del hero.
 *
 * Solo entran productos con imagen y disponibles: un hueco o un "agotado"
 * en el encabezado es lo primero que vería quien llega al sitio.
 *
 * @param {Array<object>} items  Catálogo cargado.
 * @param {number} n  Cuántos mostrar.
 * @returns {Array<object>}
 */
export function pickShowcase(items, n = 3) {
  return (Array.isArray(items) ? items : []).filter(mostrable).slice(0, n);
}

const num = v => Number(v) || 0;

/**
 * Colecciones que puede mostrar el carrusel del hero.
 *
 * `elegir` devuelve los candidatos ya ordenados por su criterio. `cantera`
 * dice de cuántos de esos primeros se sortea: sin ese sorteo salían siempre
 * los mismos perfumes y el escaparate parecía congelado.
 */
const DEFINICIONES = [
  {
    id: 'vendidos',
    label: 'Los más vendidos',
    // El catálogo público no puede leer `ventas` (requiere sesión), así que
    // la popularidad se mide con las visitas a la ficha, que sí se registran.
    elegir: ps => [...ps].sort((a, b) => num(b.clicks) - num(a.clicks)),
    // Se sortea entre los diez más vistos: siguen siendo los más vendidos,
    // pero no siempre aparece el mismo trío.
    cantera: 10
  },
  {
    id: 'novedades',
    label: 'Recién llegados',
    elegir: ps => ps.filter(p => p.novedad === true)
                    .sort((a, b) => num(b.novedadActivadaEn) - num(a.novedadActivadaEn)),
    cantera: 10
  },
  {
    id: 'caballero',
    label: 'Para él',
    // Sin orden con significado: se sortea entre todos los de caballero.
    elegir: ps => ps.filter(p => (p.genero || '').toLowerCase() === 'caballero'),
    cantera: Infinity
  },
  {
    id: 'dama',
    label: 'Para ella',
    elegir: ps => ps.filter(p => (p.genero || '').toLowerCase() === 'dama'),
    cantera: Infinity
  },
  {
    id: 'clasicos',
    label: 'Los clásicos',
    // Los de siempre: los más antiguos del catálogo, sin contar lo recién
    // llegado, que ya tiene su propia colección.
    elegir: ps => ps.filter(p => p.novedad !== true)
                    .sort((a, b) => num(a.creadoEn) - num(b.creadoEn)),
    cantera: 12
  }
];

/**
 * Arma las colecciones con contenido suficiente para mostrarse.
 *
 * Dentro de cada colección los perfumes se sortean, no se toman siempre los
 * primeros: así el escaparate cambia de elenco entre visitas y no sólo de
 * orden. Una colección con menos de `porColeccion` perfumes se descarta,
 * porque con huecos se ve rota.
 *
 * @param {Array<object>} items  Catálogo cargado.
 * @param {number} porColeccion  Cuántos perfumes muestra cada colección.
 * @param {function():number} rnd  Generador aleatorio, inyectable en pruebas.
 * @returns {Array<{id:string, label:string, items:Array<object>}>}
 */
export function construirColecciones(items, porColeccion = 3, rnd = Math.random) {
  const base = (Array.isArray(items) ? items : []).filter(mostrable);

  return DEFINICIONES
    .map(def => {
      const candidatos = def.elegir(base).slice(0, def.cantera);
      return { id: def.id, label: def.label, items: barajar(candidatos, rnd).slice(0, porColeccion) };
    })
    .filter(col => col.items.length >= porColeccion);
}

/**
 * Baraja una copia del array (Fisher-Yates).
 *
 * El generador es inyectable para poder fijarlo en las pruebas.
 *
 * @param {Array} arr
 * @param {function():number} rnd  Devuelve un número en [0,1).
 * @returns {Array} Copia barajada; el original no se toca.
 */
export function barajar(arr, rnd = Math.random) {
  const out = [...(arr || [])];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
