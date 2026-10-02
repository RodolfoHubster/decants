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

/**
 * Qué falta para guardar.
 * @returns {{mensaje:string, tid?:string}} mensaje vacío si todo bien.
 */
export function validarRegistro(rows, modo) {
  const validas = (rows || []).filter(r => r && r.perfumeId && r.talla && Number(r.precio) > 0);
  if (!validas.length) return { mensaje: 'Agrega al menos un perfume con talla y precio' };
  if (modo === 'entregas') {
    const sin = ticketsSinNombre(rows);
    if (sin.length) {
      return { mensaje: sin.length === 1 ? 'Ponle nombre al cliente' : `Faltan ${sin.length} nombres de cliente`, tid: sin[0] };
    }
  }
  return { mensaje: '' };
}
