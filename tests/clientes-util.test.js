/**
 * Pruebas del módulo real assets/js/clientes-util.js
 */

import { esNombreGenerico, esClienteTemporal, claveCliente, idCliente } from '../assets/js/clientes-util.js';

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

import { indiceClientes, buscarCliente } from '../assets/js/clientes-util.js';

describe('indiceClientes', () => {
  const D = (d) => new Date(2026, 8, d, 12).getTime();
  const v = (cliente, dia, extra = {}) => ({ cliente, creadoEn: D(dia), precio: 100, cantidad: 1, perfumeNombre: 'P', ...extra });

  test('agrupa por cliente y cuenta visitas por día, no por pieza', () => {
    const r = indiceClientes([v('Juan Pérez', 1), v('Juan Pérez', 1), v('juan perez', 5, { perfumeNombre: 'Hawas' })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ compras: 2, total: 300, ultimoPerfume: 'Hawas', nombre: 'juan perez' });
  });

  test('excluye clientes de paso y canceladas', () => {
    const r = indiceClientes([
      v('Cliente 3', 1, { clienteId: 'SR-2026-09-01-003' }),
      v('Cliente 4', 1),
      v('Ana', 2, { estado: 'cancelada' }),
    ]);
    expect(r).toEqual([]);
  });

  test('excluye ventas de puntos externos: el nombre es del lugar', () => {
    expect(indiceClientes([v('Barbería de Verona', 1, { canal: 'consignacion' })])).toEqual([]);
  });

  test('ordena por compra más reciente', () => {
    const r = indiceClientes([v('Viejo', 1), v('Nuevo', 20)]);
    expect(r.map(c => c.nombre)).toEqual(['Nuevo', 'Viejo']);
  });

  test('acepta Timestamp de Firestore', () => {
    const r = indiceClientes([{ cliente: 'Ana', creadoEn: { seconds: D(3) / 1000 }, precio: 50 }]);
    expect(r[0].ultima).toBe(D(3));
  });
});

describe('buscarCliente', () => {
  const idx = [{ nombre: 'José Ángel', compras: 3 }];
  test('ignora mayúsculas, acentos y espacios', () => {
    expect(buscarCliente(idx, 'jose angel')).toBe(idx[0]);
    expect(buscarCliente(idx, 'JOSÉ  ÁNGEL')).toBe(idx[0]);
  });
  test('sin coincidencia o vacío devuelve null', () => {
    expect(buscarCliente(idx, 'otro')).toBeNull();
    expect(buscarCliente(idx, '')).toBeNull();
  });
});

describe('idCliente y acentos', () => {
  test('María López y Maria Lopez son la misma persona', () => {
    expect(idCliente('María López', '2026-10-03')).toBe('NAMED-marialopez');
    expect(idCliente('Maria Lopez', '2026-10-03')).toBe('NAMED-marialopez');
  });
  test('los Cliente N llevan id del día', () => {
    expect(idCliente('Cliente 7', '2026-10-03')).toBe('SR-2026-10-03-007');
    expect(idCliente('', '2026-10-03')).toBe('');
  });
  test('claveCliente une los ids viejos que borraban la letra acentuada', () => {
    expect(claveCliente({ clienteId: 'NAMED-maralpez', cliente: 'María López' })).toBe('NAMED-marialopez');
    expect(claveCliente({ clienteId: 'SR-2026-10-03-007', cliente: 'Cliente 7' })).toBe('SR-2026-10-03-007');
  });
});
