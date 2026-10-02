import { parsearFicha, nivel } from '../assets/js/ficha.js';

const BLEU = `Elegancia versátil: cítrico al abrir y amaderado al secar.

Salida: toronja, limón, menta, pimienta rosa
Corazón: jengibre, nuez moscada, jazmín
Fondo: incienso, cedro, sándalo, ámbar

Duración: Alta (más de 8 h) · Estela: moderada
Ideal para: Día y noche · Todo el año`;

describe('parsearFicha', () => {
  test('lee frase, pirámide, medidores y uso', () => {
    const f = parsearFicha(BLEU);
    expect(f.estructurada).toBe(true);
    expect(f.frase).toBe('Elegancia versátil: cítrico al abrir y amaderado al secar.');
    expect(f.salida).toEqual(['toronja', 'limón', 'menta', 'pimienta rosa']);
    expect(f.corazon).toHaveLength(3);
    expect(f.fondo).toContain('sándalo');
    expect(f).toMatchObject({ duracion: 'Alta (más de 8 h)', duracionNivel: 3, estela: 'moderada', estelaNivel: 2 });
    expect(f.momento).toEqual(['Día', 'Noche']);
    expect(f.clima).toBe('Todo el año');
  });

  test('acepta la versión sin acentos que generaba la IA antes', () => {
    const f = parsearFicha('Frase.\n\nSalida: a\nCorazon: b\nFondo: c\n\nDuracion: Baja (2-4 h) · Estela: discreta\nIdeal para: Noche · Clima frio');
    expect(f.corazon).toEqual(['b']);
    expect(f.duracionNivel).toBe(1);
    expect(f.estelaNivel).toBe(1);
    expect(f.momento).toEqual(['Noche']);
  });

  test('lista plana de notas', () => {
    const f = parsearFicha('Aromático.\n\nNotas: cardamomo, iris, lavanda\n\nDuración: Alta (más de 8 h) · Estela: moderada');
    expect(f.estructurada).toBe(true);
    expect(f.notas).toEqual(['cardamomo', 'iris', 'lavanda']);
    expect(f.salida).toEqual([]);
  });

  test('un párrafo libre no se toma como estructurado', () => {
    const f = parsearFicha('Vainilla intensa, ámbar y especias. Un golpe dulce para la noche.');
    expect(f.estructurada).toBe(false);
    expect(f.frase).toContain('Vainilla intensa');
  });

  test('vacío o nulo', () => {
    expect(parsearFicha('').estructurada).toBe(false);
    expect(parsearFicha(null).frase).toBe('');
  });

  test('una línea con dos puntos dentro de la frase no rompe nada', () => {
    const f = parsearFicha('Elegancia versátil: cítrico y amaderado.\n\nSalida: a');
    expect(f.frase).toBe('Elegancia versátil: cítrico y amaderado.');
  });
});

describe('nivel', () => {
  test('mapea palabras a 1-3', () => {
    expect(nivel('Alta (más de 8 h)')).toBe(3);
    expect(nivel('fuerte')).toBe(3);
    expect(nivel('Moderada (4-6 h)')).toBe(2);
    expect(nivel('discreta')).toBe(1);
    expect(nivel('???')).toBe(0);
  });
});
