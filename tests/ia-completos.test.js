import {
  claveCategoria, precioRazonable, referenciasDe, construirPromptCompleto, interpretarCompleto,
} from '../assets/js/ia-completos.js';

const CONC = ['EDP', 'EDT', 'EDC', 'Parfum', 'Elixir', 'Oil'].map(v => ({ value: v, text: v }));

describe('claveCategoria', () => {
  test('reconoce las tres con o sin acento, y en inglés', () => {
    expect(claveCategoria('Árabe')).toBe('arabe');
    expect(claveCategoria('Diseñador')).toBe('disenador');
    expect(claveCategoria('Designer')).toBe('disenador');
    expect(claveCategoria('Niche')).toBe('nicho');
    expect(claveCategoria('')).toBe('');
  });
});

describe('precioRazonable', () => {
  test('árabe de 100 ml en $850 sí; en $8,500 no', () => {
    expect(precioRazonable(850, 100, 'arabe')).toBe(true);
    expect(precioRazonable(8500, 100, 'arabe')).toBe(false);
  });
  test('la talla escala el rango: 30 ml de diseñador en $3,000 no tiene sentido', () => {
    expect(precioRazonable(1400, 30, 'disenador')).toBe(true);
    expect(precioRazonable(3000, 30, 'disenador')).toBe(false);
  });
  test('cero, texto o talla desconocida no pasan', () => {
    expect(precioRazonable(0, 100, 'nicho')).toBe(false);
    expect(precioRazonable('abc', 100, 'nicho')).toBe(false);
    expect(precioRazonable(2000, 90, 'disenador')).toBe(false);
  });
});

describe('referenciasDe', () => {
  test('solo las tallas con precio, una línea por perfume', () => {
    const refs = referenciasDe([
      { nombre: 'Odyssey Aqua', marca: 'Armaf', precios: { px100: 850, px50: '' } },
      { nombre: 'Sin precio', marca: 'X', precios: {} },
    ]);
    expect(refs).toEqual(['- Armaf Odyssey Aqua: 100 ml $850']);
  });
});

describe('construirPromptCompleto', () => {
  test('lleva el nombre, la marca indicada, las concentraciones y las referencias', () => {
    const p = construirPromptCompleto({
      nombre: 'Odyssey Aqua', marcaPista: 'Armaf', concentraciones: ['EDP', 'EDT'],
      referencias: ['- Armaf Odyssey Homme: 100 ml $800'],
    });
    expect(p).toContain('"Odyssey Aqua"');
    expect(p).toContain('"Armaf"');
    expect(p).toContain('EDP, EDT');
    expect(p).toContain('Armaf Odyssey Homme: 100 ml $800');
    expect(p).toContain('Mercado Libre');
    expect(p).not.toMatch(/po[eé]tic/i);
  });
});

describe('interpretarCompleto', () => {
  const base = {
    brand: 'Armaf', category: 'Árabe', gender: 'caballero', concentration: 'Eau de Parfum',
    longevity: 'Muy duradera', sillage: 'Moderada', confianza: 'Alta',
    presentaciones: [100],
    precios: { 100: { mercado: 899, sugerido: 846 } },
  };

  test('normaliza los campos al formato del formulario', () => {
    const r = interpretarCompleto(base, { concentraciones: CONC });
    expect(r.categoria).toBe('Árabe');
    expect(r.genero).toBe('Caballero');
    expect(r.concentracion).toBe('EDP');
    expect(r.longevidad).toBe('muy-duradera');
    expect(r.proyeccion).toBe('moderada');
    expect(r.confianza).toBe('alta');
    expect(r.precios).toEqual({ 100: { mercado: 900, sugerido: 850 } });
  });

  test('descarta tallas que no vienen en presentaciones', () => {
    const r = interpretarCompleto({ ...base, precios: { 100: { sugerido: 850 }, 200: { sugerido: 1400 } } });
    expect(Object.keys(r.precios)).toEqual(['100']);
    expect(r.descartados).toEqual([{ ml: '200', razon: 'esa talla no existe' }]);
  });

  test('descarta un precio disparatado en vez de llenarlo', () => {
    const r = interpretarCompleto({ ...base, precios: { 100: { mercado: 9500, sugerido: 9000 } } });
    expect(r.precios).toEqual({});
    expect(r.descartados[0].razon).toBe('precio fuera de rango');
  });

  test('acepta claves como "100ml" y sin sugerido usa el de mercado', () => {
    const r = interpretarCompleto({ ...base, precios: { '100ml': { mercado: 880 } } });
    expect(r.precios['100']).toEqual({ mercado: 880, sugerido: 880 });
  });

  test('valores raros quedan vacíos, no inventados', () => {
    const r = interpretarCompleto({ longevity: 'infinita', sillage: 'nuclear', concentration: 'Agua mágica', confianza: '?' }, { concentraciones: CONC });
    expect(r.longevidad).toBe('');
    expect(r.proyeccion).toBe('');
    expect(r.concentracion).toBe('');
    expect(r.confianza).toBe('media');
  });
});
