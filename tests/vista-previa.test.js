import worker, {
  toSlug, slugDe, valor, campos, buscar, tallasDe, fraseDe, fotoVistaPrevia, vistaDe, escapar, paginaVistaPrevia,
} from '../cloudflare/vista-previa.js';
import * as slug from '../assets/js/slug.js';

const nueve = {
  nombre: '9PM Elixir', marca: 'Afnan', activo: true, archivado: false,
  imagen: 'https://res.cloudinary.com/dxo761td7/image/upload/v1712/fitoscents/perfumes/9pm.jpg',
  precios: { 2: 0, 3: 65, 5: 90, 10: 150 },
  inspiradoEn: { nombre: 'Le Male Elixir Absolu', marca: 'Jean Paul Gaultier' },
  descripcion: 'Especiada y oscura.\nPara la noche.\n\nSalida: cardamomo\nFondo: vainilla',
};

describe('slug igual que la tienda', () => {
  test.each([
    ['Afnan', '9PM Elixir'], ['Jean Paul Gaultier', 'Le Male Élixir'], ['Lattafa', "Khamrah Qahwa"],
    ['Armaf', 'Club de Nuit  Intense Man'], [undefined, 'Paquete Noche & Día'],
  ])('%s %s', (marca, nombre) => {
    expect(slugDe({ marca, nombre })).toBe(slug.slugDe({ marca, nombre }));
    expect(toSlug(`${marca} ${nombre}`)).toBe(slug.toSlug(`${marca} ${nombre}`));
  });
});

describe('valores de la API REST de Firestore', () => {
  test('texto, números, mapas, listas', () => {
    expect(campos({
      nombre: { stringValue: 'X' },
      precios: { mapValue: { fields: { 5: { integerValue: '90' }, 10: { doubleValue: 150.5 } } } },
      activo: { booleanValue: true },
      tags: { arrayValue: { values: [{ stringValue: 'a' }] } },
      vacio: { nullValue: null },
    })).toEqual({ nombre: 'X', precios: { 5: 90, 10: 150.5 }, activo: true, tags: ['a'], vacio: null });
    expect(valor(undefined)).toBeNull();
    expect(campos(undefined)).toEqual({});
  });
});

describe('buscar', () => {
  test('por slug, solo lo que se ve en la tienda', () => {
    const items = [{ ...nueve, activo: false }, nueve, { nombre: 'Otro', marca: 'Afnan' }];
    expect(buscar(items, 'afnan-9pm-elixir')).toBe(nueve);
    expect(buscar([{ ...nueve, archivado: true }], 'afnan-9pm-elixir')).toBeNull();
    expect(buscar(items, 'no-existe')).toBeNull();
  });
});

describe('lo que dice la vista previa', () => {
  test('tallas a la venta; el 2 ml apagado no sale', () => {
    expect(tallasDe({ 2: 40, 10: 150, 5: 90, 3: '' }).map(t => t.ml)).toEqual(['2', '5', '10']);
    expect(tallasDe({ 2: 40, 5: 90 }, { disable2ml: true }).map(t => t.ml)).toEqual(['5']);
  });
  test('la frase es lo de antes de las notas', () => {
    expect(fraseDe(nueve.descripcion)).toBe('Especiada y oscura. Para la noche.');
    expect(fraseDe('Salida: limón')).toBe('');
    expect(fraseDe('')).toBe('');
  });
  test('título, desde cuánto, tallas, original y frase', () => {
    expect(vistaDe(nueve)).toEqual({
      titulo: '9PM Elixir · Afnan',
      descripcion: 'Decant original desde $65 · 3, 5 y 10 ml · Inspirado en Le Male Elixir Absolu. Especiada y oscura. Para la noche.',
      imagen: 'https://res.cloudinary.com/dxo761td7/image/upload/w_1200,h_630,c_pad,b_auto,f_jpg,q_auto/v1712/fitoscents/perfumes/9pm.jpg',
    });
  });
  test('descripciones larguísimas se cortan', () => {
    const v = vistaDe({ ...nueve, descripcion: 'palabra '.repeat(80) });
    expect(v.descripcion.length).toBeLessThanOrEqual(200);
    expect(v.descripcion.endsWith('…')).toBe(true);
  });
  test('fotos: reemplaza transformaciones viejas; otras se quedan; sin foto, el logo', () => {
    expect(fotoVistaPrevia('https://res.cloudinary.com/dxo761td7/image/upload/w_500,h_500,c_fill/v1/a.jpg'))
      .toBe('https://res.cloudinary.com/dxo761td7/image/upload/w_1200,h_630,c_pad,b_auto,f_jpg,q_auto/v1/a.jpg');
    expect(fotoVistaPrevia('https://m.media-amazon.com/x.jpg')).toBe('https://m.media-amazon.com/x.jpg');
    expect(fotoVistaPrevia('')).toBe('https://fitoscents.com/assets/img/LogoOficial2.jpeg');
  });
});

