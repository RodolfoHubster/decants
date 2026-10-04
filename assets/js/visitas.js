/**
 * visitas.js — Contador propio de visitas a la tienda. Sin DOM ni Firestore.
 *
 * Cuenta personas distintas por día: cada navegador suma 1 la primera vez que
 * entra en el día. No cuenta al dueño (el panel marca su navegador con
 * CLAVE_DUENO al iniciar sesión) ni a los robots que arman la vista previa de
 * un link en WhatsApp o Facebook.
 *
 * En Firestore queda un documento por día: visitas/2026-10-03 → { personas: 12 }.
 */

export const CLAVE_DUENO = 'fs_dueno';
export const CLAVE_ULTIMO_DIA = 'fs_visita_dia';

const ROBOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse/i;

/** Día local en formato YYYY-MM-DD (el id del documento). */
export function diaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ¿Esta visita suma? */
export function debeContar({ esDueno, ultimoDia, hoy, userAgent = '' }) {
  if (esDueno) return false;
  if (ROBOT.test(userAgent || '')) return false;
  return ultimoDia !== hoy;
}

/**
 * Personas que entraron desde `desdeMs` (0 = todo) y el promedio por día.
 * @param {Object<string,{personas:number}>} visitasPorDia  id del día → datos.
 */
export function sumarVisitas(visitasPorDia, desdeMs = 0, ahora = Date.now()) {
  const desde = desdeMs > 0 ? diaLocal(new Date(desdeMs)) : '';
  const hoy = diaLocal(new Date(ahora));
  const dias = Object.keys(visitasPorDia || {}).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= desde && d <= hoy).sort();
  const personas = dias.reduce((s, d) => s + (Number(visitasPorDia[d] && visitasPorDia[d].personas) || 0), 0);
  // Días transcurridos desde el primer día con datos del periodo: los días de
  // antes de que existiera el contador no bajan el promedio.
  const inicio = dias[0] || hoy;
  const [a, m, d] = inicio.split('-').map(Number);
  const [ha, hm, hd] = hoy.split('-').map(Number);
  const totalDias = Math.max(1, Math.round((Date.UTC(ha, hm - 1, hd) - Date.UTC(a, m - 1, d)) / 86400000) + 1);
  return { personas, dias: totalDias, porDia: personas / totalDias };
}
