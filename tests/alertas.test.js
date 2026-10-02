import { aMs, resumenVentas, topVendidos, pendientes } from '../assets/js/alertas.js';

const DIA = 24 * 60 * 60 * 1000;
// Miércoles 15 de octubre 2026, 14:00 hora local.
const AHORA = new Date(2026, 9, 15, 14, 0, 0).getTime();
const hace = d => AHORA - d * DIA;
const venta = (dias, precio, extra = {}) =>
  ({ creadoEn: hace(dias), precio, cantidad: 1, estado: 'pagada', perfumeNombre: 'X', ...extra });

describe('aMs', () => {
  test('acepta número, Timestamp, {seconds}, string y vacío', () => {
    expect(aMs(1000)).toBe(1000);
    expect(aMs({ toMillis: () => 5 })).toBe(5);
    expect(aMs({ seconds: 2 })).toBe(2000);
    expect(aMs('2026-01-01T00:00:00Z')).toBe(Date.UTC(2026, 0, 1));
    expect(aMs(null)).toBe(0);
    expect(aMs('basura')).toBe(0);
  });
});

describe('resumenVentas', () => {
  test('separa hoy, semana y mes; ignora canceladas', () => {
    const r = resumenVentas([
      venta(0, 100),
      venta(1, 50),                       // martes: misma semana
      venta(5, 30),                       // viernes pasado: este mes, otra semana
      venta(0, 999, { estado: 'cancelada' }),
    ], AHORA);
    expect(r.hoy).toBe(100);
    expect(r.piezasHoy).toBe(1);
    expect(r.semana).toBe(150);
    expect(r.mes).toBe(180);
  });

  test('compara contra el mes pasado a la misma altura, no completo', () => {
    // 10 de septiembre cuenta (antes del día 15); 25 de septiembre no.
    const r = resumenVentas([
      venta(0, 200),
      { creadoEn: new Date(2026, 8, 10).getTime(), precio: 100, cantidad: 1 },
      { creadoEn: new Date(2026, 8, 25).getTime(), precio: 500, cantidad: 1 },
    ], AHORA);
    expect(r.mesPasado).toBe(100);
    expect(r.cambioMes).toBe(100);
  });

  test('sin mes pasado no inventa porcentaje', () => {
    expect(resumenVentas([venta(0, 10)], AHORA).cambioMes).toBeNull();
  });

  test('multiplica precio por cantidad', () => {
    expect(resumenVentas([venta(0, 90, { cantidad: 3 })], AHORA).hoy).toBe(270);
  });
});

describe('topVendidos', () => {
  test('ordena por unidades desde una fecha', () => {
    const t = topVendidos([
      venta(1, 100, { perfumeNombre: 'A' }),
      venta(2, 100, { perfumeNombre: 'B', cantidad: 3 }),
      venta(40, 100, { perfumeNombre: 'C', cantidad: 9 }),  // fuera del rango
    ], hace(30));
    expect(t.map(x => x.nombre)).toEqual(['B', 'A']);
    expect(t[0]).toMatchObject({ unidades: 3, total: 300 });
  });
});

