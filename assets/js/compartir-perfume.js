/**
 * compartir-perfume.js — Lo que mandas de un perfume cuando alguien pregunta
 * por él: el texto para pegar en el chat y los datos de la imagen. Sin DOM.
 *
 * Texto (directo, sin asteriscos ni lemas al final):
 *
 *   9PM Elixir · Afnan
 *   Inspirado en Le Male Elixir Absolu de Jean Paul Gaultier
 *
 *   3 ml · $65
 *   5 ml · $90
 *   10 ml · $150 (ahorras $45)
 *   PRO, envase reforzado: +$15 en 5 y 10 ml
 *
 *   https://fitoscents.com/...
 */
import { parsearFicha } from './ficha.js';
import { opcionesRapidas } from './compra-rapida.js';
import { slugDe } from './slug.js';

export const SITIO = 'https://fitoscents.com/';

/**
 * Dirección con vista previa (foto y precio al mandarla por WhatsApp): el
 * Worker de cloudflare/vista-previa.js, publicado en Cloudflare como
 * "vista-previa" con el dominio ver.fitoscents.com. A las personas las manda a
 * la página del producto. En null se compartiría la página directo.
 */
export const VISTA_PREVIA = 'https://ver.fitoscents.com/';

/** El link del perfume: el de la vista previa si ya existe, si no la página del producto. */
export function linkPerfume(p, base = VISTA_PREVIA) {
  const slug = slugDe(p);
  return base ? `${base}${slug}` : `${SITIO}producto.html?p=${encodeURIComponent(slug)}`;
}

/** "Le Male Elixir Absolu de Jean Paul Gaultier", o '' si no es dupe. */
export function textoInspirado(p) {
  const i = p && p.inspiradoEn;
  const nombre = String((i && i.nombre) || '').trim();
  if (!nombre) return '';
  const marca = String(i.marca || '').trim();
  return marca ? `${nombre} de ${marca}` : nombre;
}

/** "5 y 10", "3, 5 y 10". */
export function unirConY(xs) {
  const l = (xs || []).map(String);
  return l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : (l[0] || '');
}

const esPerfume = p => !(p.tipo === 'paquete' || p.esPaquete || p.isAccesorio || p.tipo === 'accesorio');

/**
 * Tamaños a la venta, de chico a grande, con el ahorro absoluto (nunca precio
 * por ml), y el PRO si hay. Respeta el 2 ml apagado en la tienda. Un precio
 * vacío es "esa talla no se vende": no sale.
 * @returns {{tallas:Array<{ml:string, precio:number, ahorro:number}>, pro:null|{tallas:string[], extra:number}}}
 */
export function preciosDe(p, { disable2ml = false, proExtra = 0 } = {}) {
  if (!p) return { tallas: [], pro: null };
  if (!esPerfume(p)) {
    const tallas = Object.entries(p.precios || {})
      .filter(([, v]) => +v > 0)
      .sort(([a], [b]) => +a - +b)
      .map(([k, v]) => ({ ml: String(k), precio: +v, ahorro: 0 }));
    return { tallas, pro: null };
  }
  const ops = opcionesRapidas(p, { permitida: k => !(disable2ml && String(k) === '2'), proExtra });
  const pros = ops.filter(o => o.pro);
  return {
    tallas: ops.filter(o => !o.pro).map(o => ({ ml: o.size, precio: o.price, ahorro: o.ahorro })),
    pro: pros.length ? { tallas: pros.map(o => o.size), extra: Number(proExtra) } : null,
  };
}

/**
 * El texto para pegar en el chat. '' si no hay ningún precio.
 * @param {object} p
 * @param {{disable2ml?:boolean, proExtra?:number, link?:string|null}} [opciones]
 *   `link` reemplaza al del perfume; null lo quita.
 */
