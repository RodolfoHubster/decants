/**
 * ia-completos.js — Prompt y lectura de la respuesta de la IA para dar de alta
 * un perfume COMPLETO (botella original sellada). Sin DOM.
 *
 * El prompt viejo pedía una reseña "poética" y precios para todas las tallas
 * con ejemplos genéricos ("1500 diseñador"): inventaba tallas que no existen
 * y precios disparatados. Aquí la IA dice qué presentaciones existen de
 * verdad, el precio de mercado en México y uno sugerido; los precios que se
 * salen de un rango razonable se descartan en vez de llenarse.
 */
import { normOpcion, emparejarOpcion } from './ia-perfume.js';

export const TALLAS_COMPLETO = ['30', '50', '75', '100', '150', '200'];

/**
 * Rango razonable (MXN) de una botella de 100 ml original sellada en México.
 * Las otras tallas se escalan con FACTOR_TALLA. Es un filtro contra disparates,
 * no un precio: lo que caiga fuera se descarta.
 */
export const RANGO_100 = {
  'arabe': [300, 2500],
  'disenador': [900, 6500],
  'nicho': [2500, 20000],
};
export const FACTOR_TALLA = { 30: 0.45, 50: 0.65, 75: 0.85, 100: 1, 150: 1.3, 200: 1.55 };

const CATEGORIAS = { 'arabe': 'Árabe', 'disenador': 'Diseñador', 'nicho': 'Nicho' };
/** La IA suele escribir la concentración larga; el formulario usa la corta. */
const CORTAS = {
  'eau de parfum': 'EDP', 'eau de parfum intense': 'EDP', 'eau de toilette': 'EDT',
  'eau de cologne': 'EDC', 'cologne': 'EDC', 'colonia': 'EDC',
  'extrait de parfum': 'Parfum', 'extrait': 'Parfum', 'perfume': 'Parfum',
  'attar': 'Oil', 'aceite': 'Oil', 'perfume oil': 'Oil',
};
const LONGEVIDAD = ['baja', 'moderada', 'duradera', 'muy-duradera', 'eterna'];
const PROYECCION = ['intima', 'moderada', 'pesada', 'enorme'];

/** Clave normalizada de la categoría ('arabe' | 'disenador' | 'nicho') o ''. */
export function claveCategoria(texto) {
  const t = normOpcion(texto);
  if (!t) return '';
  if (t.includes('arab')) return 'arabe';
  if (t.includes('nich') || t.includes('niche')) return 'nicho';
  if (t.includes('disen') || t.includes('design')) return 'disenador';
  return '';
}

/** ¿El precio tiene sentido para esa categoría y talla? Sin categoría usa el rango más amplio. */
export function precioRazonable(precio, ml, categoria) {
  const n = Number(precio);
  const f = FACTOR_TALLA[Number(ml)];
  if (!Number.isFinite(n) || n <= 0 || !f) return false;
  const [min, max] = RANGO_100[categoria] || [RANGO_100.arabe[0], RANGO_100.nicho[1]];
  return n >= min * f && n <= max * f;
}

/** Redondea a decenas, como se escriben los precios en la tienda. */
const decenas = n => Math.round(Number(n) / 10) * 10;

/**
 * Lista corta de los precios que ya maneja el negocio, para que la IA se alinee.
 * @param {Array<{nombre:string,marca?:string,precios?:Object}>} completos
 */
export function referenciasDe(completos, max = 12) {
  return (completos || [])
    .map(p => {
      const tallas = TALLAS_COMPLETO
        .filter(t => Number(p?.precios?.[`px${t}`]) > 0)
        .map(t => `${t} ml $${Number(p.precios[`px${t}`])}`);
      return tallas.length ? `- ${[p.marca, p.nombre].filter(Boolean).join(' ')}: ${tallas.join(', ')}` : '';
    })
    .filter(Boolean)
    .slice(0, max);
}

