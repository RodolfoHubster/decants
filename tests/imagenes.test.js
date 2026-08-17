/**
 * Pruebas del módulo real assets/js/imagenes.js
 */

import { precargarImagen } from '../assets/js/imagenes.js';

/** Imagen de mentira: se controla a mano cuándo termina de "cargar". */
function imagenFalsa({ auto = null, yaEnCache = false } = {}) {
  const im = {
    onload: null, onerror: null, complete: yaEnCache, _src: '',
    set src(v) {
      this._src = v;
      if (auto === 'load')  setTimeout(() => this.onload && this.onload(), 0);
      if (auto === 'error') setTimeout(() => this.onerror && this.onerror(), 0);
    },
    get src() { return this._src; }
  };
  return im;
}

describe('precargarImagen', () => {
  test('resuelve true cuando la imagen carga', async () => {
    const im = imagenFalsa({ auto: 'load' });
    await expect(precargarImagen('foto.jpg', () => im)).resolves.toBe(true);
  });

  test('resuelve false si la imagen falla, sin lanzar', async () => {
    const im = imagenFalsa({ auto: 'error' });
    await expect(precargarImagen('rota.jpg', () => im)).resolves.toBe(false);
  });

  test('sin URL resuelve false de inmediato', async () => {
    await expect(precargarImagen('')).resolves.toBe(false);
    await expect(precargarImagen(null)).resolves.toBe(false);
    await expect(precargarImagen(undefined)).resolves.toBe(false);
  });

  test('si ya está en caché resuelve sin esperar al evento', async () => {
    // No se dispara ningún evento: sólo `complete` en true.
    const im = imagenFalsa({ yaEnCache: true });
    await expect(precargarImagen('cacheada.jpg', () => im)).resolves.toBe(true);
  });

  test('asigna la URL a la imagen', async () => {
    const im = imagenFalsa({ auto: 'load' });
    await precargarImagen('https://x/y.jpg', () => im);
    expect(im.src).toBe('https://x/y.jpg');
  });

  test('nunca rechaza: una foto rota no debe tumbar la pantalla', async () => {
    const im = imagenFalsa({ auto: 'error' });
    let rechazo = false;
    await precargarImagen('rota.jpg', () => im).catch(() => { rechazo = true; });
    expect(rechazo).toBe(false);
  });
});
