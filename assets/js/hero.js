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
 * Cada una define cómo se eligen sus perfumes. El orden de `items` importa:
 * el primero es el que se muestra grande y con el nombre encima.
 */
const DEFINICIONES = [
  {
    id: 'vendidos',
    label: 'Los más vendidos',
    // El catálogo público no puede leer `ventas` (requiere sesión), así que
    // la popularidad se mide con las visitas a la ficha, que sí se registran.
    elegir: ps => [...ps].sort((a, b) => num(b.clicks) - num(a.clicks))
  },
  {
    id: 'novedades',
    label: 'Recién llegados',
    elegir: ps => ps.filter(p => p.novedad === true)
                    .sort((a, b) => num(b.novedadActivadaEn) - num(a.novedadActivadaEn))
  },
  {
    id: 'caballero',
    label: 'Para él',
    elegir: ps => ps.filter(p => (p.genero || '').toLowerCase() === 'caballero')
  },
  {
    id: 'dama',
    label: 'Para ella',
    elegir: ps => ps.filter(p => (p.genero || '').toLowerCase() === 'dama')
  },
  {
    id: 'clasicos',
    label: 'Los clásicos',
    // Los de siempre: los más antiguos del catálogo, sin contar lo recién
    // llegado, que ya tiene su propia colección.
    elegir: ps => ps.filter(p => p.novedad !== true)
                    .sort((a, b) => num(a.creadoEn) - num(b.creadoEn))
  }
];

/**
 * Arma las colecciones con contenido suficiente para mostrarse.
 *
 * Una colección con menos de `porColeccion` perfumes se descarta: el collage
 * necesita tres imágenes y con huecos se ve roto.
 *
 * @param {Array<object>} items  Catálogo cargado.
 * @param {number} porColeccion  Cuántos perfumes muestra cada colección.
 * @returns {Array<{id:string, label:string, items:Array<object>}>}
 */
export function construirColecciones(items, porColeccion = 3) {
  const base = (Array.isArray(items) ? items : []).filter(mostrable);

  return DEFINICIONES
    .map(def => ({ id: def.id, label: def.label, items: def.elegir(base).slice(0, porColeccion) }))
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
