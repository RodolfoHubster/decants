/**
 * Pruebas del módulo real assets/js/hero.js
 */

import { heroStats, pickShowcase, construirColecciones, barajar } from '../assets/js/hero.js';

const catalogo = [
  { id: 'p1', nombre: 'Rome Pour Homme',     marca: 'Bharara', imagen: 'u1', precios: { '2': 40, '5': 80 } },
  { id: 'p2', nombre: 'Rome Extradose Femme', marca: 'Bharara', imagen: 'u2', precios: { '5': 90 } },
  { id: 'p3', nombre: 'Odyssey Mandarin',     marca: 'Armaf',   imagen: 'u3', precios: { '10': 150 } },
  { id: 'p4', nombre: 'Le Beau',              marca: 'JPG',     imagen: 'u4', precios: { '5': 120 } },
];

describe('heroStats', () => {
  test('cuenta productos, marcas únicas y el precio mínimo', () => {
    expect(heroStats(catalogo)).toEqual({ perfumes: 4, marcas: 3, desde: 40 });
  });

  test('excluye accesorios y paquetes: la etiqueta dice "Perfumes"', () => {
    const mezcla = [
      ...catalogo,
      { id: 'a1', nombre: 'Atomizador', tipo: 'accesorio', marca: 'Accesorios', precios: { '1': 15 } },
      { id: 'q1', nombre: 'Combo 3x', tipo: 'paquete', marca: 'Combos', precios: { '5': 20 } },
    ];
    const stats = heroStats(mezcla);
    expect(stats.perfumes).toBe(4);
    expect(stats.marcas).toBe(3);
    expect(stats.desde).toBe(40);
  });

  test('catálogo vacío no rompe ni inventa precios', () => {
    expect(heroStats([])).toEqual({ perfumes: 0, marcas: 0, desde: 0 });
    expect(heroStats(undefined)).toEqual({ perfumes: 0, marcas: 0, desde: 0 });
  });

  test('ignora precios en cero o inválidos al calcular "desde"', () => {
    const raros = [{ nombre: 'X', marca: 'M', precios: { '2': 0, '5': null, '10': 70 } }];
    expect(heroStats(raros).desde).toBe(70);
  });
});

