import {
  mlDeTalla, tipoDeVenta, contextoRentabilidad, costoDeVenta, resumenGanancia,
  clientesAtendidos, rentabilidadPorBotella, consumoDePerfume,
} from '../assets/js/rentabilidad.js';

const costosOp = { botella: 7, etiqueta: 1, bolsa: 0, reforzadaCosto: 13 };
// Mismo perfume comprado dos veces a distinto precio.
const sauvage = {
  id: 'sau', nombre: 'Sauvage', precios: { 5: 90, 10: 160 },
  lotes: [
    { id: 'lote-a', fecha: 1, costo: 350, tamano: 100 },
    { id: 'lote-b', fecha: 2, costo: 400, tamano: 100 },
  ],
};
const accesorios = [{ id: 'atom', nombre: 'Decant Travel', costo: 14 }];
const ctxCon = (ventas, extra = {}) => contextoRentabilidad({ perfumes: [sauvage], accesorios, costosOp, ventas, ...extra });

describe('mlDeTalla', () => {
  test('lee ml de tallas y combos; lo demás es 0', () => {
    expect(mlDeTalla('5')).toBe(5);
    expect(mlDeTalla('Paquete 10')).toBe(10);
    expect(mlDeTalla('Resto')).toBe(0);
    expect(mlDeTalla('1 ud')).toBe(1); // por eso tipoDeVenta la separa antes
  });
});

describe('tipoDeVenta', () => {
  const ctx = ctxCon([]);
  test('accesorio por id, por marca o por "1 ud": nunca decant', () => {
    expect(tipoDeVenta({ perfumeId: 'atom', talla: '1 ud' }, ctx)).toBe('accesorio');
    expect(tipoDeVenta({ perfumeId: 'x', perfumeMarca: 'Accesorio', talla: '5' }, ctx)).toBe('accesorio');
    expect(tipoDeVenta({ perfumeId: 'x', talla: '2 ud' }, ctx)).toBe('accesorio');
  });
  test('decant, resto, completo, paquete', () => {
    expect(tipoDeVenta({ perfumeId: 'sau', talla: '10' }, ctx)).toBe('decant');
    expect(tipoDeVenta({ perfumeId: 'sau', talla: 'Resto' }, ctx)).toBe('resto');
    expect(tipoDeVenta({ perfumeId: 'sau', talla: 'Completo' }, ctx)).toBe('completo');
    expect(tipoDeVenta({ perfumeId: 'p', talla: 'Paquete 5', paqueteItems: [{ id: 'sau' }] }, ctx)).toBe('paquete');
  });
});

describe('costoDeVenta: cada venta usa el costo de SU botella', () => {
  test('el mismo decant cuesta distinto según la botella', () => {
    const ctx = ctxCon([]);
    const a = costoDeVenta({ perfumeId: 'sau', talla: '10', cantidad: 1, loteId: 'lote-a' }, ctx);
    const b = costoDeVenta({ perfumeId: 'sau', talla: '10', cantidad: 1, loteId: 'lote-b' }, ctx);
    expect(a.costo).toBeCloseTo(35 + 8); // 10 ml a $3.50 + insumos
    expect(b.costo).toBeCloseTo(40 + 8);
  });
  test('botella completa comprada a 350 y vendida a 700 deja 350, no 700', () => {
    const ventas = [{ perfumeId: 'sau', talla: 'Completo', precio: 700, cantidad: 1, loteId: 'lote-a' }];
    const r = resumenGanancia(ventas, ctxCon(ventas));
    expect(r.ganancia).toBe(350);
  });
  test('la completa usa costoCompleto si la venta lo trae', () => {
    const ventas = [{ perfumeId: 'otro', talla: 'Completo', precio: 1200, cantidad: 1, costoCompleto: 800 }];
    expect(resumenGanancia(ventas, ctxCon(ventas)).ganancia).toBe(400);
  });
  test('reforzada suma su costo extra', () => {
    const c = costoDeVenta({ perfumeId: 'sau', talla: '5', cantidad: 2, loteId: 'lote-a', reforzada: true }, ctxCon([]));
    expect(c.costo).toBeCloseTo((17.5 + 8 + 13) * 2);
  });
  test('resto: cuesta solo los ml que quedaban en esa botella, sin insumos', () => {
    const ventas = [
      { perfumeId: 'sau', talla: '10', cantidad: 7, loteId: 'lote-a' },
      { perfumeId: 'sau', talla: 'Resto', cantidad: 1, precio: 600, loteId: 'lote-a' },
    ];
    const c = costoDeVenta(ventas[1], ctxCon(ventas));
    expect(c.costo).toBeCloseTo(30 * 3.5);
    expect(c.ml).toBe(30);
  });
  test('combo: un frasco y etiqueta por perfume, una sola bolsa', () => {
    const ctx = contextoRentabilidad({ perfumes: [sauvage], costosOp: { ...costosOp, bolsa: 5 } });
    const c = costoDeVenta({ perfumeId: 'combo', talla: 'Paquete 5', cantidad: 1,
      paqueteItems: [{ id: 'sau', loteId: 'lote-a' }, { id: 'sau', loteId: 'lote-b' }] }, ctx);
    expect(c.costo).toBeCloseTo(5 + 8 * 2 + 17.5 + 20);
    expect(c.piezas).toBe(2);
  });
});

