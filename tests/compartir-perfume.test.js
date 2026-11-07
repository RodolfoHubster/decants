import {
  linkPerfume, textoInspirado, unirConY, preciosDe, textoPrecios, datosTarjeta, partirLineas, sinInspiradoAlInicio, SITIO,
} from '../assets/js/compartir-perfume.js';

const nueve = {
  id: 'n1', nombre: '9PM Elixir', marca: 'Afnan', imagen: 'https://res.cloudinary.com/x.jpg',
  precios: { 5: 90, 10: 150, 3: 65, 2: 0 },
  inspiradoEn: { nombre: 'Le Male Elixir Absolu', marca: 'Jean Paul Gaultier' },
  descripcion: 'La versión más especiada y oscura de 9PM.\nPotente y elegante.\n\n'
    + 'Salida: cardamomo, nuez moscada, elemí\nCorazón: pimentón, cuero, lavanda\nFondo: vainilla, pachulí\n\n'
    + 'Duración: Alta (más de 8 h) · Estela: fuerte\nIdeal para: Noche · Clima frío',
};

describe('linkPerfume', () => {
  test('sin vista previa: la página del producto', () => {
    expect(linkPerfume(nueve, null)).toBe(`${SITIO}producto.html?p=afnan-9pm-elixir`);
  });
  test('con vista previa: la dirección corta', () => {
    expect(linkPerfume(nueve, 'https://ver.fitoscents.com/')).toBe('https://ver.fitoscents.com/afnan-9pm-elixir');
  });
});

describe('textoInspirado y unirConY', () => {
  test('nombre y marca del original', () => {
    expect(textoInspirado(nueve)).toBe('Le Male Elixir Absolu de Jean Paul Gaultier');
    expect(textoInspirado({ inspiradoEn: { nombre: 'Aventus' } })).toBe('Aventus');
    expect(textoInspirado({ inspiradoEn: { nombre: '  ' } })).toBe('');
    expect(textoInspirado({})).toBe('');
  });
  test('lista en español', () => {
    expect(unirConY(['5', '10'])).toBe('5 y 10');
    expect(unirConY(['3', '5', '10'])).toBe('3, 5 y 10');
    expect(unirConY(['5'])).toBe('5');
    expect(unirConY([])).toBe('');
  });
});

describe('preciosDe', () => {
  test('de chico a grande, sin las tallas vacías, con el ahorro y el PRO', () => {
    expect(preciosDe(nueve, { proExtra: 15 })).toEqual({
      tallas: [{ ml: '3', precio: 65, ahorro: 0 }, { ml: '5', precio: 90, ahorro: 0 }, { ml: '10', precio: 150, ahorro: 30 }],
      pro: { tallas: ['5', '10'], extra: 15 },
    });
  });
  test('el 2 ml apagado en la tienda no sale (y no cuenta para el ahorro)', () => {
    const p = { ...nueve, precios: { 2: 40, 5: 90, 10: 150 } };
    expect(preciosDe(p).tallas.map(t => `${t.ml}:${t.ahorro}`)).toEqual(['2:0', '5:0', '10:50']);
    expect(preciosDe(p, { disable2ml: true }).tallas.map(t => `${t.ml}:${t.ahorro}`)).toEqual(['5:0', '10:30']);
  });
  test('paquetes y accesorios: sus precios tal cual, sin PRO', () => {
    const paq = { nombre: 'Noche', tipo: 'paquete', precios: { 5: 250, 3: 180 } };
    expect(preciosDe(paq, { proExtra: 15 })).toEqual({
      tallas: [{ ml: '3', precio: 180, ahorro: 0 }, { ml: '5', precio: 250, ahorro: 0 }], pro: null,
    });
  });
});

