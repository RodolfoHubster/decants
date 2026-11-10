/**
 * catalogo-paginas.js — Qué lleva el catálogo en PDF y en qué hoja va cada
 * cosa. Sin DOM (el dibujo está en catalogo-pdf.js).
 *
 * Catálogo completo:
 *   portada · cómo pedir · índice · [por sección: portadilla + hojas de 6] ·
 *   consejos · contraportada
 * Hojas de novedades (para meter antes de la contraportada del impreso):
 *   portadilla "Lo nuevo" + hojas de 6 con lo agregado desde una fecha.
 *
 * Secciones Mujer / Hombre / Unisex; dentro, por marca de la A a la Z. No
 * salen agotados, archivados, inactivos ni perfumes sin ningún precio.
 */
import { parsearFicha } from './ficha.js';
import { preciosDe, textoInspirado, linkPerfume, datosTarjeta } from './compartir-perfume.js';
import { toSlug } from './slug.js';

export const POR_PAGINA = 6;

export const SECCIONES = [
  { id: 'mujer', titulo: 'Mujer', genero: 'Dama' },
  { id: 'hombre', titulo: 'Hombre', genero: 'Caballero' },
  { id: 'unisex', titulo: 'Unisex', genero: 'Unisex' },
];

/** El primero va en "Cómo pedir"; los demás en portadillas y huecos de las hojas. */
export const DATOS_CURIOSOS = [
  { titulo: '¿Qué es un decant?', texto: 'Es perfume original pasado de su botella a un atomizador pequeño. Así lo usas varios días, en tu piel y con tu clima, antes de invertir en la botella completa.' },
  { titulo: 'La pirámide olfativa', texto: 'Un perfume cambia con las horas: las notas de salida se sienten al rociarlo, las de corazón aparecen después y las de fondo son las que quedan al final del día.' },
  { titulo: 'Tu nariz se acostumbra', texto: 'A los pocos minutos dejas de oler tu propio perfume, pero los demás lo siguen notando. Por eso no hace falta volver a rociarlo cada rato.' },
  { titulo: 'La vainilla es mexicana', texto: 'Es la vaina de una orquídea originaria de México: los totonacas de Veracruz ya la cultivaban mucho antes de que llegara a Europa.' },
  { titulo: 'EDT, EDP y Parfum', texto: 'La diferencia es cuánta esencia llevan. De menos a más: Eau de Toilette, Eau de Parfum y Parfum o Extrait. Más concentración suele durar más en la piel.' },
  { titulo: 'Ámbar gris', texto: 'Es una sustancia que producen los cachalotes y que el mar arrastra hasta las playas. Hoy casi todos los perfumes usan su versión de laboratorio, como el ambroxan.' },
  { titulo: 'Oud', texto: 'Sale del árbol de agar cuando lo infecta un hongo: la madera produce una resina oscura y muy aromática. Es de las materias primas más caras de la perfumería.' },
  { titulo: 'Haba tonka', texto: 'Es la semilla de un árbol de Sudamérica. Huele a vainilla, almendra y heno, y le da a muchos perfumes ese fondo dulce y cálido.' },
  { titulo: 'Cada piel huele distinto', texto: 'El mismo perfume puede oler diferente en dos personas: la temperatura y la grasa natural de la piel cambian cómo se evapora cada nota.' },
  { titulo: 'Bergamota', texto: 'Es un cítrico del sur de Italia que casi no se come: se cultiva sobre todo para perfumería. Le da a muchísimos perfumes su salida fresca y luminosa.' },
  { titulo: 'Lavanda', texto: 'Es de las notas más usadas en perfumes de hombre: aporta una frescura limpia y aromática, y es la base de la familia fougère, una de las más clásicas.' },
  { titulo: 'Inspirados en…', texto: 'Muchas casas árabes crean perfumes inspirados en fragancias famosas, con un aire parecido y a mucho menor precio. Cuando un perfume está inspirado en otro, aquí te lo decimos.' },
];

