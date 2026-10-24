/**
 * estadisticas-ventas.js — Qué se mueve: piezas vendidas por perfume, género,
 * talla y día. Sin DOM.
 *
 * Todo parte de "piezas": cada decant vendido es una pieza (un combo de 3 son
 * 3 piezas, cada una de su perfume y género) y cada botella completa también.
 * Las botellas completas salen de dos lados: ventas con talla "Completo" y
 * encargos entregados (ordenes_completos), que no crean venta.
 */
import { tipoDeVenta, mlDeTalla } from './rentabilidad.js';
import { aMs } from './alertas.js';

export const GENEROS = ['Caballero', 'Dama', 'Unisex'];
export const SIN_GENERO = 'Sin género';
export const TALLAS_DECANT = [2, 3, 5, 10];

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "Caballero" | "Dama" | "Unisex" | "Sin género", aceptando hombre/mujer/etc. */
export function generoNormal(g) {
  const t = norm(g);
  if (/^(caballero|hombre|masculino|male|men)/.test(t)) return 'Caballero';
  if (/^(dama|mujer|femenino|female|women)/.test(t)) return 'Dama';
  if (/^unisex/.test(t)) return 'Unisex';
  return SIN_GENERO;
}

/**
 * Aplana ventas y encargos en piezas.
 * @param {Array} ventas  Sin canceladas.
 * @param {{perfumes?:Array, completos?:Array, encargos?:Array, ctx?:object}} datos
 *   perfumes: los decants (para el género); completos: perfumes_completos;
 *   encargos: ordenes_completos; ctx: contextoRentabilidad (reconoce accesorios).
 * @returns {Array<{clave,nombre,marca,genero,tipo:'decant'|'completo',ml,piezas,importe,t}>}
 */
export function piezasVendidas(ventas, { perfumes = [], completos = [], encargos = [], ctx = null } = {}) {
  const porId = new Map((perfumes || []).map(p => [p.id, p]));
  const porNombre = new Map();
  [...(completos || []), ...(perfumes || [])].forEach(p => {
    const k = norm(p && p.nombre);
    if (k && !porNombre.has(k)) porNombre.set(k, p);
  });
  const out = [];
  const add = (p, nombre, marca, extra) => {
    const n = (nombre || (p && p.nombre) || 'Sin nombre').trim();
    out.push({
      clave: `${extra.tipo}:${(p && p.id) || norm(n + ' ' + (marca || ''))}`,
      nombre: n,
      marca: marca || (p && p.marca) || '',
      genero: generoNormal(p && p.genero),
      ...extra,
    });
  };

  (ventas || []).forEach(v => {
    if (!v || v.estado === 'cancelada') return;
    const tipo = tipoDeVenta(v, ctx);
    const cant = Number(v.cantidad) || 1;
    const t = aMs(v.creadoEn);
    const importe = (Number(v.precio) || 0) * cant;
    if (tipo === 'decant') {
      const p = porId.get(v.perfumeId);
      add(p, v.perfumeNombre, v.perfumeMarca, { tipo: 'decant', ml: mlDeTalla(v.talla) * cant, piezas: cant, importe, t });
    } else if (tipo === 'paquete') {
      const items = v.paqueteItems.filter(Boolean);
      const ml = mlDeTalla(v.talla);
      items.forEach(it => {
        const p = porId.get(it.id);
        add(p, it.nombre, it.marca, { tipo: 'decant', ml: ml * cant, piezas: cant, importe: importe / items.length, t });
      });
    } else if (tipo === 'completo') {
      const p = porId.get(v.perfumeId) || porNombre.get(norm(v.perfumeNombre));
      add(p, v.perfumeNombre, v.perfumeMarca, { tipo: 'completo', ml: 0, piezas: cant, importe, t });
    }
  });

  (encargos || []).forEach(e => {
    if (!e || e.estado !== 'entregado') return;
    const p = porNombre.get(norm(e.perfume));
    add(p, e.perfume, e.marca, {
      tipo: 'completo', ml: 0, piezas: 1, importe: Number(e.precio) || 0,
      t: aMs(e.actualizadoEn) || aMs(e.creadoEn),
    });
  });
  return out;
}

/** Piezas dentro de [desde, hasta) y, si se piden, de un tipo y un género. */
export function filtrarPiezas(piezas, { desde = 0, hasta = Infinity, tipo = '', genero = '' } = {}) {
  return (piezas || []).filter(x => x.t >= desde && x.t < hasta
    && (!tipo || x.tipo === tipo) && (!genero || x.genero === genero));
}

/** Totales por género (y el total general). */
export function resumenPorGenero(piezas) {
  const vacio = () => ({ piezas: 0, ml: 0, importe: 0, perfumes: 0 });
  const res = { total: vacio() };
  const distintos = { total: new Set() };
  [...GENEROS, SIN_GENERO].forEach(g => { res[g] = vacio(); distintos[g] = new Set(); });
  (piezas || []).forEach(x => {
    [x.genero, 'total'].forEach(g => {
      res[g].piezas += x.piezas;
      res[g].ml += x.ml;
      res[g].importe += x.importe;
      distintos[g].add(x.clave);
    });
  });
  Object.keys(res).forEach(g => { res[g].perfumes = distintos[g].size; });
  return res;
}

/** Ranking completo de perfumes: más piezas primero; empate, más dinero. */
export function rankingPerfumes(piezas) {
  const por = new Map();
  (piezas || []).forEach(x => {
    const g = por.get(x.clave) || { clave: x.clave, nombre: x.nombre, marca: x.marca, genero: x.genero, tipo: x.tipo, piezas: 0, ml: 0, importe: 0, ultima: 0 };
    g.piezas += x.piezas;
    g.ml += x.ml;
    g.importe += x.importe;
    if (x.t > g.ultima) g.ultima = x.t;
    por.set(x.clave, g);
  });
  return [...por.values()].sort((a, b) => b.piezas - a.piezas || b.importe - a.importe || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Decants por talla en cada género: { Caballero: {2:n, 3:n, 5:n, 10:n, otras:n}, ... }. */
export function tallasPorGenero(piezas) {
  const res = {};
  [...GENEROS, SIN_GENERO].forEach(g => { res[g] = { 2: 0, 3: 0, 5: 0, 10: 0, otras: 0 }; });
  (piezas || []).filter(x => x.tipo === 'decant' && x.piezas > 0).forEach(x => {
    const ml = Math.round(x.ml / x.piezas);
    res[x.genero][TALLAS_DECANT.includes(ml) ? ml : 'otras'] += x.piezas;
  });
  return res;
}

/** Piezas y dinero por día de la semana, empezando en lunes. */
export function porDiaSemana(piezas) {
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => ({ dia: d, piezas: 0, importe: 0 }));
  (piezas || []).forEach(x => {
    if (!x.t) return;
    const i = (new Date(x.t).getDay() + 6) % 7;
    dias[i].piezas += x.piezas;
    dias[i].importe += x.importe;
  });
  return dias;
}

/** Periodo anterior del mismo largo: [desde - largo, desde). Sin periodo (todo) → null. */
export function periodoAnterior(desde, ahora) {
  if (!desde || desde >= ahora) return null;
  return { desde: desde - (ahora - desde), hasta: desde };
}

/** Cambio en % contra el periodo anterior; null si antes no hubo nada. */
export function cambioPct(actual, antes) {
  if (!antes) return null;
  return Math.round(((actual - antes) / antes) * 100);
}
