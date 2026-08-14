/**
 * Pruebas del módulo real assets/js/lotes.js
 *
 * A diferencia de otros tests que replican la lógica, estos importan el módulo
 * que usa la app, así que una regresión en el código real rompe el test.
 */

import { resolveLoteId, ventasDeLote, esResto } from '../assets/js/lotes.js';

describe('resolveLoteId', () => {
  const unLote = [{ id: 'lote-1716854400000' }];
  const dosLotes = [{ id: 'lote-A' }, { id: 'lote-B' }];

  test('sin lotes devuelve null', () => {
    expect(resolveLoteId([], 'lote-A')).toBeNull();
    expect(resolveLoteId(undefined, 'lote-A')).toBeNull();
  });

  test('con un solo lote, cualquier venta cae en ese lote', () => {
    expect(resolveLoteId(unLote, 'lote-1716854400000')).toBe('lote-1716854400000');
    expect(resolveLoteId(unLote, 'lote-1')).toBe('lote-1716854400000');
    expect(resolveLoteId(unLote, undefined)).toBe('lote-1716854400000');
  });

  test('con varios lotes respeta el loteId cuando existe', () => {
    expect(resolveLoteId(dosLotes, 'lote-B')).toBe('lote-B');
  });

  test('con varios lotes, venta sin loteId cae al primero', () => {
    expect(resolveLoteId(dosLotes, undefined)).toBe('lote-A');
    expect(resolveLoteId(dosLotes, '')).toBe('lote-A');
  });

  test('con varios lotes, loteId huérfano cae al primero', () => {
    expect(resolveLoteId(dosLotes, 'lote-1')).toBe('lote-A');
    expect(resolveLoteId(dosLotes, 'lote-borrado-999')).toBe('lote-A');
  });
});

describe('esResto', () => {
  test.each(['Resto', 'resto', 'Resto ml', '  RESTO  '])('reconoce "%s"', (t) => {
    expect(esResto(t)).toBe(true);
  });

  test.each(['5', '10', 'Completo', 'Paquete 5', '', undefined])('rechaza "%s"', (t) => {
    expect(esResto(t)).toBe(false);
  });
});

describe('ventasDeLote', () => {
  test('ninguna venta se pierde ni se cuenta dos veces', () => {
    const lotes = [{ id: 'lote-A' }, { id: 'lote-B' }];
    const ventas = [
      { talla: '5', loteId: 'lote-A' },
      { talla: '5', loteId: 'lote-B' },
      { talla: '5', loteId: 'lote-1' },
      { talla: '5' },
    ];

    const enA = ventasDeLote(ventas, lotes, 'lote-A');
    const enB = ventasDeLote(ventas, lotes, 'lote-B');

    expect(enA).toHaveLength(3);
    expect(enB).toHaveLength(1);
    expect(enA.length + enB.length).toBe(ventas.length);
  });

  test('Rome Pour Homme: un lote con venta de Resto suma todas sus ventas', () => {
    const lotes = [{ id: 'lote-1716854400000', costo: 500, tamano: 100 }];
    const ventas = [
      { talla: '5', precio: 80, loteId: 'lote-1' },
      { talla: '5', precio: 80, loteId: '' },
      { talla: '5', precio: 90, loteId: 'lote-1716854400000' },
      { talla: '10', precio: 160 },
      { talla: 'Resto ml', precio: 400, loteId: 'lote-desconocido' },
    ];

    const hist = ventasDeLote(ventas, lotes, 'lote-1716854400000');
    expect(hist).toHaveLength(5);

    const ingreso = hist.reduce((s, v) => s + v.precio, 0);
    expect(ingreso).toBe(810);
    expect(hist.some(v => esResto(v.talla))).toBe(true);
  });

  test('Rome Extradose Femme: sin Resto, suma 25ml de ventas numéricas', () => {
    const lotes = [{ id: 'lote-X', costo: 500, tamano: 100 }];
    const ventas = [
      { talla: '5', precio: 80, cantidad: 1 },
      { talla: '5', precio: 80, cantidad: 1 },
      { talla: '5', precio: 90, cantidad: 1 },
      { talla: '10', precio: 160, cantidad: 1 },
    ];

    const hist = ventasDeLote(ventas, lotes, 'lote-X');
    const ml = hist.reduce((s, v) => s + parseFloat(v.talla) * (v.cantidad || 1), 0);
    const ingreso = hist.reduce((s, v) => s + v.precio, 0);

    expect(ml).toBe(25);
    expect(ingreso).toBe(410);
    expect(hist.some(v => esResto(v.talla))).toBe(false);
  });
});
