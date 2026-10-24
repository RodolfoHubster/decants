import {
  generoNormal, piezasVendidas, filtrarPiezas, resumenPorGenero, rankingPerfumes,
  tallasPorGenero, porDiaSemana, periodoAnterior, cambioPct,
} from '../assets/js/estadisticas-ventas.js';

const perfumes = [
  { id: 'sau', nombre: 'Sauvage', marca: 'Dior', genero: 'Caballero' },
  { id: 'sca', nombre: 'Scarlet', marca: 'Bharara', genero: 'Dama' },
  { id: 'aqu', nombre: 'Odyssey Aqua', marca: 'Armaf', genero: 'Caballero' },
  { id: 'uni', nombre: 'Erba Pura', marca: 'Xerjoff', genero: 'Unisex' },
];
const completos = [{ id: 'c1', nombre: 'Aventus', marca: 'Creed', genero: 'Caballero' }];
// Un lunes y un sábado de octubre de 2026 (hora local)
const LUN = new Date(2026, 9, 19, 12).getTime();
const SAB = new Date(2026, 9, 24, 12).getTime();

const ventas = [
  { perfumeId: 'sau', perfumeNombre: 'Sauvage', talla: '5', precio: 180, cantidad: 2, creadoEn: LUN },
  { perfumeId: 'sca', perfumeNombre: 'Scarlet', talla: '10', precio: 150, cantidad: 1, creadoEn: SAB },
  { perfumeId: 'pq', perfumeNombre: 'Combo', talla: 'Paquete 3', precio: 270, cantidad: 1, creadoEn: SAB,
    paqueteItems: [{ id: 'sau', nombre: 'Sauvage' }, { id: 'aqu', nombre: 'Odyssey Aqua' }, { id: 'uni', nombre: 'Erba Pura' }] },
  { perfumeId: 'sau', perfumeNombre: 'Sauvage', talla: 'Completo', precio: 2800, cantidad: 1, creadoEn: SAB },
  { perfumeId: 'sau', perfumeNombre: 'Sauvage', talla: 'Resto', precio: 500, cantidad: 1, creadoEn: SAB },
  { perfumeId: 'sau', perfumeNombre: 'Sauvage', talla: '5', precio: 180, cantidad: 1, creadoEn: SAB, estado: 'cancelada' },
];
const encargos = [
  { perfume: 'Aventus', marca: 'Creed', precio: 6500, estado: 'entregado', creadoEn: { seconds: SAB / 1000 } },
  { perfume: 'Aventus', marca: 'Creed', precio: 6500, estado: 'pendiente', creadoEn: { seconds: SAB / 1000 } },
];
const piezas = piezasVendidas(ventas, { perfumes, completos, encargos });

describe('generoNormal', () => {
  test('acepta hombre/mujer y variantes', () => {
    expect(generoNormal('Hombre')).toBe('Caballero');
    expect(generoNormal('mujer')).toBe('Dama');
    expect(generoNormal('Unisex')).toBe('Unisex');
    expect(generoNormal('')).toBe('Sin género');
  });
});

describe('piezasVendidas', () => {
  test('un combo de 3 son 3 piezas, cada una con su perfume y género', () => {
    const combo = piezas.filter(x => x.tipo === 'decant' && x.ml === 3);
    expect(combo.map(x => x.genero).sort()).toEqual(['Caballero', 'Caballero', 'Unisex']);
    expect(combo.reduce((s, x) => s + x.importe, 0)).toBeCloseTo(270);
  });
  test('completos de ventas y de encargos entregados; resto y canceladas no cuentan', () => {
    const comp = piezas.filter(x => x.tipo === 'completo');
    expect(comp.map(x => x.nombre).sort()).toEqual(['Aventus', 'Sauvage']);
    expect(comp.find(x => x.nombre === 'Aventus').genero).toBe('Caballero');
    expect(piezas.some(x => x.importe === 500)).toBe(false);
    expect(piezas.filter(x => x.tipo === 'decant').reduce((s, x) => s + x.piezas, 0)).toBe(2 + 1 + 3);
  });
});

describe('resumen, ranking y tallas', () => {
  const decants = filtrarPiezas(piezas, { tipo: 'decant' });
  test('resumen por género de los decants', () => {
    const r = resumenPorGenero(decants);
    expect(r.Caballero).toMatchObject({ piezas: 4, ml: 16, perfumes: 2 });   // Sauvage 2×5 + 3, Aqua 3
    expect(r.Dama).toMatchObject({ piezas: 1, ml: 10, importe: 150, perfumes: 1 });
    expect(r.total.piezas).toBe(6);
  });
  test('el ranking junta por perfume y ordena por piezas', () => {
    const r = rankingPerfumes(decants);
    expect(r[0]).toMatchObject({ nombre: 'Sauvage', piezas: 3, ml: 13 });
    expect(r).toHaveLength(4);
  });
  test('filtrar por género', () => {
    expect(rankingPerfumes(filtrarPiezas(piezas, { tipo: 'decant', genero: 'Dama' })).map(x => x.nombre)).toEqual(['Scarlet']);
  });
  test('tallas por género', () => {
    const t = tallasPorGenero(piezas);
    expect(t.Caballero).toMatchObject({ 3: 2, 5: 2 });
    expect(t.Dama[10]).toBe(1);
  });
});

describe('días y periodos', () => {
  test('por día de la semana, empezando en lunes', () => {
    const d = porDiaSemana(filtrarPiezas(piezas, { tipo: 'decant' }));
    expect(d[0]).toMatchObject({ dia: 'Lunes', piezas: 2 });
    expect(d[5]).toMatchObject({ dia: 'Sábado', piezas: 4 });
  });
  test('periodo anterior del mismo largo y cambio en %', () => {
    expect(periodoAnterior(100, 160)).toEqual({ desde: 40, hasta: 100 });
    expect(periodoAnterior(0, 160)).toBeNull();
    expect(cambioPct(150, 100)).toBe(50);
    expect(cambioPct(5, 0)).toBeNull();
  });
});