describe('pickShowcase', () => {
  test('devuelve la cantidad pedida', () => {
    expect(pickShowcase(catalogo, 3)).toHaveLength(3);
  });

  test('omite productos sin imagen', () => {
    const conSinImagen = [{ id: 'x', nombre: 'Sin foto', marca: 'M' }, ...catalogo];
    const picks = pickShowcase(conSinImagen, 3);
    expect(picks.every(p => p.imagen)).toBe(true);
    expect(picks.map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('omite agotados, accesorios y paquetes', () => {
    const mezcla = [
      { id: 'ag', nombre: 'Agotado', imagen: 'u', estadoStock: 'agotado' },
      { id: 'ac', nombre: 'Accesorio', imagen: 'u', tipo: 'accesorio' },
      { id: 'pq', nombre: 'Combo', imagen: 'u', tipo: 'paquete' },
      ...catalogo,
    ];
    expect(pickShowcase(mezcla, 3).map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('si no alcanzan los productos devuelve los que haya, sin huecos', () => {
    const picks = pickShowcase([catalogo[0]], 3);
    expect(picks).toHaveLength(1);
    expect(picks[0].id).toBe('p1');
  });

  test('catálogo vacío devuelve arreglo vacío', () => {
    expect(pickShowcase([], 3)).toEqual([]);
    expect(pickShowcase(undefined, 3)).toEqual([]);
  });
});

describe('construirColecciones', () => {
  // 3 de cada tipo, que es el mínimo para que una colección se muestre.
  const mk = (id, extra) => ({ id, nombre: id, marca: 'M', imagen: 'u', ...extra });
  const catalogoAmplio = [
    mk('h1', { genero: 'Caballero', clicks: 90, creadoEn: 100 }),
    mk('h2', { genero: 'Caballero', clicks: 80, creadoEn: 200 }),
    mk('h3', { genero: 'Caballero', clicks: 70, creadoEn: 300 }),
    mk('d1', { genero: 'Dama', clicks: 60, creadoEn: 400 }),
    mk('d2', { genero: 'Dama', clicks: 50, creadoEn: 500 }),
    mk('d3', { genero: 'Dama', clicks: 40, creadoEn: 600 }),
    mk('n1', { genero: 'Unisex', novedad: true, novedadActivadaEn: 900, creadoEn: 900 }),
    mk('n2', { genero: 'Unisex', novedad: true, novedadActivadaEn: 800, creadoEn: 800 }),
    mk('n3', { genero: 'Unisex', novedad: true, novedadActivadaEn: 700, creadoEn: 700 })
  ];

  test('arma las cinco colecciones cuando hay material', () => {
    const cols = construirColecciones(catalogoAmplio, 3);
    expect(cols.map(c => c.id).sort())
      .toEqual(['caballero', 'clasicos', 'dama', 'novedades', 'vendidos']);
  });

  test('cada colección trae exactamente los que se piden', () => {
    construirColecciones(catalogoAmplio, 3).forEach(c => expect(c.items).toHaveLength(3));
  });

  test('los más vendidos van por clicks, de mayor a menor', () => {
    const col = construirColecciones(catalogoAmplio, 3).find(c => c.id === 'vendidos');
    expect(col.items.map(p => p.id)).toEqual(['h1', 'h2', 'h3']);
  });

  test('novedades trae solo lo marcado como novedad, lo más reciente primero', () => {
    const col = construirColecciones(catalogoAmplio, 3).find(c => c.id === 'novedades');
    expect(col.items.map(p => p.id)).toEqual(['n1', 'n2', 'n3']);
  });

  test('clásicos son los más antiguos y excluyen las novedades', () => {
    const col = construirColecciones(catalogoAmplio, 3).find(c => c.id === 'clasicos');
    expect(col.items.map(p => p.id)).toEqual(['h1', 'h2', 'h3']);
    expect(col.items.some(p => p.novedad)).toBe(false);
  });

  test('descarta la colección que no llega al mínimo: mejor ninguna que a medias', () => {
    const pocos = [mk('d1', { genero: 'Dama' }), mk('d2', { genero: 'Dama' })];
    const cols = construirColecciones(pocos, 3);
    expect(cols.find(c => c.id === 'dama')).toBeUndefined();
  });

  test('nunca muestra agotados ni productos sin imagen', () => {
    const sucio = [
      mk('ok1', { genero: 'Dama' }), mk('ok2', { genero: 'Dama' }), mk('ok3', { genero: 'Dama' }),
      { id: 'x1', genero: 'Dama', imagen: 'u', estadoStock: 'agotado' },
      { id: 'x2', genero: 'Dama' }
    ];
    const col = construirColecciones(sucio, 3).find(c => c.id === 'dama');
    expect(col.items.map(p => p.id)).toEqual(['ok1', 'ok2', 'ok3']);
  });

  test('excluye paquetes y accesorios del escaparate', () => {
    const mezcla = [
      ...catalogoAmplio,
      { id: 'paq', tipo: 'paquete', imagen: 'u', clicks: 9999 },
      { id: 'acc', tipo: 'accesorio', imagen: 'u', clicks: 9999 }
    ];
    const col = construirColecciones(mezcla, 3).find(c => c.id === 'vendidos');
    expect(col.items.map(p => p.id)).not.toContain('paq');
    expect(col.items.map(p => p.id)).not.toContain('acc');
  });

  test('catálogo vacío no produce colecciones', () => {
    expect(construirColecciones([], 3)).toEqual([]);
    expect(construirColecciones(undefined, 3)).toEqual([]);
  });
});

describe('barajar', () => {
  test('conserva todos los elementos', () => {
    const orig = ['a', 'b', 'c', 'd', 'e'];
    expect(barajar(orig, () => 0.5).sort()).toEqual([...orig].sort());
  });

  test('no modifica el arreglo original', () => {
    const orig = ['a', 'b', 'c'];
    barajar(orig, () => 0.99);
    expect(orig).toEqual(['a', 'b', 'c']);
  });

  test('con generador fijo el resultado es reproducible', () => {
    const rnd = () => 0.42;
    expect(barajar(['a', 'b', 'c', 'd'], rnd)).toEqual(barajar(['a', 'b', 'c', 'd'], rnd));
  });

  test('tolera vacío', () => {
    expect(barajar([])).toEqual([]);
    expect(barajar(undefined)).toEqual([]);
  });
});
