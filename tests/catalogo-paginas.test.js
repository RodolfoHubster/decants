import { readdirSync } from 'fs';
import {
  armarCatalogo, ordenarPorMarca, motivoFuera, notasCortas, tarjeta, rangoMarcas, nombreArchivo,
  tallasDelCatalogo, edicion, masBuscados, archivoLogo, LOGOS_MARCAS, POR_PAGINA, DATOS_CURIOSOS,
} from '../assets/js/catalogo-paginas.js';

let n = 0;
const perfume = (marca, nombre, genero, extra = {}) => ({
  id: `p${++n}`, marca, nombre, genero, activo: true, precios: { 3: 60, 5: 90, 10: 150 }, creadoEn: 1000, ...extra,
});

describe('quién entra', () => {
  test('fuera: inactivos, archivados, agotados, sin precio y sin género', () => {
    expect(motivoFuera(perfume('A', 'a', 'Dama'))).toBe('');
    expect(motivoFuera(perfume('A', 'a', 'Dama', { activo: false }))).toBe('inactivo');
    expect(motivoFuera(perfume('A', 'a', 'Dama', { archivado: true }))).toBe('inactivo');
    expect(motivoFuera(perfume('A', 'a', 'Dama', { estadoStock: 'agotado' }))).toBe('agotado');
    expect(motivoFuera(perfume('A', 'a', 'Dama', { estadoStock: 'por_acabarse' }))).toBe('');
    expect(motivoFuera(perfume('A', 'a', 'Dama', { precios: { 5: '' } }))).toBe('sinPrecio');
    expect(motivoFuera(perfume('A', 'a', 'Otro'))).toBe('sinGenero');
  });
  test('si el 2 ml está apagado y es el único precio, no entra', () => {
    expect(motivoFuera(perfume('A', 'a', 'Dama', { precios: { 2: 40 } }), { disable2ml: true })).toBe('sinPrecio');
  });
});

describe('orden y tarjetas', () => {
  test('por marca A→Z sin importar acentos ni mayúsculas, luego por nombre', () => {
    const l = [perfume('lattafa', 'Khamrah', 'Dama'), perfume('Ármaf', 'Club', 'Dama'), perfume('Armaf', 'Odyssey', 'Dama'), perfume('Afnan', '9PM', 'Dama')];
    expect(ordenarPorMarca(l).map(p => p.nombre)).toEqual(['9PM', 'Club', 'Odyssey', 'Khamrah']);
  });
  test('notas: una de cada nivel por turnos', () => {
    const d = 'Frase.\n\nSalida: a1, a2\nCorazón: b1, b2\nFondo: c1, c2, c3';
    expect(notasCortas(d)).toEqual(['a1', 'b1', 'c1', 'a2']);
    expect(notasCortas('Notas: rosa, oud, ámbar', 2)).toEqual(['rosa', 'oud']);
    expect(notasCortas('Un párrafo libre.')).toEqual([]);
  });
  test('la tarjeta trae precios con ahorro, PRO, original y link', () => {
    const t = tarjeta(perfume('Afnan', '9PM Elixir', 'Caballero', { inspiradoEn: { nombre: 'Le Male', marca: 'JPG' } }), { proExtra: 15 });
    expect(t).toMatchObject({ marca: 'Afnan', nombre: '9PM Elixir', inspirado: 'Le Male de JPG', pro: true, seccion: 'hombre' });
    expect(t.tallas.map(x => `${x.ml}:${x.precio}:${x.ahorro}`)).toEqual(['3:60:0', '5:90:0', '10:150:30']);
    expect(t.link).toMatch(/afnan-9pm-elixir$/);
  });
});