describe('resumenGanancia', () => {
  test('accesorios aparte: su costo cuenta, pero no son decants ni ml', () => {
    const ventas = [
      { perfumeId: 'sau', talla: '5', precio: 90, cantidad: 1, loteId: 'lote-a' },
      { perfumeId: 'atom', perfumeMarca: 'Accesorio', talla: '1 ud', precio: 50, cantidad: 2 },
    ];
    const r = resumenGanancia(ventas, ctxCon(ventas));
    expect(r.decants).toBe(1);
    expect(r.ml).toBe(5);
    expect(r.porTipo.accesorio).toEqual({ ingresos: 100, costo: 28, ganancia: 72, unidades: 2 });
    expect(r.ganancia).toBeCloseTo(190 - (17.5 + 8) - 28);
  });
  test('la comisión del punto externo se resta de la ganancia', () => {
    const ventas = [{ perfumeId: 'sau', talla: '5', precio: 120, cantidad: 2, canal: 'consignacion', comision: 15, loteId: 'lote-a' }];
    const r = resumenGanancia(ventas, ctxCon(ventas));
    expect(r.comisiones).toBe(30);
    expect(r.ganancia).toBeCloseTo(240 - (25.5 * 2) - 30);
  });
  test('cuenta las ventas sin de dónde sacar el costo', () => {
    const ventas = [{ perfumeId: 'borrado', talla: 'Completo', precio: 900, cantidad: 1 }];
    expect(resumenGanancia(ventas, ctxCon(ventas)).sinCosto).toBe(1);
  });
});

describe('clientesAtendidos', () => {
  const dia = new Date(2026, 8, 17, 12).getTime();
  test('un ticket con varios perfumes es un cliente', () => {
    expect(clientesAtendidos([
      { ticketId: 'r1-t1', cliente: 'Cliente 1', creadoEn: dia },
      { ticketId: 'r1-t1', cliente: 'Cliente 1', creadoEn: dia + 1 },
      { ticketId: 'r1-t2', cliente: 'Cliente 2', creadoEn: dia + 2 },
    ])).toBe(2);
  });
  test('ventas viejas: mismo cliente el mismo día es una visita; otro día, otra', () => {
    expect(clientesAtendidos([
      { cliente: 'Cliente 3', creadoEn: dia },
      { cliente: 'cliente 3', creadoEn: dia + 5 },
      { cliente: 'Cliente 3', creadoEn: dia + 86400000 },
      { cliente: 'María López', creadoEn: dia },
      { cliente: 'Maria Lopez', creadoEn: dia + 9 },
    ])).toBe(3);
  });
  test('sin cliente o de punto externo: cada venta cuenta', () => {
    expect(clientesAtendidos([
      { id: 'a', cliente: '', creadoEn: dia }, { id: 'b', creadoEn: dia },
      { id: 'c', cliente: 'Barbería', canal: 'consignacion', creadoEn: dia },
      { id: 'd', cliente: 'Barbería', canal: 'consignacion', creadoEn: dia },
    ])).toBe(4);
  });
});

describe('rentabilidadPorBotella', () => {
  test('el perfume suma todas sus botellas y la botella en uso es la más vieja sin terminar', () => {
    const hist = [
      { talla: '10', precio: 160, cantidad: 10, loteId: 'lote-a' },
      { talla: '5', precio: 90, cantidad: 2, loteId: 'lote-b' },
    ];
    const r = rentabilidadPorBotella(sauvage, hist, costosOp);
    expect(r.botellas[0].progreso).toBe(100);
    expect(r.botellas[1].usado).toBe(10);
    expect(r.enUso.id).toBe('lote-b');
    expect(r.total.ingreso).toBe(1600 + 180);
    expect(r.total.costoReal).toBe(350 + 80 + 400 + 16);
    expect(r.total.gananciaReal).toBe(r.botellas[0].gananciaReal + r.botellas[1].gananciaReal);
  });
  test('un resto cierra la botella al 100%', () => {
    const r = rentabilidadPorBotella(sauvage, [{ talla: 'Resto', precio: 600, cantidad: 1, loteId: 'lote-b' }], costosOp);
    expect(r.botellas[1]).toMatchObject({ restoVendido: true, progreso: 100, ingreso: 600 });
    expect(r.enUso.id).toBe('lote-a');
  });
});

describe('consumoDePerfume', () => {
  test('cuenta ventas de puntos externos sin botella y lo dejado en consignación', () => {
    const ventas = [
      { perfumeId: 'sau', talla: '10', cantidad: 8, loteId: 'lote-a' },
      { perfumeId: 'sau', talla: '5', cantidad: 4, canal: 'consignacion' }, // sin loteId
      { perfumeId: 'sau', talla: 'Resto', cantidad: 1, loteId: 'lote-viejo-borrado' },
    ];
    const r = consumoDePerfume(sauvage, ventas, [{ perfumeId: 'sau', talla: '5', cantidad: 6 }]);
    // lote-a: 80 + 20 + 30 = 100 (tope) y el resto huérfano también cae en lote-a.
    expect(r.capacidad).toBe(200);
    expect(r.usado).toBe(100);
  });
});
