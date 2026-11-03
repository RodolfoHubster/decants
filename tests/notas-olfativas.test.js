import { claveNota, significadoNota, NOTAS } from '../assets/js/notas-olfativas.js';

describe('claveNota', () => {
  test('la nota tal cual, sin importar acentos ni mayúsculas', () => {
    expect(claveNota('Lavanda')).toBe('lavanda');
    expect(claveNota('CARDAMOMO')).toBe('cardamomo');
    expect(claveNota('Pachulí')).toBe('pachuli');
    expect(claveNota('Ylang-ylang')).toBe('ylang ylang');
  });
  test('alias: otra forma de llamarla', () => {
    expect(claveNota('Pomelo')).toBe('toronja');
    expect(claveNota('Olíbano')).toBe('incienso');
    expect(claveNota('Tonka')).toBe('haba tonka');
    expect(claveNota('Pimienta')).toBe('pimienta negra');
    expect(claveNota('Ambrofix')).toBe('ambroxan');
  });
  test('la nota conocida más larga dentro del nombre', () => {
    expect(claveNota('Vainilla bourbon')).toBe('vainilla');
    expect(claveNota('Madera de cedro')).toBe('cedro');
    expect(claveNota('Flor de azahar del naranjo')).toBe('flor de azahar');
    expect(claveNota('Ámbar gris')).toBe('ambar gris');
    expect(claveNota('Pimienta rosa')).toBe('pimienta rosa');
  });
  test('un alias largo gana a una nota corta ("orquídea de vainilla" es vainilla)', () => {
    expect(claveNota('Orquídea de vainilla')).toBe('vainilla');
  });
  test('las genéricas caen en su familia', () => {
    expect(claveNota('Notas amaderadas')).toBe('maderas');
    expect(claveNota('Especias cálidas')).toBe('especias');
    expect(claveNota('Notas aromáticas')).toBe('notas aromaticas');
    expect(claveNota('Acorde marino')).toBe('notas marinas');
    expect(claveNota('Matiz especiado')).toBe('especias');
  });
  test('lo que no se conoce no tiene significado', () => {
    expect(claveNota('Xyzzy')).toBe('');
    expect(claveNota('')).toBe('');
    expect(claveNota(null)).toBe('');
  });
  test('no confunde palabras que solo se parecen ("salvia" no es "sal")', () => {
    expect(claveNota('Salvia')).toBe('salvia');
    expect(claveNota('Rosa')).toBe('rosa');
  });
});

describe('significadoNota', () => {
  test('devuelve el nombre como viene, su tipo y qué es', () => {
    const s = significadoNota('Haba tonka');
    expect(s.nombre).toBe('Haba tonka');
    expect(s.tipo).toBe('Gourmand');
    expect(s.texto).toMatch(/vainilla/i);
  });
  test('el nombre empieza con mayúscula aunque en la ficha venga en minúsculas', () => {
    expect(significadoNota('ciruela mirabel').nombre).toBe('Ciruela mirabel');
  });
  test('null si no se conoce', () => {
    expect(significadoNota('Nota inventada')).toBeNull();
  });
  test('todas las entradas tienen tipo y texto', () => {
    Object.entries(NOTAS).forEach(([clave, [tipo, texto]]) => {
      expect(tipo).toBeTruthy();
      expect(texto.length).toBeGreaterThan(20);
      expect(clave).toBe(clave.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    });
  });
});
