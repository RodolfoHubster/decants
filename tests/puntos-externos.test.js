import {
  botellaAsignada, piezasFueraDeBotella, filtrarPerfumes, ventasDelPunto, resumenPunto, revisarDisponibilidad, costoProbadores,
  retirarDelPunto, piezasRetirables, ventaDeRetiro,
} from '../assets/js/puntos-externos.js';
import { contextoRentabilidad, consumoDePerfume } from '../assets/js/rentabilidad.js';

const candee = {
  id: 'cand', nombre: 'Odyssey Candee', loteActivo: 'l3',
  lotes: [
    { id: 'l1', costo: 300, tamano: 100, mlAjuste: 0 },
    { id: 'l3', costo: 550, tamano: 200 },
  ],
};
const perfumesPorId = new Map([[candee.id, candee]]);

const barberia = {
  id: 'pt1', lugar: 'Barbería El Buki', estado: 'Abierto', creadoEn: 100, comision: 15,
  items: [{ perfumeId: 'cand', talla: '5', cantidad: 6, vendidos: 2, probadores: 1, precio: 120, loteId: 'l3' }],
};

describe('botellaAsignada', () => {
  test('la marcada como activa; si no hay, la más nueva', () => {
    expect(botellaAsignada(candee).id).toBe('l3');
    expect(botellaAsignada({ ...candee, loteActivo: 'no-existe' }).id).toBe('l3');
    expect(botellaAsignada({ id: 'x' })).toBeNull();
  });
});

describe('piezasFueraDeBotella', () => {
  test('lo que sigue en exhibición y los probadores ya salieron del frasco', () => {
    expect(piezasFueraDeBotella([barberia])).toEqual([{ perfumeId: 'cand', talla: '5', cantidad: 5, loteId: 'l3' }]);
  });
  test('al cerrar el punto lo no vendido regresa; los probadores no', () => {
    expect(piezasFueraDeBotella([{ ...barberia, estado: 'Cerrado' }])[0].cantidad).toBe(1);
  });
});

describe('resumenPunto', () => {
  const ventas = [
    { canal: 'consignacion', puntoId: 'pt1', precio: 120, cantidad: 1, comision: 15, creadoEn: 200 },
    { canal: 'consignacion', cliente: 'barbería el buki', precio: 130, cantidad: 1, comision: 15, creadoEn: 300 },
    { canal: 'consignacion', cliente: 'Barbería El Buki', precio: 999, cantidad: 1, creadoEn: 50 }, // antes del punto
    { canal: 'mercado', cliente: 'Barbería El Buki', precio: 999, cantidad: 1, creadoEn: 300 },
  ];
  test('vendido, comisión y lo que te queda', () => {
    expect(ventasDelPunto(barberia, ventas)).toHaveLength(2);
    expect(resumenPunto(barberia, ventas)).toEqual({
      dejados: 6, vendidos: 2, quedan: 4, probadores: 1, vendido: 250, comision: 30, paraTi: 220, valorEnExhibicion: 480,
    });
  });
});

describe('revisarDisponibilidad', () => {
  test('descuenta de la botella asignada y avisa si no alcanza', () => {
    const ventas = [{ perfumeId: 'cand', talla: '10', cantidad: 15, loteId: 'l3' }]; // 150 ml vendidos de la l3
    const [r] = revisarDisponibilidad(
      [{ perfumeId: 'cand', talla: '5', cantidad: 8, probadores: 1 }, { perfumeId: 'cand', talla: '5', cantidad: 2 }],
      perfumesPorId, ventas, piezasFueraDeBotella([barberia]),
    );
    // Quedaban 200 - 150 - 25 (barbería) = 25 ml; se piden 11 × 5 = 55 ml.
    expect(r).toMatchObject({ botella: 2, restante: 25, ml: 55, despues: -30, alcanza: false });
  });
});

describe('costoProbadores', () => {
  test('líquido de su botella + frasco y etiqueta, sin bolsa', () => {
    const ctx = contextoRentabilidad({ perfumes: [candee], costosOp: { botella: 7, etiqueta: 1, bolsa: 2 } });
    const r = costoProbadores([{ ...barberia, items: [{ ...barberia.items[0], probadores: 2 }] }], ctx, 0);
    expect(r.piezas).toBe(2);
    expect(r.total).toBeCloseTo(2 * (5 * 2.75 + 8));
    expect(costoProbadores([barberia], ctx, 1000).piezas).toBe(0); // fuera del periodo
  });
});

