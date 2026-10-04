/**
 * recordatorios.js — Recordatorios del negocio que se mandan a Google Calendar.
 * Sin DOM ni Firestore.
 *
 * FitoScents no tiene servidor que mande notificaciones con la página cerrada.
 * Google Calendar sí: el recordatorio se crea aquí, un botón lo abre en
 * Calendar ya con su repetición, y Google avisa en el celular (y Gemini lo ve).
 */

export const ZONA = 'America/Tijuana';

export const FRECUENCIAS = {
  una: 'Una vez',
  diario: 'Cada día',
  semanal: 'Cada semana',
  quincenal: 'Cada 2 semanas',
  mensual: 'Cada mes',
};

const REGLA = {
  diario: 'RRULE:FREQ=DAILY',
  semanal: 'RRULE:FREQ=WEEKLY',
  quincenal: 'RRULE:FREQ=WEEKLY;INTERVAL=2',
  mensual: 'RRULE:FREQ=MONTHLY',
};

export const PLANTILLAS = [
  { titulo: 'Revisar stock y renovar botellas', frecuencia: 'semanal',
    detalle: 'Abre FitoScents → Hoy y revisa lo que está por acabarse.' },
  { titulo: 'Registrar las ventas de sobre ruedas', frecuencia: 'semanal',
    detalle: 'FitoScents → Ventas → Registrar ventas.' },
  { titulo: 'Pasar a los puntos externos (cobrar y reponer)', frecuencia: 'quincenal',
    detalle: 'FitoScents → Puntos externos: marca lo vendido y la comisión.' },
];

/** Regla de repetición de Google Calendar ('' si es una sola vez). */
export function reglaRecurrencia(frecuencia) {
  return REGLA[frecuencia] || '';
}

const dosDig = n => String(n).padStart(2, '0');
/** Fecha local en el formato de Calendar: 20261004T090000. */
export function formatoCalendar(d) {
  return `${d.getFullYear()}${dosDig(d.getMonth() + 1)}${dosDig(d.getDate())}T${dosDig(d.getHours())}${dosDig(d.getMinutes())}00`;
}

/** Link que abre Google Calendar con el evento listo para guardar. */
export function urlGoogleCalendar({ titulo, detalle = '', inicio, minutos = 15, frecuencia = 'una' }) {
  const ini = new Date(inicio);
  const fin = new Date(ini.getTime() + minutos * 60000);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo || 'Recordatorio FitoScents',
    details: detalle || '',
    dates: `${formatoCalendar(ini)}/${formatoCalendar(fin)}`,
    ctz: ZONA,
  });
  const regla = reglaRecurrencia(frecuencia);
  if (regla) p.set('recur', regla);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/**
 * Siguiente vez que toca (ms), desde `ahora`. null si era de una sola vez y ya pasó.
 */
export function proximaVez({ inicio, frecuencia }, ahora = Date.now()) {
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() >= ahora) return d.getTime();
  if (!REGLA[frecuencia]) return null;
  // Se avanza por pasos de calendario (no por ms) para respetar meses y horario de verano.
  let guard = 0;
  while (d.getTime() < ahora && guard++ < 5000) {
    if (frecuencia === 'diario') d.setDate(d.getDate() + 1);
    else if (frecuencia === 'semanal') d.setDate(d.getDate() + 7);
    else if (frecuencia === 'quincenal') d.setDate(d.getDate() + 14);
    else if (frecuencia === 'mensual') d.setMonth(d.getMonth() + 1);
  }
  return d.getTime();
}

/** Ordena por lo que toca primero; los de una vez ya pasados al final. */
export function ordenarRecordatorios(lista, ahora = Date.now()) {
  return [...(lista || [])]
    .map(r => ({ ...r, proxima: proximaVez(r, ahora) }))
    .sort((a, b) => (a.proxima ?? Infinity) - (b.proxima ?? Infinity));
}
