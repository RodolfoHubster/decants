/**
 * registro-dia.js — Reglas de "Registrar ventas". Sin DOM.
 *
 * Una sola pantalla para todo: cada cliente es un TICKET con su nombre y su
 * método de pago, y dentro van los perfumes que llevó. Sirve igual para un
 * día de sobre ruedas (muchos tickets "Cliente N") que para dos entregas por
 * WhatsApp (dos tickets con nombre) o una sola venta (un ticket).
 *
 * Antes había tres caminos (Nueva venta, Registro del día "sobre ruedas" y
 * "pedido de un solo cliente") y ninguno cubría "hoy entregué a dos clientes".
 *
 * Modos (según el canal):
 *   'ruedas'   → los tickets se numeran solos (Cliente 1, 2...): gente de paso.
 *   'entregas' → cada ticket necesita el nombre del cliente.
 */

const GENERICO = /^cliente\s*(\d+)$/i;

/** El canal define el modo. */
export function modoDeCanal(canal) {
  return canal === 'mercado' ? 'ruedas' : 'entregas';
}

/** Nombre con el que nace un ticket nuevo. */
export function nombreTicketNuevo(modo, nombresExistentes = []) {
  if (modo !== 'ruedas') return '';
  const max = (nombresExistentes || []).reduce((m, n) => {
    const r = String(n || '').trim().match(GENERICO);
    return r ? Math.max(m, Number(r[1])) : m;
  }, 0);
  return `Cliente ${max + 1}`;
}

/** Solo cuentan las líneas con perfume: un renglón vacío no es una venta. */
export function resumenRenglones(rows) {
  const llenas = (rows || []).filter(r => r && r.perfumeId);
  const tickets = new Set(llenas.map(r => r.tid || '_'));
  return {
    ventas: llenas.length,
    clientes: tickets.size,
    total: llenas.reduce((s, r) => s + (Number(r.precio) || 0) * (Number(r.cantidad) || 1), 0),
  };
}

/** Tickets con perfumes pero sin nombre de cliente, en orden de aparición. */
export function ticketsSinNombre(rows) {
  const vistos = [];
  (rows || []).forEach(r => {
    if (r && r.perfumeId && !String(r.cliente || '').trim() && !vistos.includes(r.tid)) vistos.push(r.tid);
  });
  return vistos;
}

/** Precio capturado: 0 vale (cortesía); vacío o no numérico, no. */
const tienePrecio = r => r.precio !== '' && r.precio != null && !Number.isNaN(Number(r.precio)) && Number(r.precio) >= 0;

/**
 * Botella sellada: no sale de la botella abierta (no lleva lote ni descuenta ml)
 * y su ganancia depende de lo que costó. Sin ese costo, Estadísticas usaba el de
 * la botella abierta del perfume, que no tiene nada que ver.
 */
export const esSellada = talla => talla === 'Completo';

/** Lo que costó la botella sellada: 0 vale (regalo); vacío o no numérico, no. */
export const tieneCosto = costo => costo !== '' && costo != null && Number.isFinite(Number(costo)) && Number(costo) >= 0;

/**
 * Al pasar a botella sellada no hay precio de catálogo, y el que quedaba era el
 * del decant que estaba elegido (salía una botella a $90). Si coincide con un
 * precio del catálogo (o con el de reforzada) se borra; si lo escribió a mano, se deja.
 */
export function precioAlSellar(precio, preciosCatalogo = [], extraReforzada = 0) {
  const n = Number(precio);
  if (precio === '' || precio == null || !Number.isFinite(n)) return precio;
  const deCatalogo = (preciosCatalogo || []).map(Number).filter(x => x > 0)
    .some(x => x === n || x + (Number(extraReforzada) || 0) === n);
  return deCatalogo ? '' : precio;
}

/**
 * Qué falta para guardar.
 * @returns {{mensaje:string, tid?:string, rid?:number}} mensaje vacío si todo bien;
 *   `rid` señala el renglón cuando lo que falta es el costo de una botella sellada.
 */
export function validarRegistro(rows, modo) {
  const lista = (rows || []).filter(Boolean);
  // Antes una línea con perfume pero sin precio se descartaba en silencio y el
  // aviso decía "1 venta guardada" cuando en pantalla había dos.
  const incompletas = lista.filter(r => r.perfumeId && (!r.talla || !tienePrecio(r)));
  if (incompletas.length) {
    return {
      mensaje: incompletas.length === 1 ? 'A un perfume le falta talla o precio' : `A ${incompletas.length} perfumes les falta talla o precio`,
      tid: incompletas[0].tid,
    };
  }
  const validas = lista.filter(r => r.perfumeId && r.talla && tienePrecio(r));
  if (!validas.length) return { mensaje: 'Agrega al menos un perfume con talla y precio' };
  const sinCosto = validas.filter(r => esSellada(r.talla) && !tieneCosto(r.costoCompleto));
  if (sinCosto.length) {
    return {
      mensaje: sinCosto.length === 1 ? 'Pon cuánto te costó la botella sellada' : `A ${sinCosto.length} botellas selladas les falta lo que te costaron`,
      tid: sinCosto[0].tid,
      rid: sinCosto[0].rid,
    };
  }
  if (modo === 'entregas') {
    const sin = ticketsSinNombre(rows);
    if (sin.length) {
      return { mensaje: sin.length === 1 ? 'Ponle nombre al cliente' : `Faltan ${sin.length} nombres de cliente`, tid: sin[0] };
    }
  }
  return { mensaje: '' };
}

/**
 * La misma hora, en otro día. Al editar un día ya guardado, cada venta conservaba
 * su fecha original y cambiar la Fecha de arriba no hacía nada.
 * @param {number} ms        creadoEn de la venta.
 * @param {string} fechaStr  'AAAA-MM-DD', hora local.
 */
export function moverAlDia(ms, fechaStr) {
  const [y, m, d] = String(fechaStr || '').split('-').map(Number);
  if (!ms || !y || !m || !d) return ms;
  const f = new Date(ms);
  f.setFullYear(y, m - 1, d);
  return f.getTime();
}
