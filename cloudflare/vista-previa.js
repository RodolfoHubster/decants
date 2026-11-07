/**
 * vista-previa.js — Worker de Cloudflare: que el link de un perfume se vea con
 * su foto, nombre y precio al mandarlo por WhatsApp, Facebook, Telegram, etc.
 *
 * Por qué hace falta: GitHub Pages solo sirve archivos fijos. producto.html es
 * el mismo archivo para todos los perfumes y los que arman la vista previa
 * (WhatsApp, Facebook) no corren JavaScript, así que siempre veían el logo.
 *
 * Este Worker vive en ver.fitoscents.com:
 *   - A WhatsApp & cía. les contesta una página con los datos del perfume
 *     (leídos de Firestore, que es de lectura pública).
 *   - A las personas las manda directo a la tienda:
 *       ver.fitoscents.com/afnan-9pm-elixir → fitoscents.com/producto.html?p=afnan-9pm-elixir
 *
 * Es un solo archivo sin imports para pegarlo tal cual en el editor de
 * Cloudflare (Workers & Pages → tu worker → Edit code). Las funciones
 * exportadas tienen tests en tests/vista-previa.test.js.
 */

const PROYECTO = 'decants-b3470';
const TIENDA = 'https://fitoscents.com/';
const LOGO = `${TIENDA}assets/img/LogoOficial2.jpeg`;
const CLOUDINARY = 'https://res.cloudinary.com/dxo761td7/image/upload/';
const CAMPOS = ['nombre', 'marca', 'imagen', 'precios', 'descripcion', 'activo', 'archivado', 'inspiradoEn'];
const CACHE_SEG = 600;   // Firestore se consulta a lo mucho cada 10 min por centro de datos

// Los que arman vistas previas. A cualquier otro (una persona) se le redirige.
const BOTS = /whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|pinterest|skypeuripreview|applebot|googlebot|bingbot|snapchat|viber|line\/|redditbot|embedly|iframely|vkshare|tumblr|mastodon|bluesky|preview/i;

/** Igual que slug.js → toSlug (aquí no hay imports). */
export function toSlug(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Igual que slug.js → slugDe: marca + nombre. */
export const slugDe = p => toSlug([p && p.marca, p && p.nombre].filter(Boolean).join(' '));

/** Un valor de la API REST de Firestore → valor normal de JS. */
export function valor(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return campos(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  return null;
}

export const campos = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, valor(v)]));

/** El perfume (o paquete) visible en la tienda con ese slug. */
export function buscar(items, slug) {
  return (items || []).find(p => p.activo !== false && p.archivado !== true && slugDe(p) === slug) || null;
}

/** Tallas a la venta, de chica a grande (un precio vacío = no se vende). */
export function tallasDe(precios, { disable2ml = false } = {}) {
  return Object.entries(precios || {})
    .filter(([k, v]) => Number(v) > 0 && !(disable2ml && String(k) === '2'))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => ({ ml: String(k), precio: Number(v) }));
}

/** La primera parte de la descripción, antes de "Salida: …" / "Notas: …". */
export function fraseDe(descripcion) {
  const frase = [];
  for (const l of String(descripcion || '').replace(/\r/g, '').split('\n').map(x => x.trim())) {
    if (/^[^:]{3,14}:\s*\S/.test(l)) break;
    if (l) frase.push(l);
  }
  return frase.join(' ');
}

const unirConY = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : (xs[0] || ''));

