/**
 * temporada.js — ¿Hay una temporada especial vigente en la tienda? Sin DOM.
 *
 * Se administra desde Ajustes → Temporada, que guarda en config/tienda:
 *   temporada: { id: 'halloween', activa: true, inicio: '2026-10-16', fin: '2026-11-03' }
 *
 * Vigente = interruptor encendido y hoy (hora de Tijuana) entre inicio y fin,
 * con `fin` EXCLUSIVO: el 3 de noviembre la tienda ya vuelve a verse normal,
 * sin que nadie tenga que apagar nada.
 */

export const ZONA_TIENDA = 'America/Tijuana';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Día de hoy en Tijuana como 'AAAA-MM-DD' (en-CA da justo ese formato). */
export function hoyEnTijuana(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_TIENDA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

/**
 * @param {{temporada?:{id:string, activa:boolean, inicio:string, fin:string}}} config  config/tienda
 * @param {string|Date} [hoy]  'AAAA-MM-DD' o una fecha; por defecto, ahora en Tijuana.
 * @returns {{id:string, activa:true, inicio:string, fin:string}|null}
 */
export function temporadaVigente(config, hoy = new Date()) {
  const t = config && config.temporada;
  if (!t || t.activa !== true || !t.id) return null;
  if (!FECHA.test(t.inicio || '') || !FECHA.test(t.fin || '') || t.inicio >= t.fin) return null;
  const dia = typeof hoy === 'string' ? hoy : hoyEnTijuana(hoy);
  if (!FECHA.test(dia)) return null;
  // Las fechas AAAA-MM-DD se comparan bien como texto.
  return dia >= t.inicio && dia < t.fin ? { ...t } : null;
}

/**
 * Para probar en Live Server: `?temporada=halloween` la enciende, pero solo
 * en localhost / 127.0.0.1, nunca en el sitio real.
 */
export function temporadaSimulada(url) {
  try {
    const u = new URL(url);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return null;
    const id = u.searchParams.get('temporada');
    return id ? { id, activa: true, inicio: '0000-01-01', fin: '9999-12-31', simulada: true } : null;
  } catch (e) {
    return null;
  }
}

/** Los paquetes de esa temporada, en el orden en que llegan. */
export function paquetesDeTemporada(items, idTemporada) {
  if (!idTemporada) return [];
  return (items || []).filter(p => p && p.tipo === 'paquete' && p.temporada === idTemporada);
}

/** Cuántos perfumes se eligen en un paquete personalizable: en Truco, uno menos (sorpresa). */
export function seleccionRequerida(paquete, modo) {
  const max = Number(paquete && paquete.maxSeleccion) || 3;
  return modo === 'truco' && max >= 2 ? max - 1 : max;
}

/** ¿Ese paquete ofrece Truco o Trato? Solo personalizables de temporada con 2 o más a elegir. */
export function ofreceTrucoOTrato(paquete, idTemporada) {
  return !!(paquete && idTemporada && paquete.tipo === 'paquete' && paquete.esPersonalizable
    && paquete.temporada === idTemporada && (Number(paquete.maxSeleccion) || 3) >= 2);
}

/** Los 3 diseños del modal en temporada. */
export const VARIANTES_MODAL = ['calabaza', 'telarana', 'muertos'];

/**
 * Diseño del modal para un producto: sale de su id, así cada perfume siempre
 * se abre con el mismo (no cambia cada vez que lo abres) y el catálogo queda
 * repartido entre los tres.
 */
export function varianteModal(id) {
  const txt = String(id || '');
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
  return VARIANTES_MODAL[h % VARIANTES_MODAL.length];
}

/**
 * Qué tanto bajó la arañita del scroll: 0 arriba, 1 al final de la página.
 */
export function progresoScroll(scrollY, altoPagina, altoVentana) {
  const recorrido = (Number(altoPagina) || 0) - (Number(altoVentana) || 0);
  if (!(recorrido > 0)) return 0;
  return Math.min(1, Math.max(0, (Number(scrollY) || 0) / recorrido));
}
