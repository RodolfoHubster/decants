/**
 * pos-cliente.js — Lógica de atribución de ventas por cliente en la canasta POS.
 *
 * El problema que resuelve: en sobre ruedas se atiende un cliente, se arma el decant
 * y se olvida pulsar "Siguiente cliente". La venta del cliente que llega después cae
 * en el ticket del anterior. Aquí vive la decisión de cuándo preguntar.
 */

/** Tiempo sin agregar nada tras el cual vale la pena preguntar si es otro cliente. */
export const INACTIVIDAD_MS = 90 * 1000;

/** Items de la canasta que pertenecen a un cliente. */
export function itemsDeCliente(cart, cid) {
  return (cart || []).filter(i => (i.cartClientId || 1) === Number(cid));
}

/**
 * ¿Conviene preguntar si el perfume que se está agregando es de otro cliente?
 *
 * Solo si el cliente actual YA tiene algo (si está vacío, no hay nada que separar)
 * y pasó el umbral desde el último movimiento suyo. Nunca decide solo: devuelve
 * true para que la UI pregunte, porque partir un ticket por error es tan malo
 * como no partirlo.
 */
export function sugiereNuevoCliente(cart, cid, ahora, umbralMs = INACTIVIDAD_MS) {
  const mios = itemsDeCliente(cart, cid);
  if (!mios.length) return false;
  const ultimo = mios.reduce((max, i) => Math.max(max, Number(i.addedAt) || 0), 0);
  if (!ultimo) return false;
  return (ahora - ultimo) > umbralMs;
}

/** Siguiente id libre: el mayor que exista + 1, nunca reutiliza números. */
export function siguienteClienteId(cart, cid = 1) {
  const maxEnCanasta = (cart || []).reduce(
    (max, i) => Math.max(max, Number(i.cartClientId) || 1), 0
  );
  return Math.max(maxEnCanasta, Number(cid) || 1) + 1;
}

/** Nombre a mostrar: el puesto a mano, o "Cliente N". */
export function nombreCliente(nombres, cid) {
  const n = nombres && nombres[cid];
  return (typeof n === 'string' && n.trim()) ? n.trim() : `Cliente ${cid}`;
}

/**
 * Totales por cliente, en orden numérico. La UI los pinta tal cual.
 */
export function resumenPorCliente(cart, nombres = {}) {
  const porCid = new Map();
  (cart || []).forEach(i => {
    const cid = Number(i.cartClientId) || 1;
    const cant = Number(i.cant) || 1;
    const precio = Number(i.precio) || 0;
    if (!porCid.has(cid)) porCid.set(cid, { cid, nombre: nombreCliente(nombres, cid), piezas: 0, total: 0 });
    const g = porCid.get(cid);
    g.piezas += cant;
    g.total += precio * cant;
  });
  return [...porCid.values()].sort((a, b) => a.cid - b.cid);
}

/**
 * Identifica una línea de la canasta aunque cambie de posición. Las líneas del
 * mismo perfume, talla y cliente se fusionan al agregarlas, así que esto es único.
 */
export function claveCanasta(item) {
  const i = item || {};
  return [i.id, i.ml, Number(i.cartClientId) || 1, i.addedAt || ''].join('|');
}

/**
 * La canasta sin las líneas que se acaban de registrar. Lo demás se queda:
 * lo que no se guardó, o lo que se agregó mientras el registro estaba abierto.
 */
export function canastaRestante(cart, clavesGuardadas) {
  const guardadas = new Set(clavesGuardadas || []);
  return (cart || []).filter(i => !guardadas.has(claveCanasta(i)));
}