/** Foto 1200×630 completa (sin recortar el frasco), en JPG: lo que mejor toma WhatsApp. */
export function fotoVistaPrevia(url) {
  if (!url) return LOGO;
  if (!url.startsWith(CLOUDINARY)) return url;
  // Si ya trae transformaciones, se reemplazan (igual que cloudinary.js).
  let resto = url.slice(CLOUDINARY.length);
  if (/^[^/]+,[^/]+\//.test(resto) || /^[a-z_]+:[^/]+\//.test(resto)) resto = resto.replace(/^[^/]+\//, '');
  return `${CLOUDINARY}w_1200,h_630,c_pad,b_auto,f_jpg,q_auto/${resto}`;
}

/** Título, descripción e imagen de la vista previa. */
export function vistaDe(p, opciones = {}) {
  const tallas = tallasDe(p.precios, opciones);
  const titulo = [p.nombre, p.marca].filter(Boolean).join(' · ');
  const partes = [];
  if (tallas.length) {
    const desde = Math.min(...tallas.map(t => t.precio));
    partes.push(`${p.esPaquete ? 'Paquete' : 'Decant original'} desde $${desde} · ${unirConY(tallas.map(t => t.ml))} ml`);
  }
  const frase = fraseDe(p.descripcion);
  const insp = p.inspiradoEn && p.inspiradoEn.nombre;
  // Si la frase ya empieza con "Inspirado en…", no se repite.
  if (insp && !/^inspirad[oa] en/i.test(frase)) partes.push(`Inspirado en ${insp}`);
  let descripcion = partes.join(' · ');
  if (frase) descripcion += `${descripcion ? '. ' : ''}${frase}`;
  if (descripcion.length > 200) descripcion = `${descripcion.slice(0, 197).replace(/\s+\S*$/, '')}…`;
  return { titulo: titulo || 'Fito Scents', descripcion, imagen: fotoVistaPrevia(p.imagen) };
}

export const escapar = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** La página que leen WhatsApp & cía. */
export function paginaVistaPrevia(p, { aqui, destino, disable2ml = false }) {
  const v = vistaDe(p, { disable2ml });
  const e = escapar;
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(v.titulo)} — Fito Scents</title>
<meta name="description" content="${e(v.descripcion)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Fito Scents">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="${e(v.titulo)}">
<meta property="og:description" content="${e(v.descripcion)}">
<meta property="og:image" content="${e(v.imagen)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(v.titulo)}">
<meta property="og:url" content="${e(aqui)}">
<meta name="twitter:card" content="summary_large_image">
</head><body style="font-family:system-ui,sans-serif;background:#111;color:#eee;text-align:center;padding:40px 16px">
<p><a href="${e(destino)}" style="color:#c9a84c">Ver ${e(v.titulo)} en Fito Scents</a></p>
</body></html>`;
}

async function traerColeccion(nombre) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents/${nombre}`;
  const mascara = CAMPOS.map(c => `mask.fieldPaths=${c}`).join('&');
  const items = [];
  let pagina = '';
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const r = await fetch(`${base}?pageSize=300&${mascara}${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`,
      { cf: { cacheTtl: CACHE_SEG, cacheEverything: true } });
    if (!r.ok) break;
    const j = await r.json();
    for (const d of j.documents || []) items.push({ id: d.name.split('/').pop(), ...campos(d.fields) });
    if (!j.nextPageToken) break;
    pagina = j.nextPageToken;
  }
  return items;
}

async function traerTienda() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents/config/tienda`;
  try {
    const r = await fetch(url, { cf: { cacheTtl: CACHE_SEG, cacheEverything: true } });
    return r.ok ? campos((await r.json()).fields) : {};
  } catch {
    return {};
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let ruta = url.pathname;
    try { ruta = decodeURIComponent(ruta); } catch { /* % suelto: se usa tal cual */ }
    const slug = toSlug(ruta.replace(/^\/+|\/+$/g, '').split('/').pop());
    if (!slug) return Response.redirect(TIENDA, 302);
    const destino = `${TIENDA}producto.html?p=${encodeURIComponent(slug)}`;

    // Personas: directo a la tienda, sin esperar a Firestore.
    if (!BOTS.test(request.headers.get('user-agent') || '')) return Response.redirect(destino, 302);

    const [perfumes, paquetes, tienda] = await Promise.all([
      traerColeccion('perfumes'),
      traerColeccion('paquetes').then(ps => ps.map(p => ({ ...p, esPaquete: true }))),
      traerTienda(),
    ]);
    const p = buscar([...perfumes, ...paquetes], slug);
    if (!p) return Response.redirect(destino, 302);

    const html = paginaVistaPrevia(p, { aqui: `${url.origin}/${slug}`, destino, disable2ml: !!tienda.disable2ml });
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': `public, max-age=${CACHE_SEG}` },
    });
  },
};
