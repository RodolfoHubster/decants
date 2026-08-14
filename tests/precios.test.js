/**
 * Pruebas del módulo real assets/js/precios.js
 */

import { ahorroPorTalla } from '../assets/js/precios.js';

describe('ahorroPorTalla', () => {
  // Odyssey Mandarin Sky, precios reales del catálogo.
  const odyssey = [['3', 60], ['5', 80], ['10', 120]];

  test('10ml ahorra frente a dos de 5ml', () => {
    // 2 × $80 = $160 contra $120
    expect(ahorroPorTalla(odyssey, '10', 120)).toBe(40);
  });

  test('la talla más chica no tiene con qué compararse', () => {
    expect(ahorroPorTalla(odyssey, '3', 60)).toBe(0);
  });

  test('5ml no compara contra 3ml: no cabe un número exacto de veces', () => {
    expect(ahorroPorTalla(odyssey, '5', 80)).toBe(0);
  });

  test('se queda con el mayor ahorro entre varias comparaciones', () => {
    // 10ml contra 5×2ml ($150) y contra 2×5ml ($160): gana el de $160.
    const conDos = [['2', 30], ['5', 80], ['10', 120]];
    expect(ahorroPorTalla(conDos, '10', 120)).toBe(40);
  });

  test('no inventa ahorro cuando la talla grande sale más cara', () => {
    const raro = [['5', 80], ['10', 200]];   // 2×5 = $160 < $200
    expect(ahorroPorTalla(raro, '10', 200)).toBe(0);
  });

  test('ignora tallas sin precio', () => {
    const con2ml = [['2', 0], ['5', 80], ['10', 120]];
    expect(ahorroPorTalla(con2ml, '10', 120)).toBe(40);
  });

  test('tolera entradas inválidas', () => {
    expect(ahorroPorTalla(null, '10', 120)).toBe(0);
    expect(ahorroPorTalla(odyssey, '0', 120)).toBe(0);
    expect(ahorroPorTalla(odyssey, '10', 0)).toBe(0);
    expect(ahorroPorTalla(odyssey, 'Resto', 400)).toBe(0);
  });

  test('nunca expone una tarifa por ml, solo el ahorro absoluto', () => {
    // El valor devuelto es una diferencia en pesos, no una división.
    const r = ahorroPorTalla(odyssey, '10', 120);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBe(40);              // $160 − $120, no $12/ml
  });
});