describe('pendientes', () => {
  const claves = d => pendientes(d, AHORA).map(p => p.clave);

  test('sin datos no hay recordatorios', () => {
    expect(pendientes({}, AHORA)).toEqual([]);
  });

  test('ventas por cobrar suman el monto', () => {
    const [p] = pendientes({ ventas: [venta(0, 80, { estado: 'pendiente', cantidad: 2 })] }, AHORA);
    expect(p.clave).toBe('cobrar');
    expect(p.detalle).toContain('160');
  });

  test('restock solo para agotados que se vendieron recientemente', () => {
    const perfumes = [
      { id: 'a', nombre: 'Se vende', estadoStock: 'agotado', precios: { 5: 90 }, imagen: 'https://res.cloudinary.com/x.jpg' },
      { id: 'b', nombre: 'Nunca se vendió', estadoStock: 'agotado', precios: { 5: 90 }, imagen: 'https://res.cloudinary.com/y.jpg' },
      { id: 'c', nombre: 'Vendido hace mucho', estadoStock: 'agotado', precios: { 5: 90 }, imagen: 'https://res.cloudinary.com/z.jpg' },
    ];
    const ventas = [venta(3, 90, { perfumeId: 'a' }), venta(200, 90, { perfumeId: 'c' })];
    const r = pendientes({ perfumes, ventas }, AHORA).find(p => p.clave === 'restock');
    expect(r.items).toEqual(['Se vende · 1 vendidos']);
  });

  test('detecta sin precio, sin foto y foto externa solo en perfumes activos', () => {
    const perfumes = [
      { id: '1', nombre: 'Sin precio', precios: {}, imagen: 'https://res.cloudinary.com/a.jpg' },
      { id: '2', nombre: 'Sin foto', precios: { 5: 90 } },
      { id: '3', nombre: 'Externa', precios: { 5: 90 }, imagen: 'https://fimgs.net/x.jpg' },
      { id: '4', nombre: 'Inactivo', precios: {}, activo: false },
      { id: '5', nombre: 'Archivado', precios: {}, archivado: true },
    ];
    const r = pendientes({ perfumes }, AHORA);
    expect(r.find(p => p.clave === 'sin-precio').items).toEqual(['Sin precio']);
    expect(r.find(p => p.clave === 'sin-imagen').items).toEqual(['Sin foto']);
    expect(r.find(p => p.clave === 'img-externa').items).toEqual(['Externa']);
  });

  test('encargos parados según su última actualización', () => {
    const encargos = [
      { cliente: 'Ana', perfume: 'Aventus', estado: 'buscando', creadoEn: { seconds: hace(10) / 1000 } },
      { cliente: 'Beto', estado: 'buscando', creadoEn: { seconds: hace(10) / 1000 }, actualizadoEn: { seconds: hace(1) / 1000 } },
      { cliente: 'Caro', estado: 'entregado', creadoEn: { seconds: hace(30) / 1000 } },
    ];
    const r = pendientes({ encargos }, AHORA).find(p => p.clave === 'encargos');
    expect(r.items).toEqual(['Ana · Aventus · 10 días']);
  });

  test('puntos externos con mercancía sin vender tras una semana', () => {
    const consignaciones = [
      { lugar: 'Barbería', estado: 'Abierto', creadoEn: hace(9), items: [{ cantidad: 4, vendidos: 2 }] },
      { lugar: 'Nuevo', estado: 'Abierto', creadoEn: hace(2), items: [{ cantidad: 4, vendidos: 0 }] },
      { lugar: 'Vendido', estado: 'Abierto', creadoEn: hace(20), items: [{ cantidad: 2, vendidos: 2 }] },
      { lugar: 'Cerrado', estado: 'Cerrado', creadoEn: hace(20), items: [{ cantidad: 2, vendidos: 0 }] },
    ];
    const r = pendientes({ consignaciones }, AHORA).find(p => p.clave === 'puntos');
    expect(r.items).toEqual(['Barbería · 2 sin vender · 9 días']);
  });

  test('avisa si hace días que no se registran ventas', () => {
    expect(claves({ ventas: [venta(6, 10)] })).toContain('sin-ventas');
    expect(claves({ ventas: [venta(1, 10)] })).not.toContain('sin-ventas');
  });

  test('ordena alta antes que media antes que baja', () => {
    const r = pendientes({
      ventas: [venta(6, 10), venta(6, 10, { estado: 'pendiente' })],
      perfumes: [{ id: '1', nombre: 'Sin foto', precios: { 5: 90 } }],
    }, AHORA);
    expect(r.map(p => p.nivel)).toEqual(['alta', 'media', 'baja']);
  });

  test('pluraliza bien con uno', () => {
    const [p] = pendientes({ pedidos: [{ estado: 'nuevo' }] }, AHORA);
    expect(p.titulo).toBe('1 pedido web sin atender');
  });
});

import { sinMovimiento } from '../assets/js/alertas.js';

describe('sinMovimiento', () => {
  const p = (id, extra = {}) => ({ id, nombre: id, precios: { 5: 90 }, ...extra });

  test('lista perfumes en stock sin ventas en el periodo, nunca vendidos primero', () => {
    const r = sinMovimiento(
      [p('vendido-ayer'), p('hace-45'), p('nunca')],
      [venta(1, 90, { perfumeId: 'vendido-ayer' }), venta(45, 90, { perfumeId: 'hace-45' })],
      AHORA
    );
    expect(r.map(x => x.id)).toEqual(['nunca', 'hace-45']);
    expect(r[0].dias).toBeNull();
    expect(r[1].dias).toBe(45);
  });

  test('ignora agotados, inactivos y sin precio', () => {
    const r = sinMovimiento(
      [p('agotado', { estadoStock: 'agotado' }), p('inactivo', { activo: false }), p('sin-precio', { precios: {} })],
      [], AHORA
    );
    expect(r).toEqual([]);
  });

  test('una venta dentro de un paquete cuenta como movimiento', () => {
    const r = sinMovimiento([p('en-paquete')],
      [venta(2, 300, { paqueteItems: [{ id: 'en-paquete' }] })], AHORA);
    expect(r).toEqual([]);
  });
});
