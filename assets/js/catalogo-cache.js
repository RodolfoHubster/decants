/**
 * catalogo-cache.js — Guarda el catálogo entre pantallas de una misma visita.
 *
 * Abrir el catálogo cuesta 112 lecturas de Firestore (89 perfumes + 11 paquetes
 * + 9 familias + 2 accesorios + config) y hasta ahora cada recarga las volvía a
 * cobrar. Con la cuota gratuita eso son ~446 visitas diarias, y una sola persona
 * que recargue diez veces gasta lo mismo que diez visitantes.
 *
 * Se usa `sessionStorage` a propósito: dura lo que la pestaña, así que al volver
 * otro día siempre se ven datos frescos.
 *
 * Módulo puro y sin dependencias: lo importan el catálogo y los tests.
 */

/** Subir la versión invalida lo guardado cuando cambia la forma de los datos. */
const CLAVE = 'catalogo_v1';

/**
 * Cinco minutos: acota cuánto puede tardar en verse un cambio de stock hecho
 * desde el panel. Una pestaña abierta ya arrastra ese desfase hoy, así que no
 * introduce un problema nuevo, sólo lo mantiene acotado.
 */
export const VIGENCIA_MS = 5 * 60 * 1000;

/**
 * Devuelve el catálogo guardado si sigue vigente.
 *
 * @param {Storage} almacen  Inyectable para poder probarlo.
 * @param {number}  ahora    Marca de tiempo, inyectable para poder probarlo.
 * @returns {object|null} null si no hay nada, si expiró o si está corrupto.
 */
export function leerCache(almacen = globalThis.sessionStorage, ahora = Date.now()) {
  try {
    const crudo = almacen?.getItem(CLAVE);
    if (!crudo) return null;

    const { guardadoEn, datos } = JSON.parse(crudo);
    if (typeof guardadoEn !== 'number' || !datos) return null;
    if (ahora - guardadoEn > VIGENCIA_MS) return null;

    return datos;
  } catch {
    // Un JSON corrupto no debe tumbar el catálogo: se pide de nuevo.
    return null;
  }
}

/**
 * Guarda el catálogo recién traído.
 *
 * @returns {boolean} false si no se pudo (por ejemplo, sin espacio).
 */
export function guardarCache(datos, almacen = globalThis.sessionStorage, ahora = Date.now()) {
  try {
    almacen?.setItem(CLAVE, JSON.stringify({ guardadoEn: ahora, datos }));
    return true;
  } catch {
    // Quedarse sin cuota de almacenamiento sólo significa seguir sin caché.
    return false;
  }
}

/** Borra lo guardado. Útil tras un error o al forzar recarga. */
export function borrarCache(almacen = globalThis.sessionStorage) {
  try {
    almacen?.removeItem(CLAVE);
  } catch { /* nada que hacer */ }
}
