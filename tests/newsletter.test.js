import { correoValido, normalizarCorreo, suscripcion, novedadesDesde, armarCorreo } from '../assets/js/newsletter.js';

describe('correos', () => {
  test('valida y normaliza', () => {
    expect(correoValido('  Juan.Perez@Gmail.com ')).toBe(true);
    expect(normalizarCorreo('  Juan.Perez@Gmail.com ')).toBe('juan.perez@gmail.com');
    expect(correoValido('juan@gmail')).toBe(false);
    expect(correoValido('juan perez@gmail.com')).toBe(false);
    expect(correoValido('a/b@gmail.com')).toBe(false);
    expect(correoValido('')).toBe(false);
  });
  test('el id del documento es el correo: nadie se anota dos veces', () => {
    expect(suscripcion(' ANA@mail.com ', 'tienda', 5)).toEqual({ id: 'ana@mail.com', datos: { email: 'ana@mail.com', creadoEn: 5, origen: 'tienda' } });
  });
});

describe('correo de novedades', () => {
  const semana = 1000;
  const datos = {
    perfumes: [
      { id: 'a', nombre: 'Khamrah', marca: 'Lattafa', creadoEn: 2000, precios: { 3: 60, 5: 90 }, imagen: 'img-a' },
      { id: 'b', nombre: 'Viejo', creadoEn: 10 },
      { id: 'c', nombre: 'Oculto', creadoEn: 3000, activo: false },
      { id: 'd', nombre: 'Asad', marca: 'Lattafa', creadoEn: 4000, precios: { 5: 95 } },
    ],
    completos: [{ id: 'x', nombre: 'Sauvage 100 ml', marca: 'Dior', creadoEn: 1500, precios: { px100: 2900 } }],
  };
  test('solo lo nuevo y visible, del más reciente al más viejo', () => {
    const n = novedadesDesde(datos, semana);
    expect(n.decants.map(p => p.id)).toEqual(['d', 'a']);
    expect(n.completos.map(p => p.id)).toEqual(['x']);
  });
  test('arma HTML y texto con links a cada página y precio desde', () => {
    const n = novedadesDesde(datos, semana);
    const c = armarCorreo(n, { base: 'https://tienda/', link: p => `producto.html?p=${p.id}`, img: u => (u ? `cdn/${u}` : '') });
    expect(c.total).toBe(3);
    expect(c.html).toContain('https://tienda/producto.html?p=a');
    expect(c.html).toContain('cdn/img-a');
    expect(c.html).toContain('Desde $60 MXN');
    expect(c.texto).toContain('- Lattafa · Khamrah — desde $60: https://tienda/producto.html?p=a');
    expect(c.texto).toContain('Dior · Sauvage 100 ml — desde $2900');
    expect(c.html).not.toMatch(/precio por ml|\/ml/i);
  });
});
