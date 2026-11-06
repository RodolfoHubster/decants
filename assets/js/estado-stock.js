/**
 * estado-stock.js — Cuándo un perfume está agotado o por acabarse, según lo que
 * queda en sus botellas. Sin DOM.
 *
 * Mira la botella en uso (`loteActivo`) y las compradas después; las anteriores
 * se dan por terminadas. Antes se sumaban TODAS las botellas: con una vieja a la
 * que le faltaban ventas por registrar, el perfume nunca llegaba al 100% y
 * poner "quedan 0 ml" en Estadísticas no lo marcaba agotado (o hasta lo
 * desmarcaba). Y vender un "Resto" lo marcaba agotado aunque hubiera otra
 * botella nueva esperando.
 *
 * Los ml salen de `consumoPorBotella` (rentabilidad.js), la misma cuenta que
 * muestra la tabla de botellas: ventas, paquetes, puntos externos y ajustes.
 */
import { consumoPorBotella, consumoDePerfume } from './rentabilidad.js';

/** Por debajo de esta fracción de lo que queda, "por acabarse" (el 85% usado de antes). */
export const UMBRAL_POR_ACABARSE = 0.15;

const NIVEL = { normal: 0, por_acabarse: 1, agotado: 2 };

/**
 * Lo que queda en la botella en uso y las que siguen.
 * @returns {{estado:'normal'|'por_acabarse'|'agotado', restante:number, capacidad:number}}
 */
export function estadoStockAuto(p, ventas = [], consignados = []) {
  const { botellas, sinLote } = consumoPorBotella(p, ventas, consignados);
  let restante, capacidad;
  if (botellas.length) {
    const i = botellas.findIndex(b => b.id === p.loteActivo);
    const vigentes = botellas.slice(i === -1 ? botellas.length - 1 : i);
    restante = vigentes.reduce((s, b) => s + b.restante, 0);
    capacidad = vigentes.reduce((s, b) => s + b.tamano, 0);
  } else {
    // Perfumes de antes de los lotes: una sola botella suelta.
    const c = consumoDePerfume(p, ventas, consignados);
    capacidad = c.capacidad;
    restante = sinLote.resto ? 0 : Math.max(0, c.capacidad - c.usado);
  }
  if (!(capacidad > 0)) return { estado: 'normal', restante: 0, capacidad: 0 };
  const estado = restante <= 0 ? 'agotado'
    : restante <= capacidad * UMBRAL_POR_ACABARSE ? 'por_acabarse' : 'normal';
  return { estado, restante, capacidad };
}

/**
 * El estado a guardar.
 * @param {string} actual    El que tiene el perfume.
 * @param {string} calculado El de estadoStockAuto.
 * @param {{soloSubir?:boolean}} [opciones]  Al registrar ventas solo se sube
 *   (normal → por acabarse → agotado): si faltan ventas por registrar no debe
 *   quitarte un agotado que pusiste a mano. Al medir la botella (Estadísticas),
 *   lo medido manda en los dos sentidos.
 * @returns {string|null} El nuevo estado, o null si no cambia.
 */
export function siguienteEstado(actual, calculado, { soloSubir = false } = {}) {
  const a = NIVEL[actual] !== undefined ? actual : 'normal';
  if (NIVEL[calculado] === undefined || calculado === a) return null;
  if (soloSubir && NIVEL[calculado] < NIVEL[a]) return null;
  return calculado;
}
