/**
 * rentabilidad.js — Cuánto costó de verdad cada venta y cuánto se ganó. Sin DOM.
 *
 * El costo sale de la botella (lote) de donde se sirvió: si un perfume se
 * compró una vez a $350 y otra a $400, cada venta usa el costo de SU botella.
 *
 *   decant     → ml × (costo de la botella ÷ ml de la botella) + insumos
 *                (botella, etiqueta, bolsa) + extra si es reforzada
 *   paquete    → lo mismo por cada perfume del combo; una sola bolsa
 *   resto      → los ml que quedaban en esa botella, sin insumos
 *   completo   → lo que costó la botella (costoCompleto de la venta, o la
 *                botella registrada del perfume)
 *   accesorio  → el costo del accesorio; NO cuenta como decant ni como ml
 *
 * La comisión de un punto externo se guarda en cada venta y se resta aparte.
 *
 * Módulo puro: lo importan estadisticas.js y los tests.
 */
import { resolveLoteId, esResto } from './lotes.js';

/** ml de una talla: "5", "10ml", "Paquete 5" → número; lo demás → 0. */
export function mlDeTalla(talla) {
  const n = parseFloat(String(talla || '').replace(/^\s*paquete\s*/i, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Lo que cuesta armar un decant (frasco + etiqueta + bolsa). */
export function insumoUnitario(costosOp) {
  const c = costosOp || {};
  return (+c.botella || 0) + (+c.etiqueta || 0) + (+c.bolsa || 0);
}

/** Lotes del perfume; los perfumes de antes de los lotes traen la botella suelta. */
export function lotesDe(p) {
  if (!p) return [];
  if (Array.isArray(p.lotes) && p.lotes.length) return p.lotes;
  if (p.costoBotella && p.tamanoBotella) {
    return [{ id: 'lote-1', fecha: p.creadoEn || 0, costo: +p.costoBotella, tamano: +p.tamanoBotella }];
  }
  return [];
}

const tamanoDe = l => parseFloat(l && l.tamano) || 100;

/** La botella de donde salió una venta (o null si el perfume no tiene costos). */
export function loteDeVenta(p, loteId) {
  const lotes = lotesDe(p);
  const id = resolveLoteId(lotes, loteId);
  return id ? lotes.find(l => l.id === id) : null;
}

/**
 * Prepara lo que se consulta muchas veces: perfumes y accesorios por id, y los
 * ml vendidos de cada botella (para saber cuánto llevaba un "Resto").
 */
export function contextoRentabilidad({ perfumes = [], accesorios = [], costosOp = {}, ventas = [] } = {}) {
  const perfumesPorId = new Map(perfumes.map(p => [p.id, p]));
  const accesoriosPorId = new Map(accesorios.map(a => [a.id, a]));
  const ctx = { perfumesPorId, accesoriosPorId, costosOp: costosOp || {}, mlPorLote: new Map() };
  const sumar = (pid, loteId, ml) => {
    const p = perfumesPorId.get(pid);
    const lote = loteDeVenta(p, loteId);
    if (!lote) return;
    const k = `${pid}|${lote.id}`;
    ctx.mlPorLote.set(k, (ctx.mlPorLote.get(k) || 0) + ml);
  };
  ventas.forEach(v => {
    if (!v || v.estado === 'cancelada') return;
    const tipo = tipoDeVenta(v, ctx);
    const cant = +v.cantidad || 1;
    if (tipo === 'decant') sumar(v.perfumeId, v.loteId, mlDeTalla(v.talla) * cant);
    if (tipo === 'paquete') {
      const ml = mlDeTalla(v.talla);
      v.paqueteItems.forEach(it => sumar(it && it.id, it && it.loteId, ml * cant));
    }
  });
  return ctx;
}

/** Qué se vendió: decant, paquete, resto, completo, accesorio u otro. */
export function tipoDeVenta(v, ctx) {
  const talla = String((v && v.talla) || '').trim().toLowerCase();
  const esAcc = (ctx && ctx.accesoriosPorId && ctx.accesoriosPorId.has(v.perfumeId))
    || v.perfumeMarca === 'Accesorio' || /^\d+\s*ud\b/.test(talla);
  if (esAcc) return 'accesorio';
  if (Array.isArray(v.paqueteItems) && v.paqueteItems.length) return 'paquete';
  if (talla === 'completo') return 'completo';
  if (esResto(talla)) return 'resto';
  if (mlDeTalla(talla) > 0) return 'decant';
  return 'otro';
}

const costoMl = (p, loteId) => {
  const l = loteDeVenta(p, loteId);
  return l ? (+l.costo || 0) / tamanoDe(l) : 0;
};

/**
 * Costo de una venta (por todas sus piezas).
 * @returns {{tipo:string, costo:number, comision:number, ml:number, piezas:number, sinCosto:boolean}}
 *   `piezas` = decants servidos (un combo de 3 son 3); `sinCosto` avisa cuando
 *   no hay de dónde sacar el costo y la ganancia de esa venta sale inflada.
 */
export function costoDeVenta(v, ctx) {
  const cant = +v.cantidad || 1;
  const op = ctx.costosOp || {};
  const tipo = tipoDeVenta(v, ctx);
  const comision = (+v.comision || 0) * cant;
  const r = { tipo, costo: 0, comision, ml: 0, piezas: 0, sinCosto: false };
  const p = ctx.perfumesPorId.get(v.perfumeId);

  if (tipo === 'accesorio') {
    const a = ctx.accesoriosPorId.get(v.perfumeId);
    r.costo = (a ? +a.costo || 0 : 0) * cant;
    r.sinCosto = !a || !(+a.costo > 0);
  } else if (tipo === 'completo') {
    if (v.costoCompleto != null && v.costoCompleto !== '' && Number.isFinite(+v.costoCompleto)) {
      r.costo = +v.costoCompleto * cant;
    } else {
      const l = loteDeVenta(p, v.loteId);
      r.costo = (l ? +l.costo || 0 : 0) * cant;
      r.sinCosto = !l || !(+l.costo > 0);
    }
  } else if (tipo === 'resto') {
    const l = loteDeVenta(p, v.loteId);
    if (l) {
      const vendidos = ctx.mlPorLote.get(`${v.perfumeId}|${l.id}`) || 0;
      const quedaban = Math.max(0, tamanoDe(l) - vendidos);
      r.costo = (+l.costo || 0) / tamanoDe(l) * quedaban * cant;
      r.ml = quedaban * cant;
    } else r.sinCosto = true;
    r.piezas = cant;
  } else if (tipo === 'decant') {
    const ml = mlDeTalla(v.talla);
    const extra = v.reforzada ? (+op.reforzadaCosto || 0) : 0;
    r.costo = (ml * costoMl(p, v.loteId) + insumoUnitario(op) + extra) * cant;
    r.ml = ml * cant;
    r.piezas = cant;
    r.sinCosto = !loteDeVenta(p, v.loteId);
  } else if (tipo === 'paquete') {
    const ml = mlDeTalla(v.talla);
    const items = v.paqueteItems;
    const insumos = (+op.bolsa || 0) + ((+op.botella || 0) + (+op.etiqueta || 0)) * items.length;
    const liquido = items.reduce((s, it) => s + ml * costoMl(ctx.perfumesPorId.get(it && it.id), it && it.loteId), 0);
    r.costo = (insumos + liquido) * cant;
    r.ml = ml * items.length * cant;
    r.piezas = items.length * cant;
    r.sinCosto = items.some(it => !loteDeVenta(ctx.perfumesPorId.get(it && it.id), it && it.loteId));
  } else {
    r.sinCosto = true;
  }
  return r;
}

const grupoVacio = () => ({ ingresos: 0, costo: 0, ganancia: 0, unidades: 0 });

/**
 * Totales de un periodo. La ganancia ya descuenta el costo real y las
 * comisiones; los accesorios van en su propio grupo y no suman decants ni ml.
 */
export function resumenGanancia(ventas, ctx) {
  const t = { ingresos: 0, costo: 0, comisiones: 0, ganancia: 0, margen: 0, decants: 0, ml: 0, sinCosto: 0, porTipo: {} };
  (ventas || []).forEach(v => {
    if (!v || v.estado === 'cancelada') return;
    const cant = +v.cantidad || 1;
    const ingreso = (+v.precio || 0) * cant;
    const c = costoDeVenta(v, ctx);
    const g = t.porTipo[c.tipo] || (t.porTipo[c.tipo] = grupoVacio());
    g.ingresos += ingreso;
    g.costo += c.costo + c.comision;
    g.ganancia += ingreso - c.costo - c.comision;
    g.unidades += cant;
    t.ingresos += ingreso;
    t.costo += c.costo;
    t.comisiones += c.comision;
    if (c.tipo !== 'accesorio') { t.decants += c.piezas; t.ml += c.ml; }
    if (c.sinCosto && ingreso > 0) t.sinCosto += 1;
  });
  t.ganancia = t.ingresos - t.costo - t.comisiones;
  t.margen = t.ingresos > 0 ? (t.ganancia / t.ingresos) * 100 : 0;
  return t;
}

const sinAcentos = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const diaDe = ms => {
  const d = new Date(Number(ms) || 0);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/**
 * Cuántos clientes se atendieron: un ticket es un cliente.
 *
 * Las ventas nuevas traen `ticketId` (un id por cliente del registro). Las
 * viejas se agrupan por día + cliente: "Cliente 3" el mismo día es una sola
 * persona con varios perfumes; en otro día es otra. Las ventas de un punto
 * externo y las que no tienen cliente cuentan una por una.
 */
export function clientesAtendidos(ventas) {
  const tickets = new Set();
  (ventas || []).forEach((v, i) => {
    if (!v || v.estado === 'cancelada') return;
    if (v.ticketId) { tickets.add('t:' + v.ticketId); return; }
    const cli = sinAcentos(v.cliente);
    if (!cli || v.canal === 'consignacion') { tickets.add('v:' + (v.id || i)); return; }
    tickets.add(`d:${diaDe(v.creadoEn)}|${cli}`);
  });
  return tickets.size;
}

/**
 * Rentabilidad de cada botella de un perfume y el total del perfume.
 *
 * El renglón del perfume suma TODAS sus botellas (antes mostraba solo la
 * activa y no cuadraba con las botellas de abajo). `enUso` es la botella que TÚ
 * marcaste como activa (loteActivo), a la que se apuntan las ventas nuevas.
 * Las botellas anteriores que no llegaron al 100% salen con `sinCerrar`: casi
 * siempre ya se acabaron y solo falta ajustarlas (ventas no capturadas,
 * probadores o merma).
 *
 * @param {object} p  Perfume con `lotes`.
 * @param {Array} hist  Ventas del perfume (los combos ya repartidos por perfume,
 *   con `talla` en ml y `precio` proporcional).
 * @param {object} costosOp
 * @param {Array} [consignados]  [{perfumeId, talla, cantidad, loteId?}] que
 *   siguen en puntos externos (en exhibición o probadores). Ya salieron de la
 *   botella aunque no se hayan vendido: cuentan en `usado` como `mlFuera`.
 *   Antes la tabla solo sumaba ventas y no veía lo dejado en la barbería.
 */
export function rentabilidadPorBotella(p, hist, costosOp, consignados = []) {
  const lotes = lotesDe(p);
  // ml en puntos externos por botella: la de la pieza o la asignada.
  const fuera = new Map();
  (consignados || []).forEach(c => {
    if (!c || c.perfumeId !== (p && p.id)) return;
    const id = resolveLoteId(lotes, c.loteId || (p && p.loteActivo));
    if (id) fuera.set(id, (fuera.get(id) || 0) + mlDeTalla(c.talla) * (+c.cantidad || 0));
  });
  const insumo = insumoUnitario(costosOp);
  const precios = (p && p.precios) || {};
  const botellas = lotes.map((l, idx) => {
    const ventasLote = (hist || []).filter(v => resolveLoteId(lotes, v.loteId) === l.id);
    let mlVentas = 0, decants = 0, ingreso = 0, comision = 0, extra = 0, restoVendido = false;
    ventasLote.forEach(v => {
      const c = +v.cantidad || 1;
      const t = String(v.talla || '').trim().toLowerCase();
      if (esResto(t)) {
        ingreso += (+v.precio || 0) * c;
        comision += (+v.comision || 0) * c;
        restoVendido = true;
      } else if (t !== 'completo' && t !== 'otro') {
        const ml = mlDeTalla(t);
        if (ml > 0) {
          mlVentas += ml * c;
          decants += c;
          ingreso += (+v.precio || 0) * c;
          comision += (+v.comision || 0) * c;
          if (v.reforzada) extra += (+(costosOp || {}).reforzadaCosto || 0) * c;
        }
      }
    });
    const tamano = tamanoDe(l);
    const ajuste = parseFloat(l.mlAjuste) || 0;
    const mlFuera = fuera.get(l.id) || 0;
    const usado = restoVendido ? tamano : Math.min(tamano, Math.max(0, mlVentas + mlFuera + ajuste));
    const costoBotella = +l.costo || 0;
    const costoReal = costoBotella + decants * insumo + extra + comision;
    const gananciaReal = ingreso - costoReal;

    // Proyección: al ritmo de precio por ml de lo vendido, o con los precios del perfume.
    let proyeccion = gananciaReal;
    if (!restoVendido && usado < tamano) {
      let decantsProy, ingresoProy;
      if (mlVentas > 0) {
        const factor = (tamano - ajuste) / mlVentas;
        decantsProy = decants * factor;
        ingresoProy = ingreso * factor;
      } else {
        const tallas = ['2', '3', '5', '10'].filter(k => +precios[k] > 0);
        const mlProm = tallas.length ? tallas.reduce((s, k) => s + +k, 0) / tallas.length : 5;
        const precioProm = tallas.length ? tallas.reduce((s, k) => s + +precios[k], 0) / tallas.length : 0;
        decantsProy = Math.max(0, tamano - ajuste) / mlProm;
        ingresoProy = decantsProy * precioProm;
      }
      proyeccion = ingresoProy - (costoBotella + decantsProy * insumo + extra + comision);
    }

    return {
      id: l.id, idx, fecha: l.fecha, tamano, costoBotella,
      mlVentas, mlFuera, usado, restoVendido, decants,
      progreso: tamano > 0 ? Math.min(100, Math.round((usado / tamano) * 100)) : 0,
      costoReal, ingreso, gananciaReal, proyeccion,
    };
  });

  // Antes se adivinaba (la más vieja sin terminar) y marcaba una que el dueño no eligió.
  const enUso = botellas.find(b => b.id === (p && p.loteActivo)) || botellas[botellas.length - 1] || null;
  const iActiva = enUso ? botellas.indexOf(enUso) : -1;
  botellas.forEach((b, i) => { b.sinCerrar = i < iActiva && b.progreso < 100; });
  const suma = k => botellas.reduce((s, b) => s + b[k], 0);
  return {
    botellas,
    enUso,
    total: {
      costoReal: suma('costoReal'),
      ingreso: suma('ingreso'),
      gananciaReal: suma('gananciaReal'),
      proyeccion: suma('proyeccion'),
      usado: suma('usado'),
      tamano: suma('tamano'),
    },
  };
}

/**
 * ml que ya salieron de cada botella (vendidos, en un punto externo o
 * ajustados) para las alertas de "por acabarse".
 *
 * Antes se buscaba la botella con `loteId || 'lote-1'` exacto: las ventas de
 * los puntos externos (sin botella) y los ids viejos no caían en ninguna y el
 * perfume nunca llegaba a "por acabarse".
 *
 * @param {object} p  Perfume.
 * @param {Array} ventas  Todas las ventas.
 * @param {Array} consignados  [{perfumeId, talla, cantidad, loteId?}] dejados
 *   en puntos externos y aún sin vender.
 * @returns {{botellas:Array<{id,idx,tamano,usado,restante,cerrada}>, sinLote:object}}
 */
export function consumoPorBotella(p, ventas, consignados = []) {
  const lotes = lotesDe(p);
  const porLote = new Map(lotes.map(l => [l.id, { ml: 0, resto: false }]));
  const sinLote = { ml: 0, resto: false };
  const de = loteId => {
    const id = resolveLoteId(lotes, loteId);
    return (id && porLote.get(id)) || sinLote;
  };
  (ventas || []).forEach(v => {
    if (!v || v.estado === 'cancelada') return;
    const cant = +v.cantidad || 1;
    if (Array.isArray(v.paqueteItems) && v.paqueteItems.length) {
      const ml = mlDeTalla(v.talla);
      v.paqueteItems.forEach(it => { if (it && it.id === p.id) de(it.loteId).ml += ml * cant; });
      return;
    }
    if (v.perfumeId !== p.id) return;
    const t = String(v.talla || '').trim().toLowerCase();
    if (esResto(t)) de(v.loteId).resto = true;
    else if (t !== 'completo' && t !== 'otro') de(v.loteId).ml += mlDeTalla(t) * cant;
  });
  (consignados || []).forEach(c => {
    // Lo dejado en un punto externo sale de la botella activa (no se guarda de cuál).
    if (c && c.perfumeId === p.id) de(c.loteId || p.loteActivo).ml += mlDeTalla(c.talla) * (+c.cantidad || 0);
  });
  const botellas = lotes.map((l, idx) => {
    const d = porLote.get(l.id);
    const tamano = tamanoDe(l);
    const usado = d.resto ? tamano : Math.min(tamano, Math.max(0, d.ml + (parseFloat(l.mlAjuste) || 0)));
    return { id: l.id, idx, tamano, usado, restante: Math.max(0, tamano - usado), cerrada: d.resto };
  });
  return { botellas, sinLote };
}

/** Lo mismo, sumado por perfume. */
export function consumoDePerfume(p, ventas, consignados = []) {
  const { botellas, sinLote } = consumoPorBotella(p, ventas, consignados);
  const capacidad = botellas.length ? botellas.reduce((s, b) => s + b.tamano, 0) : (+p.tamanoBotella || 0);
  const usado = botellas.length ? botellas.reduce((s, b) => s + b.usado, 0) : (sinLote.resto ? capacidad : sinLote.ml);
  return { usado, capacidad, pct: capacidad > 0 ? (usado / capacidad) * 100 : 0 };
}
