import { matchSearch, puntajeBusqueda } from '../assets/js/search-engine.js';

describe('matchSearch', () => {
  test('lo de siempre: parte del nombre, sin acentos ni mayúsculas', () => {
    expect(matchSearch('odyssey', 'Odyssey Mandarin Sky Armaf')).toBe(true);
    expect(matchSearch('lancome', 'La Vie Est Belle Lancôme')).toBe(true);
    expect(matchSearch('mandarin odyssey', 'Odyssey Mandarin Sky')).toBe(true);
  });
  test('acrónimos', () => {
    expect(matchSearch('jpg', 'Le Beau Le Parfum Jean Paul Gaultier')).toBe(true);
    expect(matchSearch('cdn', 'Club de Nuit Intense Man Armaf')).toBe(true);
  });
  test('error de dedo, si empieza con la misma letra', () => {
    expect(matchSearch('savage', 'Sauvage Eau de Parfum Christian Dior')).toBe(true);
    expect(matchSearch('odisey', 'Odyssey Aqua Armaf')).toBe(true);
  });
  test('"beau" ya no encuentra "eau" (antes salían todos los Eau de Toilette)', () => {
    expect(matchSearch('le beau', 'Scandal Eau de Toilette Jean Paul Gaultier')).toBe(false);
    expect(matchSearch('le beau', 'Le Beau Le Parfum Jean Paul Gaultier')).toBe(true);
  });
  test('1 o 2 letras solo al principio de una palabra', () => {
    expect(matchSearch('le', 'Bleu de Chanel Eau de Parfum')).toBe(false);
    expect(matchSearch('le', 'Le Male Elixir')).toBe(true);
    expect(matchSearch('y', 'Y Le Parfum')).toBe(true);
  });
  test('sin espacios: "lebeau" es "Le Beau"', () => {
    expect(matchSearch('lebeau', 'Le Beau Paradise Garden')).toBe(true);
    expect(matchSearch('clubdenuit', 'Club de Nuit Untold')).toBe(true);
  });
  test('vacío encuentra todo; sin texto, nada', () => {
    expect(matchSearch('', 'x')).toBe(true);
    expect(matchSearch('x', '')).toBe(false);
  });
});

describe('puntajeBusqueda', () => {
  const campos = p => [p.nombre, `${p.marca} ${p.nombre}`, p.dupe || ''];
  const pts = (q, p) => puntajeBusqueda(q, campos(p));
  const leBeau = { nombre: 'Le Beau Le Parfum', marca: 'Jean Paul Gaultier' };
  const paradise = { nombre: 'Le Beau Paradise Garden', marca: 'Jean Paul Gaultier' };
  const dupe = { nombre: 'Jaguar for Him', marca: 'Jaguar', dupe: 'Le Beau Le Parfum' };

  test('nombre > marca > original del dupe; y dentro, igual > empieza igual > contiene', () => {
    expect(pts('le beau le parfum', leBeau)).toBeGreaterThan(pts('le beau le parfum', paradise));
    expect(pts('le beau', leBeau)).toBeGreaterThan(pts('le beau', dupe));
    expect(pts('parfum', leBeau)).toBeGreaterThan(pts('gaultier', leBeau));
    expect(pts('gaultier', leBeau)).toBeGreaterThan(pts('le beau', dupe));
    expect(pts('le beau', dupe)).toBeGreaterThan(0);
  });
  test('los espacios no importan', () => {
    expect(pts('lebeau', leBeau)).toBe(pts('le beau', leBeau));
  });
  test('lo que no coincide vale 0', () => {
    expect(pts('khamrah', leBeau)).toBe(0);
    expect(puntajeBusqueda('', ['x'])).toBe(0);
  });
});
