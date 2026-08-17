/**
 * Pruebas del módulo real assets/js/catalogo-cache.js
 */

import { leerCache, guardarCache, borrarCache, VIGENCIA_MS } from '../assets/js/catalogo-cache.js';

/** Almacén de mentira, para no depender de sessionStorage real. */
function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
    _datos: datos
  };
}

const catalogo = {
  all: [{ id: 'p1', nombre: 'Hawas for him' }],
  disable2ml: false,
  famData: [{ id: 'f1', nombre: 'Oriental' }]
};

describe('guardar y leer', () => {
  test('lo guardado se recupera igual', () => {
    const a = almacenFalso();
    guardarCache(catalogo, a, 1000);
    expect(leerCache(a, 1000)).toEqual(catalogo);
  });

  test('sin nada guardado devuelve null', () => {
    expect(leerCache(almacenFalso(), 1000)).toBeNull();
  });

  test('guardar informa si tuvo éxito', () => {
    expect(guardarCache(catalogo, almacenFalso(), 1000)).toBe(true);
  });
});

describe('vigencia', () => {
  test('dentro de la ventana sigue sirviendo', () => {
    const a = almacenFalso();
    guardarCache(catalogo, a, 1000);
    expect(leerCache(a, 1000 + VIGENCIA_MS - 1)).toEqual(catalogo);
  });

  test('pasada la ventana se descarta y se vuelve a pedir', () => {
    const a = almacenFalso();
    guardarCache(catalogo, a, 1000);
    expect(leerCache(a, 1000 + VIGENCIA_MS + 1)).toBeNull();
  });

  test('la ventana son cinco minutos', () => {
    expect(VIGENCIA_MS).toBe(5 * 60 * 1000);
  });
});

describe('resistencia a datos malos', () => {
  test('un JSON corrupto no revienta: se pide de nuevo', () => {
    const a = almacenFalso({ catalogo_v1: '{esto no es json' });
    expect(leerCache(a, 1000)).toBeNull();
  });

  test('sin marca de tiempo se descarta', () => {
    const a = almacenFalso({ catalogo_v1: JSON.stringify({ datos: catalogo }) });
    expect(leerCache(a, 1000)).toBeNull();
  });

  test('sin datos se descarta', () => {
    const a = almacenFalso({ catalogo_v1: JSON.stringify({ guardadoEn: 1000 }) });
    expect(leerCache(a, 1000)).toBeNull();
  });

  test('si el almacén está lleno, guardar falla sin lanzar', () => {
    const lleno = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
    expect(guardarCache(catalogo, lleno, 1000)).toBe(false);
  });

  test('si el almacén no existe (modo privado) no lanza', () => {
    expect(() => leerCache(null, 1000)).not.toThrow();
    expect(leerCache(null, 1000)).toBeNull();
    expect(() => guardarCache(catalogo, null, 1000)).not.toThrow();
  });
});

describe('borrar', () => {
  test('tras borrar ya no hay nada', () => {
    const a = almacenFalso();
    guardarCache(catalogo, a, 1000);
    borrarCache(a);
    expect(leerCache(a, 1000)).toBeNull();
  });

  test('borrar sin almacén no lanza', () => {
    expect(() => borrarCache(null)).not.toThrow();
  });
});
