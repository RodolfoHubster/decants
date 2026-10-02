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

// ── Presets de transformación (Refactorizados) ──────────────────────────────
// Check if admin data saver is active (prevents loading heavy images)
const isDataSaver = () => typeof localStorage !== 'undefined' && localStorage.getItem('adminDataSaver') === '1';
// Modo ahorro: un frasco dibujado en SVG, embebido. Cero bytes de red, igual
// que el píxel transparente de antes, pero se ve intencional y no roto.
const blankPixel = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#1e1e1e"/>' +
  '<g fill="none" stroke="#c9a84c" stroke-width="3" opacity=".7">' +
  '<rect x="42" y="18" width="16" height="10" rx="2"/>' +
  '<path d="M38 28h24v8c8 4 12 10 12 20v18a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8V56c0-10 4-16 12-20z"/>' +
  '</g></svg>');

/** Imagen o, si no hay, el mismo frasco del modo ahorro. */
export function imgOPlaceholder(url, fn) {
  return url ? fn(url) : blankPixel;
}

/**
 * Imagen para card del catálogo (Reutilizable para tamaños medianos).
 * 500x500px - Se elimina dpr_auto para evitar multiplicar cuotas.
 */
export function imgCard(url) {
  if (isDataSaver()) return blankPixel;
  return transform(url, 'w_500,h_500,c_fill,f_auto,q_auto');
}

/**
 * Imagen para el modal de detalle del perfume.
 * 800x800px.
 */
export function imgModal(url) {
  if (isDataSaver()) return blankPixel;
  return transform(url, 'w_800,h_800,c_fill,f_auto,q_auto');
}

/**
 * Imagen para el ítem dentro del carrito Y miniaturas de admin.
 * Unificamos a 100x100px para maximizar hit rate de caché y ahorrar tokens.
 */
export function imgCart(url) {
  if (isDataSaver()) return blankPixel;
  return transform(url, 'w_100,h_100,c_fill,f_auto,q_auto');
}

export function imgThumb(url) {
  // Ahora llama a la misma transformación exacta del carrito
  return imgCart(url);
}

/**
 * Imagen para meta tags Open Graph (compartir en redes).
 */
export function imgOg(url) {
  return transform(url, 'w_1200,h_630,c_fill,f_auto,q_auto');
}

/**
 * Placeholder borroso para blur-up.
 */
export function imgPlaceholder(url) {
  if (isDataSaver()) return blankPixel;
  return transform(url, 'w_20,h_20,c_fill,f_auto,q_auto,e_blur:200');
}

export { CLOUD_NAME };