export const CONSEJOS = [
  { titulo: 'Piel limpia e hidratada', texto: 'Aplícalo después de bañarte y de ponerte crema sin olor: la piel seca retiene menos el aroma.' },
  { titulo: 'Puntos de pulso', texto: 'Cuello, muñecas, detrás de las orejas y el pecho: el calor de esas zonas ayuda a que se difunda.' },
  { titulo: 'No frotes las muñecas', texto: 'El roce calienta la piel y hace que las notas de salida se vayan más rápido.' },
  { titulo: 'Un toque en la ropa', texto: 'En la tela dura más, pero prueba antes en una zona que no se vea: algunos perfumes manchan las telas claras.' },
  { titulo: 'Guárdalo bien', texto: 'Lejos de la luz, el calor y la humedad (el baño no es buen lugar): así conserva su aroma mucho más tiempo.' },
  { titulo: '¿Cuántas atomizaciones?', texto: 'De 2 a 4 bastan para la mayoría; en los muy intensos, con 1 o 2 es suficiente.' },
];

/** Para el hueco que queda cuando ya no hay datos curiosos. */
export const INVITACION = {
  titulo: '¿Buscas otro perfume?',
  texto: 'Escríbenos por WhatsApp al 664 816 2623 y te decimos si lo podemos conseguir.',
  invitacion: true,
};

export const REDES = [
  { red: 'Instagram', texto: '@fitoscents', url: 'https://www.instagram.com/fitoscents/' },
  { red: 'TikTok', texto: '@fitoscents', url: 'https://www.tiktok.com/@fitoscents' },
  { red: 'Facebook', texto: 'Fito Scents', url: 'https://www.facebook.com/profile.php?id=61584221924570' },
  { red: 'WhatsApp', texto: '664 816 2623', url: 'https://wa.me/526648162623' },
  { red: 'Tienda en línea', texto: 'fitoscents.com', url: 'https://fitoscents.com/' },
];

/**
 * Logos oficiales en assets/img/marcas/<slug>.png: silueta blanca sobre
 * transparente (el PDF la pinta dorada). Salieron de Wikimedia Commons y de los
 * sitios de cada casa. Las que no están aquí salen con su nombre en letra de la
 * tienda. Para agregar una: guarda su PNG con el slug de la marca y súmala aquí.
 */
export const LOGOS_MARCAS = [
  'afnan', 'armaf', 'azzaro', 'billie-eillish', 'calvin-klein', 'carolina-herrera', 'chanel',
  'christian-dior', 'dolce-gabbana', 'giorgio-armani', 'givenchy', 'jean-paul-gaultier', 'juicy-couture',
  'lancome', 'lattafa', 'le-labo', 'marc-jacobs', 'montblanc', 'nautica', 'paco-rabanne', 'prada',
  'rasasi', 'sabrina-carpenter', 'valentino', 'versace',
];

/** "Dolce & Gabbana" → "dolce-gabbana.png"; null si no hay logo guardado. */
export function archivoLogo(marca) {
  const s = toSlug(marca);
  return LOGOS_MARCAS.includes(s) ? `${s}.png` : null;
}

export const seccionDe = p => (SECCIONES.find(s => s.genero === (p && p.genero)) || null);

const comparar = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base', numeric: true });

/** Por marca (A→Z, sin importar acentos ni mayúsculas) y luego por nombre. */
export function ordenarPorMarca(lista) {
  return [...(lista || [])].sort((a, b) => comparar(a.marca, b.marca) || comparar(a.nombre, b.nombre));
}

/**
 * Por qué un perfume no entra al catálogo ('' si sí entra).
 * @returns {''|'inactivo'|'agotado'|'sinPrecio'|'sinGenero'}
 */
export function motivoFuera(p, opciones = {}) {
  if (!p || p.activo === false || p.archivado === true || p.isAccesorio) return 'inactivo';
  if (p.estadoStock === 'agotado') return 'agotado';
  if (!preciosDe(p, opciones).tallas.length) return 'sinPrecio';
  if (!seccionDe(p)) return 'sinGenero';
  return '';
}