describe('armarCatalogo completo', () => {
  const lista = [
    ...Array.from({ length: 7 }, (_, i) => perfume(i < 4 ? 'Afnan' : 'Zara', `M${i}`, 'Dama')),
    ...Array.from({ length: 6 }, (_, i) => perfume('Armaf', `H${i}`, 'Caballero')),
    perfume('Lattafa', 'Agotado', 'Caballero', { estadoStock: 'agotado' }),
    perfume('Rasasi', 'Sin precio', 'Unisex', { precios: {} }),
  ];
  const c = armarCatalogo(lista, { fecha: Date.UTC(2026, 10, 10) });
  const tipos = c.paginas.map(p => (p.tipo === 'perfumes' ? `perfumes:${p.items.length}` : p.tipo));

  test('portada, cómo pedir, índice, secciones con sus hojas, consejos y contraportada', () => {
    expect(tipos).toEqual(['portada', 'bienvenida', 'indice', 'casas', 'seccion', 'perfumes:6', 'perfumes:1', 'seccion', 'perfumes:6', 'consejos', 'contraportada']);
    expect(c.paginas.map(p => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  test('sin secciones vacías; cuenta lo que quedó fuera', () => {
    expect(c.conteo).toEqual({ mujer: 7, hombre: 6, unisex: 0, total: 13 });
    expect(c.fuera).toEqual({ agotado: 1, sinPrecio: 1, sinGenero: 0 });
    expect(c.indice.map(e => e.seccion.id)).toEqual(['mujer', 'hombre']);
  });
  test('el índice lleva la hoja de cada sección y de cada marca', () => {
    expect(c.indice[0]).toMatchObject({ pagina: 5, total: 7 });
    expect(c.indice[0].marcas).toEqual([{ marca: 'Afnan', pagina: 6, cuantos: 4 }, { marca: 'Zara', pagina: 6, cuantos: 3 }]);
    expect(c.indice[1].marcas).toEqual([{ marca: 'Armaf', pagina: 9, cuantos: 6 }]);
  });
  test('"Nuestras casas": cada marca una vez, A→Z, con su primera hoja', () => {
    expect(c.paginas[3].marcas).toEqual([{ marca: 'Afnan', pagina: 6 }, { marca: 'Armaf', pagina: 9 }, { marca: 'Zara', pagina: 6 }]);
  });
  test('los huecos de la última hoja de una sección se llenan con datos curiosos sin repetir', () => {
    const ultima = c.paginas[6];
    expect(ultima.relleno).toHaveLength(POR_PAGINA - 1);
    const usados = [c.paginas[4].dato, c.paginas[7].dato, ...ultima.relleno].map(d => d.titulo);
    expect(new Set(usados).size).toBe(usados.length);
    expect(usados).not.toContain(DATOS_CURIOSOS[0].titulo);   // ese va en "cómo pedir"
    expect(c.paginas[1].dato).toBe(DATOS_CURIOSOS[0]);
  });
  test('cuando se acaban los datos curiosos, una invitación a escribir', () => {
    const muchas = Array.from({ length: 2 }, (_, s) => Array.from({ length: 7 }, (_, i) => perfume(`M${s}`, `x${i}`, ['Dama', 'Caballero'][s]))).flat();
    const unisex = [perfume('U', 'u', 'Unisex')];
    const r = armarCatalogo([...muchas, ...unisex]).paginas.filter(p => p.tipo === 'perfumes').map(p => p.relleno);
    // A lo más una por hoja, siempre al final de los datos curiosos.
    for (const hoja of r) {
      expect(hoja.filter(d => d.invitacion).length).toBeLessThanOrEqual(1);
      if (hoja.some(d => d.invitacion)) expect(hoja[hoja.length - 1].invitacion).toBe(true);
    }
    expect(r.flat().some(d => d.invitacion)).toBe(true);
  });
  test('la tarjeta lleva duración y estela, y la frase', () => {
    const t = tarjeta(perfume('A', 'a', 'Dama', { descripcion: 'Dulce y cálido.\n\nSalida: pera\n\nDuración: Alta (más de 8 h) · Estela: fuerte\nIdeal para: Noche · Clima frío' }));
    expect(t.rasgos).toEqual(['Duración alta', 'Estela fuerte']);
    expect(t.frase).toBe('Dulce y cálido.');
  });
  test('tallas que se venden', () => {
    expect(c.tallas).toBe('3, 5 y 10 ml');
    expect(tallasDelCatalogo([])).toBe('');
  });
});

describe('hojas de novedades', () => {
  test('solo lo creado desde la fecha, con portadilla y sin índice', () => {
    const lista = [perfume('A', 'viejo', 'Dama', { creadoEn: 10 }), perfume('B', 'nuevo', 'Caballero', { creadoEn: 500 }), perfume('C', 'nueva', 'Dama', { creadoEn: 600 })];
    const c = armarCatalogo(lista, { tipo: 'novedades', desde: 100 });
    expect(c.paginas.map(p => p.tipo)).toEqual(['novedades', 'perfumes']);
    expect(c.paginas[0]).toMatchObject({ total: 2, desde: 100 });
    expect(c.paginas[1].items.map(i => i.nombre)).toEqual(['nueva', 'nuevo']);   // primero Mujer, luego Hombre
    expect(c.paginas[1].conGenero).toBe(true);
    expect(c.indice).toEqual([]);
  });
});

describe('masBuscados', () => {
  test('recomendados primero, luego por visitas; solo con foto', () => {
    const t = [
      { nombre: 'a', clicks: 50, destacado: false, imagen: 'x' },
      { nombre: 'b', clicks: 5, destacado: true, imagen: 'x' },
      { nombre: 'c', clicks: 90, destacado: false, imagen: '' },
      { nombre: 'd', clicks: 20, destacado: false, imagen: 'x' },
      { nombre: 'e', clicks: 10, destacado: false, imagen: 'x' },
    ];
    expect(masBuscados(t).map(x => x.nombre)).toEqual(['b', 'a', 'd']);
  });
  test('la portada y cada portadilla llevan los suyos', () => {
    const c = armarCatalogo([
      perfume('A', 'uno', 'Dama', { clicks: 3, imagen: 'u' }),
      perfume('B', 'dos', 'Caballero', { clicks: 9, imagen: 'u' }),
    ]);
    expect(c.paginas[0].destacados.map(x => x.nombre)).toEqual(['dos', 'uno']);
    expect(c.paginas.find(p => p.tipo === 'seccion').destacados.map(x => x.nombre)).toEqual(['uno']);
  });
});

describe('logos de las marcas', () => {
  test('por slug de la marca; sin logo, null', () => {
    expect(archivoLogo('Dolce & Gabbana')).toBe('dolce-gabbana.png');
    expect(archivoLogo('Lancôme')).toBe('lancome.png');
    expect(archivoLogo('Paco Rabanne')).toBe('paco-rabanne.png');
    expect(archivoLogo('Bharara')).toBeNull();
    expect(archivoLogo('')).toBeNull();
  });
  test('la lista coincide con los archivos de assets/img/marcas', () => {
    const archivos = readdirSync(new URL('../assets/img/marcas/', import.meta.url)).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));
    expect([...LOGOS_MARCAS].sort()).toEqual(archivos.sort());
  });
});

describe('textos', () => {
  test('rango de marcas de una hoja', () => {
    expect(rangoMarcas([{ marca: 'Afnan' }, { marca: 'Armaf' }])).toBe('Afnan – Armaf');
    expect(rangoMarcas([{ marca: 'Afnan' }, { marca: 'Afnan' }])).toBe('Afnan');
    expect(rangoMarcas([])).toBe('');
  });
  test('nombre del archivo y edición', () => {
    const f = new Date(2026, 10, 10).getTime();
    expect(nombreArchivo({ fecha: f })).toBe('fitoscents-catalogo-2026-11-10.pdf');
    expect(nombreArchivo({ tipo: 'novedades', modo: 'imprenta', fecha: f })).toBe('fitoscents-novedades-2026-11-10-imprenta.pdf');
    expect(edicion(f)).toBe('Noviembre 2026');
  });
});
