/**
 * cloudinary.js — Helpers de transformación de imágenes Fitoscents
 *
 * Uso:
 *   import { imgCard, imgModal, imgCart, imgThumb } from './cloudinary.js';
 *
 *   imgCard(url)   → card del catálogo  (400×400, WebP, q_auto:good)
 *   imgModal(url)  → modal / detalle    (800×800, WebP, q_auto:best)
 *   imgCart(url)   → ítem en el carrito (80×80,   WebP, q_auto:good)
 *   imgThumb(url)  → miniatura admin    (60×60,   WebP, q_auto:eco)
 *   imgOg(url)     → Open Graph meta   (1200×630, WebP, q_auto:good)
 */

const CLOUD_NAME = 'dxo761td7';

/**
 * Detecta si una URL pertenece a este Cloudinary y le inyecta transformaciones.
 * Si la URL NO es de Cloudinary, la devuelve sin cambios.
 *
 * @param {string} url   - URL original guardada en Firestore
 * @param {string} tx    - String de transformaciones Cloudinary (ej. "w_400,h_400,c_fill,f_auto,q_auto:good")
 * @returns {string}
 */
function transform(url, tx) {
  if (!url || typeof url !== 'string') return url;

  // Solo procesar URLs de este cloud
  const base = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
  if (!url.startsWith(base)) return url;

  const rest = url.slice(base.length);

  // Si ya tiene transformaciones aplicadas (contiene "/"), las reemplazamos
  // para evitar apilar transformaciones duplicadas
  const hasExistingTx = /^[^/]+,[^/]+\//.test(rest) || /^[a-z_]+:[^/]+\//.test(rest);
  if (hasExistingTx) {
    // Reemplazar la sección de transformaciones existente
    const withoutOldTx = rest.replace(/^[^/]+\//, '');
    return `${base}${tx}/${withoutOldTx}`;
  }

  return `${base}${tx}/${rest}`;
}

// ── Presets de transformación ──────────────────────────────────────────────

/**
 * Imagen para card del catálogo.
 * 400×400px, recorte centrado, WebP automático, calidad buena.
 * Optimizado para carga rápida en grid mobile.
 */
export function imgCard(url) {
  return transform(url, 'w_400,h_400,c_fill,g_center,f_auto,q_auto:good,dpr_auto');
}

/**
 * Imagen para el modal de detalle del perfume.
 * 800×800px, recorte centrado, máxima calidad visual.
 */
export function imgModal(url) {
  return transform(url, 'w_800,h_800,c_fill,g_center,f_auto,q_auto:best,dpr_auto');
}

/**
 * Imagen para el ítem dentro del carrito/drawer.
 * 80×80px, recorte centrado, calidad buena, carga rápida.
 */
export function imgCart(url) {
  return transform(url, 'w_80,h_80,c_fill,g_center,f_auto,q_auto:good');
}

/**
 * Miniatura para tablas del admin (perfumes, pedidos, etc.).
 * 60×60px, eco (mínima calidad suficiente para tablas).
 */
export function imgThumb(url) {
  return transform(url, 'w_60,h_60,c_fill,g_center,f_auto,q_auto:eco');
}

/**
 * Imagen para meta tags Open Graph (compartir en redes).
 * 1200×630px, recorte con padding, calidad buena.
 */
export function imgOg(url) {
  return transform(url, 'w_1200,h_630,c_fill,g_center,f_auto,q_auto:good');
}

/**
 * Placeholder borroso para blur-up (lazy load progresivo).
 * 20×20px muy comprimido, para usar como src inicial antes de la imagen real.
 * Decodificar como base64 directamente en <img src> para efecto blur-up.
 */
export function imgPlaceholder(url) {
  return transform(url, 'w_20,h_20,c_fill,f_auto,q_1,e_blur:200');
}

export { CLOUD_NAME };