/** Hasta `max` notas, tomando una de cada nivel por turnos: salida, corazón, fondo, salida… */
export function notasCortas(descripcion, max = 4) {
  const f = parsearFicha(descripcion);
  const niveles = [f.salida, f.corazon, f.fondo].filter(n => n.length);
  if (!niveles.length) return f.notas.slice(0, max);
  const r = [];
  for (let i = 0; r.length < max && niveles.some(n => n[i]); i++) {
    for (const n of niveles) if (n[i] && r.length < max) r.push(n[i]);
  }
  return r;
}

/** Lo que pinta cada tarjeta. */
export function tarjeta(p, opciones = {}) {
  const { tallas, pro } = preciosDe(p, opciones);
  const d = datosTarjeta(p, opciones);
  return {
    id: p.id,
    nombre: String(p.nombre || '').trim(),
    marca: String(p.marca || '').trim(),
    inspirado: textoInspirado(p),
    notas: notasCortas(p.descripcion),
    // Duración y estela; la frase sale cuando el perfume no trae notas.
    rasgos: d.rasgos.filter(r => /^(Duración|Estela)/.test(r)),
    frase: d.frase,
    tallas,
    pro: !!pro,
    imagen: p.imagen || '',
    link: linkPerfume(p),
    seccion: (seccionDe(p) || {}).id || '',
    clicks: Number(p.clicks) || 0,
    destacado: !!p.destacado,
  };
}

/** Los `n` que más se ven en la tienda (los recomendados primero), para portada y portadillas. */
export function masBuscados(tarjetas, n = 3) {
  return [...tarjetas]
    .filter(t => t.imagen)
    .sort((a, b) => (b.destacado - a.destacado) || (b.clicks - a.clicks))
    .slice(0, n);
}

const enHojas = (items, n) => {
  const hojas = [];
  for (let i = 0; i < items.length; i += n) hojas.push(items.slice(i, i + n));
  return hojas;
};