describe('paginaVistaPrevia', () => {
  test('lleva las etiquetas og y escapa lo que viene de Firestore', () => {
    const html = paginaVistaPrevia({ ...nueve, nombre: 'Rosa "<b>" & Oud' }, {
      aqui: 'https://ver.fitoscents.com/afnan-rosa-b-oud', destino: 'https://fitoscents.com/producto.html?p=x',
    });
    expect(html).toContain('<meta property="og:title" content="Rosa &quot;&lt;b&gt;&quot; &amp; Oud · Afnan">');
    expect(html).toContain('<meta property="og:url" content="https://ver.fitoscents.com/afnan-rosa-b-oud">');
    expect(html).toContain('og:image" content="https://res.cloudinary.com/');
    expect(html).not.toContain('<b>');
    expect(escapar("a'b")).toBe('a&#39;b');
  });
});

describe('el worker', () => {
  const pedir = (ruta, ua) => worker.fetch(new Request(`https://ver.fitoscents.com${ruta}`, { headers: { 'user-agent': ua } }));
  const NAVEGADOR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';

  test('a las personas las manda a la página del producto sin consultar nada', async () => {
    let llamadas = 0;
    const antes = globalThis.fetch;
    globalThis.fetch = async () => { llamadas++; return new Response('{}'); };
    const r = await pedir('/Afnan-9PM-Elixir/', NAVEGADOR);
    globalThis.fetch = antes;
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://fitoscents.com/producto.html?p=afnan-9pm-elixir');
    expect(llamadas).toBe(0);
  });

  test('sin slug, a la tienda', async () => {
    const r = await pedir('/', NAVEGADOR);
    expect(r.headers.get('location')).toBe('https://fitoscents.com/');
  });

  test('a WhatsApp le contesta la página con los datos', async () => {
    const doc = (id, f) => ({ name: `projects/p/databases/(default)/documents/x/${id}`, fields: f });
    const antes = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      const cuerpo = u.includes('/config/tienda') ? { fields: { disable2ml: { booleanValue: true } } }
        : u.includes('/perfumes?') ? { documents: [doc('n1', {
          nombre: { stringValue: '9PM Elixir' }, marca: { stringValue: 'Afnan' }, activo: { booleanValue: true },
          precios: { mapValue: { fields: { 2: { integerValue: '40' }, 5: { integerValue: '90' } } } },
        })] }
        : { documents: [] };
      return new Response(JSON.stringify(cuerpo), { status: 200 });
    };
    const r = await pedir('/afnan-9pm-elixir', 'WhatsApp/2.24.1 A');
    globalThis.fetch = antes;
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('og:title" content="9PM Elixir · Afnan"');
    expect(html).toContain('Decant original desde $90 · 5 ml');   // el 2 ml está apagado
  });
});

test('si la frase ya dice "Inspirado en…", no se repite', () => {
  const v = vistaDe({ ...nueve, descripcion: 'Inspirado en Le Male de JPG: especiado.\n\nSalida: x' });
  expect(v.descripcion).toBe('Decant original desde $65 · 3, 5 y 10 ml. Inspirado en Le Male de JPG: especiado.');
});