/** El prompt. `referencias` son líneas de referenciasDe(). */
export function construirPromptCompleto({ nombre = '', marcaPista = '', concentraciones, referencias = [] } = {}) {
  const quien = `Perfume: "${nombre}"${marcaPista ? ` (la marca indicada es "${marcaPista}")` : ''}.`;
  const conc = (concentraciones && concentraciones.length ? concentraciones : ['EDP', 'EDT', 'EDC', 'Parfum', 'Elixir', 'Oil']).join(', ');
  const refs = referencias.length
    ? `\nPRECIOS QUE YA MANEJA EL NEGOCIO (úsalos como referencia de nivel; son de venta al cliente):\n${referencias.join('\n')}\n`
    : '';

  return `
Eres el encargado de precios y fichas de una tienda de perfumes ORIGINALES en
Tijuana, México. Vende botellas completas, nuevas y selladas, al cliente final
por WhatsApp. Compite con Mercado Libre, Amazon México y Liverpool.
${quien}

Devuelve SOLO un JSON válido, sin markdown ni explicaciones.

REGLAS IMPORTANTES:
- Busca el perfume EXACTO (misma marca, mismo nombre y misma concentración).
  No lo confundas con flankers: "Sauvage" no es "Sauvage Elixir", "Aqua" no es
  "Odyssey Homme". Si dudas entre dos versiones, pon confianza "baja".
- "category": Árabe si la casa es árabe (Lattafa, Armaf, Rasasi, Afnan,
  Al Haramain, Ard Al Zaafaran, Maison Alhambra, French Avenue...); Nicho si es
  casa de nicho (Creed, Parfums de Marly, Initio, Xerjoff, Maison Francis
  Kurkdjian, Amouage...); si no, Diseñador. "brand" coherente con category.
- "presentaciones": SOLO los tamaños en ml que este perfume trae de fábrica
  (de esta lista: 30, 50, 75, 100, 150, 200). No inventes tamaños; si una casa
  árabe solo lo hace en 100 ml, pon solo 100. Un tamaño parecido cuenta como el
  más cercano (105 ml → 100, 125 ml → 100).
- "precios": por cada presentación, dos números enteros en pesos mexicanos:
  · "mercado": lo que cuesta HOY la botella original sellada en México
    (Mercado Libre de vendedores bien calificados o Amazon México). Nada de
    testers, decants, réplicas ni "inspirados en". Si solo lo ves en Liverpool
    o la tienda oficial (precio completo), usa ese.
  · "sugerido": precio para que esta tienda venda rápido: igual o un poco
    abajo del de mercado, redondeado a decenas.
  Niveles normales de una botella de 100 ml: árabe $500–$1,500; diseñador
  $1,500–$4,500; nicho $4,000 en adelante. Si tu cifra se sale mucho de eso,
  revísala. Si no encuentras precio confiable, deja ese tamaño fuera.
- "concentration": copia EXACTO una de: ${conc}.
- Si no conoces el perfume con seguridad, NO inventes: confianza "baja" y deja
  vacío lo que no sepas. Es preferible un campo vacío a un dato falso.
${refs}
{
  "title": "Nombre exacto y completo del perfume",
  "brand": "Casa que lo fabrica",
  "category": "Árabe, Diseñador o Nicho",
  "gender": "Caballero, Dama o Unisex",
  "concentration": "Una de: ${conc}",
  "salida": "3-4 notas de salida separadas por coma",
  "corazon": "3-4 notas de corazón separadas por coma",
  "fondo": "3-4 notas de fondo separadas por coma",
  "ocasion": "Corto, ej. Diario y oficina · clima cálido",
  "longevity": "Exactamente una de: ${LONGEVIDAD.join(', ')}",
  "sillage": "Exactamente una de: ${PROYECCION.join(', ')}",
  "desc": "1 o 2 frases sobrias: a qué huele, qué proyecta y a quién le queda. Sin poesía ni exageraciones.",
  "presentaciones": [100],
  "precios": { "100": { "mercado": 0, "sugerido": 0 } },
  "confianza": "alta, media o baja según lo seguro que estés de este perfume y sus precios"
}
`;
}

/**
 * Convierte la respuesta en valores listos para el formulario.
 * Los precios fuera de rango o de tallas que no vienen en "presentaciones" se
 * descartan y quedan en `descartados` para avisar.
 *
 * @param {Object} ai  JSON de la IA (ya parseado)
 * @param {{concentraciones?: Array<{value:string,text?:string}>}} [opts]
 */
export function interpretarCompleto(ai, { concentraciones = [] } = {}) {
  const r = ai || {};
  const txt = v => (typeof v === 'string' ? v.trim() : '');
  const categoria = claveCategoria(r.category);
  const elegir = (lista, v) => { const n = normOpcion(v).replace(/ /g, '-'); return lista.includes(n) ? n : ''; };

  const tallas = new Set((Array.isArray(r.presentaciones) ? r.presentaciones : [])
    .map(t => String(parseInt(t, 10))).filter(t => TALLAS_COMPLETO.includes(t)));

  const precios = {};
  const descartados = [];
  const crudos = r.precios && typeof r.precios === 'object' ? r.precios : {};
  for (const [clave, val] of Object.entries(crudos)) {
    const ml = String(parseInt(String(clave).replace(/\D/g, ''), 10));
    if (!TALLAS_COMPLETO.includes(ml)) continue;
    const mercado = decenas(val?.mercado);
    const sugerido = decenas(val?.sugerido || val?.mercado);
    if (tallas.size && !tallas.has(ml)) { descartados.push({ ml, razon: 'esa talla no existe' }); continue; }
    if (!precioRazonable(sugerido, ml, categoria)) { descartados.push({ ml, razon: 'precio fuera de rango', sugerido }); continue; }
    precios[ml] = { mercado: precioRazonable(mercado, ml, categoria) ? mercado : 0, sugerido };
  }

  const conf = normOpcion(r.confianza);
  return {
    titulo: txt(r.title),
    marca: txt(r.brand),
    categoria: CATEGORIAS[categoria] || '',
    genero: ['Caballero', 'Dama', 'Unisex'].find(g => normOpcion(g) === normOpcion(r.gender)) || '',
    concentracion: emparejarOpcion(concentraciones, CORTAS[normOpcion(r.concentration)] || r.concentration) || '',
    salida: txt(r.salida),
    corazon: txt(r.corazon),
    fondo: txt(r.fondo),
    ocasion: txt(r.ocasion),
    longevidad: elegir(LONGEVIDAD, r.longevity),
    proyeccion: elegir(PROYECCION, r.sillage),
    desc: txt(r.desc),
    precios,
    descartados,
    confianza: ['alta', 'media', 'baja'].includes(conf) ? conf : 'media',
  };
}