/** "10 de noviembre de 2026" */
export const fechaLarga = ms => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
/** "Noviembre 2026" */
export function edicion(ms) {
  const t = new Date(ms).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Tallas que se venden en todo el catálogo: "2, 3, 5 y 10 ml". */
export function tallasDelCatalogo(tarjetas) {
  const ml = [...new Set(tarjetas.flatMap(t => t.tallas.map(x => Number(x.ml))))].sort((a, b) => a - b);
  if (!ml.length) return '';
  return `${ml.length > 1 ? `${ml.slice(0, -1).join(', ')} y ${ml[ml.length - 1]}` : ml[0]} ml`;
}

/**
 * Arma todas las hojas con su número.
 * @param {object[]} perfumes  como vienen de Firestore (con id)
 * @param {{tipo?:'completo'|'novedades', desde?:number, fecha?:number, disable2ml?:boolean, proExtra?:number}} [op]
 * @returns {{paginas:object[], indice:object[], conteo:object, fuera:object, tallas:string}}
 */
export function armarCatalogo(perfumes, op = {}) {
  const { tipo = 'completo', desde = 0, fecha = Date.now() } = op;
  const fuera = { agotado: 0, sinPrecio: 0, sinGenero: 0 };
  const dentro = [];
  for (const p of perfumes || []) {
    if (tipo === 'novedades' && !((Number(p && p.creadoEn) || 0) >= desde)) continue;
    const m = motivoFuera(p, op);
    if (m && m !== 'inactivo') fuera[m]++;
    if (!m) dentro.push(p);
  }

  const porSeccion = SECCIONES.map(s => ({
    seccion: s,
    items: ordenarPorMarca(dentro.filter(p => p.genero === s.genero)).map(p => tarjeta(p, op)),
  }));
  const conteo = Object.fromEntries(porSeccion.map(x => [x.seccion.id, x.items.length]));
  conteo.total = dentro.length;
  const tallas = tallasDelCatalogo(porSeccion.flatMap(x => x.items));

  const datos = DATOS_CURIOSOS.slice(1);
  let siguienteDato = 0;
  const tomarDato = () => (siguienteDato < datos.length ? datos[siguienteDato++] : null);
  // Los huecos de la última hoja de cada sección se llenan con datos curiosos y,
  // si ya no quedan, con una invitación a escribir (una sola).
  const relleno = n => {
    const r = Array.from({ length: n }, tomarDato).filter(Boolean);
    return r.length < n ? [...r, INVITACION] : r;
  };

  const paginas = [];
  const indice = [];

  if (tipo === 'novedades') {
    const items = porSeccion.flatMap(x => x.items);
    paginas.push({ tipo: 'novedades', desde, fecha, total: items.length, dato: tomarDato(), destacados: masBuscados(items) });
    const hojas = enHojas(items, POR_PAGINA);
    hojas.forEach((h, i) => paginas.push({
      tipo: 'perfumes', titulo: 'Lo nuevo', items: h, conGenero: true,
      relleno: i === hojas.length - 1 ? relleno(POR_PAGINA - h.length) : [],
    }));
  } else {
    paginas.push({ tipo: 'portada', fecha, destacados: masBuscados(porSeccion.flatMap(x => x.items)) });
    paginas.push({ tipo: 'bienvenida', fecha, tallas, dato: DATOS_CURIOSOS[0] });
    paginas.push({ tipo: 'indice' });
    const casas = { tipo: 'casas', marcas: [] };
    paginas.push(casas);

    for (const { seccion, items } of porSeccion) {
      if (!items.length) continue;
      const marcas = [...new Set(items.map(i => i.marca))];
      paginas.push({ tipo: 'seccion', seccion, total: items.length, marcas: marcas.length, dato: tomarDato(), destacados: masBuscados(items) });
      const entrada = { seccion, pagina: paginas.length, total: items.length, marcas: [] };
      const hojas = enHojas(items, POR_PAGINA);
      hojas.forEach((h, i) => {
        paginas.push({
          tipo: 'perfumes', seccion, titulo: seccion.titulo, items: h,
          relleno: i === hojas.length - 1 ? relleno(POR_PAGINA - h.length) : [],
        });
        for (const it of h) {
          if (!entrada.marcas.some(m => m.marca === it.marca)) entrada.marcas.push({ marca: it.marca, pagina: paginas.length, cuantos: 0 });
          entrada.marcas.find(m => m.marca === it.marca).cuantos++;
        }
      });
      indice.push(entrada);
    }
    paginas.push({ tipo: 'consejos' });
    paginas.push({ tipo: 'contraportada', fecha });

    // "Nuestras casas": cada marca una vez, A→Z, con la primera hoja donde aparece.
    const primera = new Map();
    for (const e of indice) for (const m of e.marcas) primera.set(m.marca, Math.min(primera.get(m.marca) || Infinity, m.pagina));
    casas.marcas = [...primera].map(([marca, pagina]) => ({ marca, pagina })).sort((a, b) => comparar(a.marca, b.marca));
  }

  paginas.forEach((p, i) => { p.numero = i + 1; });
  return { paginas, indice, conteo, fuera, tallas };
}

/** "Afnan – Carolina Herrera" (marcas de la primera y la última tarjeta de la hoja). */
export function rangoMarcas(items) {
  if (!items || !items.length) return '';
  const a = items[0].marca, b = items[items.length - 1].marca;
  return a === b ? a : `${a} – ${b}`;
}

/** Nombre del archivo: "fitoscents-catalogo-2026-11-10-imprenta.pdf". */
export function nombreArchivo({ tipo = 'completo', modo = 'digital', fecha = Date.now() } = {}) {
  const d = new Date(fecha);
  const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `fitoscents-${tipo === 'novedades' ? 'novedades' : 'catalogo'}-${f}${modo === 'imprenta' ? '-imprenta' : ''}.pdf`;
}
