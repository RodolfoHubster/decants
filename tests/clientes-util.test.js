/**
 * Pruebas del módulo real assets/js/clientes-util.js
 */

import { esNombreGenerico, esClienteTemporal, claveCliente } from '../assets/js/clientes-util.js';

describe('esNombreGenerico', () => {
  test.each([
    'Cliente 8', 'Cliente 12', 'cliente 3', 'CLIENTE 100',
    'Cliente', 'cliente', 'Cliente (Sin Nombre)', 'cliente (sin nombre)',
    '  Cliente 5  ', '', '   ', undefined, null,
  ])('marca "%s" como genérico', (n) => {
    expect(esNombreGenerico(n)).toBe(true);
  });

  test.each([
    'jack verona', 'Jack Verona', 'Cliente Especial', 'María López',
    'Cliente del Norte', 'Ana', 'cliente12ab',
  ])('respeta "%s" como nombre real', (n) => {
    expect(esNombreGenerico(n)).toBe(false);
  });
});

describe('esClienteTemporal', () => {
  test('los IDs SR- son de paso', () => {
    expect(esClienteTemporal({ clienteId: 'SR-20260803-012', cliente: 'Cliente 12' })).toBe(true);
  });

  test('los IDs NAMED- son clientes reales', () => {
    expect(esClienteTemporal({ clienteId: 'NAMED-jackverona', cliente: 'jack verona' })).toBe(false);
  });

  test('sin clienteId (datos viejos) se decide por el nombre', () => {
    expect(esClienteTemporal({ cliente: 'Cliente 12' })).toBe(true);
    expect(esClienteTemporal({ cliente: 'jack verona' })).toBe(false);
  });

  test('una venta vacía o sin cliente cuenta como de paso', () => {
    expect(esClienteTemporal(null)).toBe(true);
    expect(esClienteTemporal({})).toBe(true);
  });

  test('el clienteId manda sobre el nombre: renombrado en canasta deja de ser temporal', () => {
    expect(esClienteTemporal({ clienteId: 'NAMED-anagarcia', cliente: 'Cliente 4' })).toBe(false);
  });
});

describe('claveCliente', () => {
  test('usa el clienteId cuando existe', () => {
    expect(claveCliente({ clienteId: 'SR-20260803-012', cliente: 'Cliente 12' })).toBe('SR-20260803-012');
  });

  test('genera NAMED- normalizado desde el nombre real', () => {
    expect(claveCliente({ cliente: 'Jack Verona' })).toBe('NAMED-jackverona');
    expect(claveCliente({ cliente: '  jack   verona ' })).toBe('NAMED-jackverona');
  });

  test('devuelve null para genéricos sin ID: no se agrupan', () => {
    expect(claveCliente({ cliente: 'Cliente 12' })).toBeNull();
    expect(claveCliente({ cliente: '' })).toBeNull();
    expect(claveCliente(null)).toBeNull();
  });
});

describe('Top de clientes — el caso reportado', () => {
  // "Cliente 12" en dos jornadas distintas son personas distintas.
  const ventas = [
    { clienteId: 'NAMED-jackverona',  cliente: 'jack verona', precio: 6750, cantidad: 1 },
    { clienteId: 'SR-20260803-012',   cliente: 'Cliente 12',  precio: 1000, cantidad: 1 },
    { clienteId: 'SR-20260810-012',   cliente: 'Cliente 12',  precio: 1195, cantidad: 1 },
    { clienteId: 'SR-20260803-011',   cliente: 'Cliente 11',  precio: 1530, cantidad: 1 },
    { clienteId: 'SR-20260803-010',   cliente: 'Cliente 10',  precio: 1300, cantidad: 1 },
  ];

  const agrupar = (vs) => {
    const acc = {};
    vs.forEach(v => {
      if (esClienteTemporal(v)) return;
      const k = claveCliente(v);
      if (!k) return;
      acc[k] = (acc[k] || 0) + v.precio * v.cantidad;
    });
    return acc;
  };

  test('solo aparecen clientes con nombre real', () => {
    expect(agrupar(ventas)).toEqual({ 'NAMED-jackverona': 6750 });
  });

  test('dos "Cliente 12" de días distintos nunca se fusionan', () => {
    const soloTemporales = ventas.filter(v => v.cliente === 'Cliente 12');
    const claves = new Set(soloTemporales.map(claveCliente));
    expect(claves.size).toBe(2);
    expect(agrupar(soloTemporales)).toEqual({});
  });

  test('si se renombra en canasta, entra al top', () => {
    const renombrada = ventas.map(v =>
      v.clienteId === 'SR-20260803-012'
        ? { ...v, clienteId: 'NAMED-anagarcia', cliente: 'Ana García' }
        : v
    );
    expect(agrupar(renombrada)).toEqual({ 'NAMED-jackverona': 6750, 'NAMED-anagarcia': 1000 });
  });
});