export function textoPrecios(p, opciones = {}) {
  const { tallas, pro } = preciosDe(p, opciones);
  if (!tallas.length) return '';
  const lineas = [[p.nombre, p.marca].filter(Boolean).join(' · ')];
  const insp = textoInspirado(p);
  if (insp) lineas.push(`Inspirado en ${insp}`);
  lineas.push('');
  const prefijo = p.tipo === 'paquete' || p.esPaquete ? 'Paquete ' : '';
  for (const t of tallas) {
    lineas.push(`${prefijo}${t.ml} ml · $${t.precio}${t.ahorro > 0 ? ` (ahorras $${t.ahorro})` : ''}`);
  }
  if (pro) lineas.push(`PRO, envase reforzado: +$${pro.extra} en ${unirConY(pro.tallas)} ml`);
  const link = opciones.link === undefined ? linkPerfume(p) : opciones.link;
  if (link) lineas.push('', link);
  return lineas.join('\n');
}

/**
 * "Inspirado en Scandal de JPG: mandarina y caramelo…" → "Mandarina y caramelo…".
 * En la imagen el original ya va aparte, arriba.
 */
export function sinInspiradoAlInicio(frase) {
  const f = String(frase || '');
  const r = f.replace(/^inspirad[oa] en [^:.]{2,80}[:.]\s*/i, '');
  return r === f || !r ? f : r.charAt(0).toUpperCase() + r.slice(1);
}

/** "Alta (más de 8 h)" → "alta". */
const sinParentesis = t => String(t || '').replace(/\s*\(.*\)\s*/g, '').trim().toLowerCase();

/** Lo que va en la imagen del perfume. */
export function datosTarjeta(p, opciones = {}) {
  const ficha = parsearFicha(p.descripcion);
  const tiers = ficha.salida.length || ficha.corazon.length || ficha.fondo.length
    ? [['Salida', ficha.salida], ['Corazón', ficha.corazon], ['Fondo', ficha.fondo]]
    : [['Notas', ficha.notas]];
  const piramide = tiers
    .filter(([, notas]) => notas.length)
    .map(([etiqueta, notas]) => ({ etiqueta, notas: notas.join(', ') }));

  const rasgos = [];
  if (ficha.duracion) rasgos.push(`Duración ${sinParentesis(ficha.duracion)}`);
  if (ficha.estela) rasgos.push(`Estela ${sinParentesis(ficha.estela)}`);
  if (ficha.momento.length) rasgos.push(ficha.momento.length > 1 ? 'Día y noche' : ficha.momento[0]);
  if (ficha.clima) rasgos.push(ficha.clima);

  const inspirado = textoInspirado(p);
  let frase = (ficha.estructurada ? ficha.frase : String(p.descripcion || '')).replace(/\s+/g, ' ').trim();
  if (inspirado) frase = sinInspiradoAlInicio(frase);

  return {
    nombre: String(p.nombre || '').trim(),
    marca: String(p.marca || '').trim(),
    inspirado,
    frase,
    piramide,
    rasgos: rasgos.filter(Boolean),
    ...preciosDe(p, opciones),
    imagen: p.imagen || '',
    sitio: SITIO.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    archivo: `fitoscents-${slugDe(p) || 'perfume'}.jpg`,
  };
}

/**
 * Parte un texto en renglones que quepan en `ancho`. Si se pasa de `max`
 * renglones, el último termina en "…".
 * @param {string} texto
 * @param {(s:string)=>number} medir  ancho de un texto (en el lienzo: ctx.measureText)
 * @param {number} ancho
 * @param {number} [max]
 * @returns {string[]}
 */
export function partirLineas(texto, medir, ancho, max = Infinity) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const w of palabras) {
    const prueba = actual ? `${actual} ${w}` : w;
    if (!actual || medir(prueba) <= ancho) actual = prueba;
    else { lineas.push(actual); actual = w; }
  }
  if (actual) lineas.push(actual);
  if (max <= 0) return [];

  const sobran = lineas.length > max;
  const quedan = lineas.slice(0, max);
  return quedan.map((l, i) => {
    const cortar = (sobran && i === quedan.length - 1) || medir(l) > ancho;
    if (!cortar) return l;
    // Quita palabras (o letras, si es una sola palabra larguísima) hasta que quepa con "…".
    let r = l;
    while (r && medir(`${r}…`) > ancho) {
      const corte = r.lastIndexOf(' ');
      r = corte > 0 ? r.slice(0, corte) : r.slice(0, -1);
    }
    return `${r.replace(/[\s,.;:·-]+$/, '')}…`;
  });
}
