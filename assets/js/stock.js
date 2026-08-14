/**
 * stock.js — Disponibilidad real de los perfumes de un paquete.
 *
 * Los paquetes guardan sus items como copia ({id, nombre, marca, imagen}),
 * tomada cuando se armó el combo. Esa copia no se entera de que el perfume
 * después se agotó, así que el catálogo llegaba a ofrecer para elegir algo
 * que ya no hay. La verdad del stock vive siempre en la colección `perfumes`.
 *
 * Módulo puro y sin dependencias: lo importan el catálogo y los tests.
 */

/**
 * ¿Este perfume NO se puede vender ahora mismo?
 *
 * Se considera no disponible tanto lo agotado como lo que ya no está en el
 * catálogo público: el catálogo solo carga perfumes con `activo == true`, así
 * que un perfume ausente de la lista es uno oculto, archivado o borrado.
 *
 * @param {{estadoStock?:string, activo?:boolean, archivado?:boolean}|null|undefined} perfume
 * @returns {boolean} true si no debe poder seleccionarse.
 */
export function estaAgotado(perfume) {
  if (!perfume) return true;
  if (perfume.activo === false) return true;
  if (perfume.archivado === true) return true;
  return perfume.estadoStock === 'agotado';
}

/**
 * Cruza los items copiados del paquete contra el catálogo vivo.
 *
 * Conserva el nombre y la imagen guardados en el paquete (para no depender de
 * que el perfume siga existiendo) y añade la bandera `agotado`.
 *
 * @param {Array<{id:string}>} items      Items tal como los guarda el paquete.
 * @param {Array<{id:string}>} perfumes   Catálogo vivo.
 * @returns {Array<Object>} Los mismos items, cada uno con `agotado:boolean`.
 */
export function resolverItemsPaquete(items, perfumes) {
  const porId = new Map((perfumes || []).map(p => [p.id, p]));
  return (items || []).map(i => ({ ...i, agotado: estaAgotado(porId.get(i.id)) }));
}

/**
 * Cuántos items del paquete se pueden elegir todavía.
 *
 * @param {Array<{agotado:boolean}>} itemsResueltos
 * @returns {number}
 */
export function contarDisponibles(itemsResueltos) {
  return (itemsResueltos || []).filter(i => !i.agotado).length;
}

/**
 * ¿Quedan suficientes perfumes para armar el paquete?
 *
 * Si un combo pide elegir 3 y solo hay 2 disponibles, el cliente nunca podrá
 * completarlo: conviene avisarlo en vez de dejarlo intentando.
 *
 * @param {Array<{agotado:boolean}>} itemsResueltos
 * @param {number} maxSeleccion
 * @returns {boolean}
 */
export function paqueteArmable(itemsResueltos, maxSeleccion) {
  return contarDisponibles(itemsResueltos) >= (+maxSeleccion || 0);
}