describe('textoPrecios', () => {
  test('directo: nombre, original, precios, PRO y link', () => {
    expect(textoPrecios(nueve, { proExtra: 15, link: 'https://fitoscents.com/x' })).toBe([
      '9PM Elixir · Afnan',
      'Inspirado en Le Male Elixir Absolu de Jean Paul Gaultier',
      '',
      '3 ml · $65',
      '5 ml · $90',
      '10 ml · $150 (ahorras $30)',
      'PRO, envase reforzado: +$15 en 5 y 10 ml',
      '',
      'https://fitoscents.com/x',
    ].join('\n'));
  });
  test('sin asteriscos ni lema al final; sin dupe ni PRO no deja renglones vacíos de más', () => {
    const p = { nombre: 'Khamrah', marca: 'Lattafa', precios: { 5: 80 } };
    const t = textoPrecios(p, { link: null });
    expect(t).toBe('Khamrah · Lattafa\n\n5 ml · $80');
    expect(t).not.toMatch(/\*/);
  });
  test('por defecto lleva el link del perfume', () => {
    expect(textoPrecios(nueve).endsWith('\n\nhttps://ver.fitoscents.com/afnan-9pm-elixir')).toBe(true);
  });
  test('paquetes: "Paquete 5 ml"', () => {
    expect(textoPrecios({ nombre: 'Fresh For Less', esPaquete: true, precios: { 10: 329, 5: 190 } }, { link: null }))
      .toBe('Fresh For Less\n\nPaquete 5 ml · $190\nPaquete 10 ml · $329');
  });
  test('sin precios no hay texto', () => {
    expect(textoPrecios({ nombre: 'X', precios: { 5: '' } })).toBe('');
  });
});

describe('datosTarjeta', () => {
  test('pirámide, rasgos, frase y precios de la ficha', () => {
    const d = datosTarjeta(nueve, { proExtra: 15 });
    expect(d.piramide).toEqual([
      { etiqueta: 'Salida', notas: 'cardamomo, nuez moscada, elemí' },
      { etiqueta: 'Corazón', notas: 'pimentón, cuero, lavanda' },
      { etiqueta: 'Fondo', notas: 'vainilla, pachulí' },
    ]);
    expect(d.rasgos).toEqual(['Duración alta', 'Estela fuerte', 'Noche', 'Clima frío']);
    expect(d.frase).toBe('La versión más especiada y oscura de 9PM. Potente y elegante.');
    expect(d.inspirado).toBe('Le Male Elixir Absolu de Jean Paul Gaultier');
    expect(d.tallas).toHaveLength(3);
    expect(d.pro).toEqual({ tallas: ['5', '10'], extra: 15 });
    expect(d.archivo).toBe('fitoscents-afnan-9pm-elixir.jpg');
    expect(d.sitio).toBe('fitoscents.com');
  });
  test('una sola línea de notas y descripción libre', () => {
    expect(datosTarjeta({ nombre: 'A', descripcion: 'Rico.\n\nNotas: rosa, oud' }).piramide)
      .toEqual([{ etiqueta: 'Notas', notas: 'rosa, oud' }]);
    const libre = datosTarjeta({ nombre: 'B', descripcion: 'Un  perfume\nfresco para el día.' });
    expect(libre.piramide).toEqual([]);
    expect(libre.rasgos).toEqual([]);
    expect(libre.frase).toBe('Un perfume fresco para el día.');
  });
});

describe('partirLineas', () => {
  const medir = s => s.length;
  test('reparte palabras sin pasarse del ancho', () => {
    expect(partirLineas('uno dos tres cuatro', medir, 8)).toEqual(['uno dos', 'tres', 'cuatro']);
  });
  test('si no cabe, el último renglón termina en …', () => {
    expect(partirLineas('uno dos tres cuatro cinco', medir, 9, 2)).toEqual(['uno dos', 'tres…']);
    expect(partirLineas('cardamomo, nuez moscada, elemí', medir, 20, 1)).toEqual(['cardamomo, nuez…']);
  });
  test('vacío, cero renglones y una palabra larguísima', () => {
    expect(partirLineas('', medir, 10)).toEqual([]);
    expect(partirLineas('a b', medir, 10, 0)).toEqual([]);
    expect(partirLineas('supercalifragilístico', medir, 6, 1)).toEqual(['super…']);
  });
});

describe('sinInspiradoAlInicio', () => {
  test('quita el "Inspirado en …:" del principio (en la imagen ya va arriba)', () => {
    expect(sinInspiradoAlInicio('Inspirado en Scandal Pour Homme de JPG: mandarina y caramelo.')).toBe('Mandarina y caramelo.');
    expect(sinInspiradoAlInicio('Dulce y cálido.')).toBe('Dulce y cálido.');
    expect(sinInspiradoAlInicio('Inspirado en Aventus:')).toBe('Inspirado en Aventus:');
  });
  test('datosTarjeta solo lo quita si el perfume trae su original', () => {
    const p = { nombre: 'O', descripcion: 'Inspirado en Scandal: dulce.\n\nSalida: mandarina' };
    expect(datosTarjeta(p).frase).toBe('Inspirado en Scandal: dulce.');
    expect(datosTarjeta({ ...p, inspiradoEn: { nombre: 'Scandal' } }).frase).toBe('Dulce.');
  });
});
