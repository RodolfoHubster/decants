/**
 * imagenes.js — Cambiar una foto sin que se vea la anterior.
 *
 * Asignar `img.src` no reemplaza la imagen al instante: el navegador sigue
 * mostrando la anterior hasta terminar de bajar la nueva. Si al mismo tiempo
 * se actualiza el texto, durante unos segundos se ve un perfume con el
 * nombre de otro.
 *
 * La solución es esperar a que la foto esté lista y recién entonces cambiar
 * imagen y texto a la vez.
 *
 * Módulo puro: la fábrica de imágenes se inyecta para poder probarlo.
 */

/**
 * Descarga una imagen y avisa cuando puede mostrarse.
 *
 * @param {string} url
 * @param {function():HTMLImageElement} crearImagen  Inyectable en pruebas.
 * @returns {Promise<boolean>} true si cargó; false si falló o no había URL.
 *   Nunca rechaza: una foto rota no debe romper la pantalla.
 */
export function precargarImagen(url, crearImagen = () => new Image()) {
  return new Promise(resolver => {
    if (!url) return resolver(false);

    const im = crearImagen();
    im.onload  = () => resolver(true);
    im.onerror = () => resolver(false);
    im.src = url;

    // Si ya estaba en caché, `complete` es true sin esperar al evento.
    if (im.complete) resolver(true);
  });
}