describe('filtrarPerfumes', () => {
  const lista = [
    { nombre: 'Khamrah', marca: 'Lattafa' }, { nombre: 'Asad', marca: 'Lattafa' },
    { nombre: '9PM', marca: 'Afnan' }, { nombre: 'Atlas', marca: 'Lattafa', archivado: true },
    { nombre: 'Bleu de Chanel', marca: 'Chanel' }, { nombre: 'Élixir Bleu', marca: 'X' },
  ];
  const nombres = r => r.map(p => p.nombre);
  test('sin texto salen todos, los archivados al final', () => {
    expect(nombres(filtrarPerfumes(lista, ''))).toEqual(['9PM', 'Asad', 'Bleu de Chanel', 'Élixir Bleu', 'Khamrah', 'Atlas']);
  });
  test('busca por marca y sin acentos; primero lo que empieza igual', () => {
    expect(nombres(filtrarPerfumes(lista, 'lattafa'))).toEqual(['Asad', 'Khamrah', 'Atlas']);
    expect(nombres(filtrarPerfumes(lista, 'bleu'))).toEqual(['Bleu de Chanel', 'Élixir Bleu']);
    expect(nombres(filtrarPerfumes(lista, 'elixir'))).toEqual(['Élixir Bleu']);
  });
  test('tolera cómo lo dices tú: "candy" encuentra Candee, "hamrah" Khamrah', () => {
    const mas = [...lista, { nombre: 'Odyssey Candee', marca: 'Armaf' }];
    expect(nombres(filtrarPerfumes(mas, 'candy'))).toContain('Odyssey Candee');
    expect(nombres(filtrarPerfumes(mas, 'hamrah'))).toEqual(['Khamrah']);
    expect(nombres(filtrarPerfumes(mas, 'odisey candy'))).toEqual(['Odyssey Candee']);
  });
});

describe('editar un punto y retirar piezas (caso Valentino Born in Roma)', () => {
  // Botella #2 de 100 ml: se dejaron 3 de 5 ml para vender + 1 probador y luego se vendió el resto.
  const valentino = { id: 'val', nombre: 'Born in Roma Intense', loteActivo: 'b2', lotes: [{ id: 'b1', costo: 900, tamano: 100 }, { id: 'b2', costo: 950, tamano: 100 }] };
  const porId = new Map([[valentino.id, valentino]]);
  const item = { perfumeId: 'val', perfumeNombre: 'Born in Roma Intense', talla: '5', cantidad: 3, vendidos: 0, probadores: 1, precio: 150, loteId: 'b2' };
  const barber = { id: 'pt', lugar: 'Barber', estado: 'Abierto', items: [item] };
  const ventas = [{ perfumeId: 'val', talla: 'Resto', cantidad: 1, precio: 900, loteId: 'b2' }];

  test('editar sin cambios no pide ml aunque la botella ya esté vendida', () => {
    const [r] = revisarDisponibilidad([item], porId, ventas, [], piezasFueraDeBotella([barber]));
    expect(r).toMatchObject({ ml: 20, ya: 20, extra: 0, alcanza: true });
  });
  test('quitar 2 del punto: salen 10 ml que ya estaban servidos', () => {
    const [r] = revisarDisponibilidad([{ ...item, cantidad: 1 }], porId, ventas, [], piezasFueraDeBotella([barber]));
    expect(r).toMatchObject({ ml: 10, extra: 0, devuelve: 10, alcanza: true });
  });
  test('agregar uno más sí se revisa contra la botella (ya no queda)', () => {
    const [r] = revisarDisponibilidad([{ ...item, cantidad: 4 }], porId, ventas, [], piezasFueraDeBotella([barber]));
    expect(r).toMatchObject({ extra: 5, restante: 0, alcanza: false });
  });
  test('retirar no baja de lo vendido', () => {
    expect(retirarDelPunto(item, 2).cantidad).toBe(1);
    expect(retirarDelPunto({ ...item, vendidos: 2 }, 3).cantidad).toBe(2);
    expect(piezasRetirables({ ...item, vendidos: 1 })).toBe(2);
  });
  test('"los vendí yo": un decant de 10 ml de la misma botella, sin comisión', () => {
    const v = ventaDeRetiro({ item, piezas: 2, precio: 280, cliente: 'Juan', lugar: 'Barber', ahora: 5 });
    expect(v).toMatchObject({ talla: '10', cantidad: 1, precio: 280, loteId: 'b2', perfumeId: 'val', cliente: 'Juan', creadoEn: 5 });
    expect(v.comision).toBeUndefined();
  });
  test('los ml no se duplican: lo que sale del punto entra a la venta', () => {
    const antes = consumoDePerfume({ ...valentino, loteActivo: 'b2' }, [], piezasFueraDeBotella([barber]));
    const despuesPunto = { ...barber, items: [retirarDelPunto(item, 2)] };
    const venta = ventaDeRetiro({ item, piezas: 2, precio: 280 });
    const despues = consumoDePerfume({ ...valentino, loteActivo: 'b2' }, [venta], piezasFueraDeBotella([despuesPunto]));
    expect(despues.usado).toBe(antes.usado);
  });
});
