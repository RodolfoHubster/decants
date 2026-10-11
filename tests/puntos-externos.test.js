import {
  botellaAsignada, piezasFueraDeBotella, filtrarPerfumes, ventasDelPunto, resumenPunto, revisarDisponibilidad, costoProbadores,
} from '../assets/js/puntos-externos.js';
import { contextoRentabilidad } from '../assets/js/rentabilidad.js';

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
