import { normOpcion, emparejarOpcion, construirPrompt, parsearRespuesta } from '../assets/js/ia-perfume.js';

// Opciones tal como las pinta el admin: value = nombre, text con emoji.
const op = (value, emoji = '') => ({ value, text: emoji ? `${emoji} ${value}` : value });

const TIPOS = [
  op('Elixir', '🧪'), op('Parfum Intense', '🔥'), op('Eau Fraîche', '❄️'), op('Attar / Aceite', '🫗'),
  op('Body Mist'), op('Hair Mist'), op('Cologne'), op('Eau de Parfum'), op('Eau de Toilette'),
  op('Extrait de Parfum'), op('Parfum'),
];
const FAMILIAS = [
  op('Floral'), op('Amaderado'), op('Aromático'), op('Frutal'), op('Cítrico'), op('Oriental'),
  op('Gourmand'), op('Fougere'), op('Marino'), op('Especiado', '🌶️'), op('Verde', '🌿'), op('Cuero', '🧤'),
];

describe('normOpcion', () => {
  test('quita emojis, acentos, mayúsculas y signos', () => {
    expect(normOpcion('🌶️ Especiado')).toBe('especiado');
    expect(normOpcion('Eau Fraîche')).toBe('eau fraiche');
    expect(normOpcion('Attar / Aceite')).toBe('attar aceite');
  });
});

describe('emparejarOpcion: concentraciones', () => {
  test('"Parfum" elige Parfum, no Parfum Intense ni Eau de Parfum', () => {
    // El bug: con "contiene" y los tipos nuevos arriba, caía en Parfum Intense.
    expect(emparejarOpcion(TIPOS, 'Parfum')).toBe('Parfum');
  });
  test('coincidencia exacta aunque la opción tenga emoji', () => {
    expect(emparejarOpcion(TIPOS, 'Elixir')).toBe('Elixir');
    expect(emparejarOpcion(TIPOS, 'Eau de Parfum')).toBe('Eau de Parfum');
  });
  test('abreviaturas y variantes por alias', () => {
    expect(emparejarOpcion(TIPOS, 'EDP')).toBe('Eau de Parfum');
    expect(emparejarOpcion(TIPOS, 'EDT')).toBe('Eau de Toilette');
    expect(emparejarOpcion(TIPOS, 'Eau de Cologne')).toBe('Cologne');
    expect(emparejarOpcion(TIPOS, 'Extrait')).toBe('Extrait de Parfum');
    expect(emparejarOpcion(TIPOS, 'Eau de Parfum Intense')).toBe('Parfum Intense');
    expect(emparejarOpcion(TIPOS, 'Perfume oil')).toBe('Attar / Aceite');
  });
  test('sin acentos', () => {
    expect(emparejarOpcion(TIPOS, 'eau fraiche')).toBe('Eau Fraîche');
  });
});

describe('emparejarOpcion: familias', () => {
  test('femenino o en inglés cae en la forma del catálogo', () => {
    expect(emparejarOpcion(FAMILIAS, 'Cítrica')).toBe('Cítrico');
    expect(emparejarOpcion(FAMILIAS, 'Amaderada')).toBe('Amaderado');
    expect(emparejarOpcion(FAMILIAS, 'Acuática')).toBe('Marino');
    expect(emparejarOpcion(FAMILIAS, 'Ámbar')).toBe('Oriental');
    expect(emparejarOpcion(FAMILIAS, 'Woody')).toBe('Amaderado');
  });
  test('familias nuevas con emoji', () => {
    expect(emparejarOpcion(FAMILIAS, 'Especiado')).toBe('Especiado');
    expect(emparejarOpcion(FAMILIAS, '🌶️ Especiado')).toBe('Especiado');
  });
  test('compuestas toman la palabra que existe', () => {
    expect(emparejarOpcion(FAMILIAS, 'Floral Afrutado')).toBe('Floral');
  });
  test('nada parecido: vacío, no un valor al azar', () => {
    expect(emparejarOpcion(FAMILIAS, 'Tabaco')).toBe('');
    expect(emparejarOpcion(FAMILIAS, '')).toBe('');
    expect(emparejarOpcion([], 'Floral')).toBe('');
  });
  test('ignora el placeholder vacío', () => {
    expect(emparejarOpcion([{ value: '', text: 'Sin especificar' }, op('Floral')], 'Sin especificar')).toBe('');
  });
});

describe('construirPrompt', () => {
  const listas = { categorias: ['Diseñador', 'Arabe', 'Nicho'], familias: ['Cítrico', 'Especiado'], tipos: ['Elixir', 'Eau de Parfum'] };

  test('incluye las listas reales del catálogo, sin emojis', () => {
    const p = construirPrompt({ nombre: 'Sauvage', ...listas });
    expect(p).toContain('exactamente una de: Cítrico, Especiado');
    expect(p).toContain('exactamente una de: Elixir, Eau de Parfum');
    expect(p).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
  test('no pide prosa poética', () => {
    expect(construirPrompt({ nombre: 'X' }).toLowerCase()).not.toContain('poétic');
  });
  test('usa la marca indicada como pista', () => {
    expect(construirPrompt({ nombre: 'Sauvage', marcaPista: 'Dior' })).toContain('la marca indicada es "Dior"');
  });
  test('respaldo en masculino si no hay listas', () => {
    expect(construirPrompt({ nombre: 'X' })).toContain('Cítrico, Floral, Amaderado');
  });
});

describe('parsearRespuesta', () => {
  test('extrae el JSON aunque venga con texto alrededor', () => {
    expect(parsearRespuesta('Claro:\n```json\n{"title":"A"}\n```')).toEqual({ title: 'A' });
  });
  test('tolera saltos de línea crudos dentro de strings', () => {
    expect(parsearRespuesta('{"desc":"linea1\nlinea2"}').desc).toBe('linea1 linea2');
  });
});
