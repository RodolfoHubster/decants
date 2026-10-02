/**
 * ia-perfume.js — Prompt y lectura de la respuesta de la IA para dar de alta
 * un perfume. Sin DOM.
 *
 * Antes había varias copias que se fueron desfasando: algunas seguían
 * pidiendo una reseña "poética" y asignaban familia y tipo solo si la IA
 * respondía el texto idéntico. Aquí hay un solo prompt y un solo emparejado.
 */

/** Normaliza para comparar: sin emojis, sin acentos, minúsculas, sin signos. */
export function normOpcion(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Formas en que la IA suele escribir algo que en el catálogo se llama distinto.
 * La clave y el valor van normalizados.
 */
export const ALIAS = {
  // concentraciones
  'edp': 'eau de parfum',
  'edt': 'eau de toilette',
  'edc': 'cologne',
  'eau de cologne': 'cologne',
  'extrait': 'extrait de parfum',
  'perfume': 'parfum',
  'eau de parfum intense': 'parfum intense',
  'intense': 'parfum intense',
  'oil': 'attar aceite',
  'aceite': 'attar aceite',
  'attar': 'attar aceite',
  'perfume oil': 'attar aceite',
  // familias (el catálogo las tiene en masculino)
  'citrica': 'citrico', 'amaderada': 'amaderado', 'aromatica': 'aromatico',
  'acuatica': 'marino', 'acuatico': 'marino', 'marina': 'marino',
  'especiada': 'especiado', 'almizclada': 'almizclado', 'aldehidica': 'aldehidico',
  'ambar': 'oriental', 'ambarado': 'oriental', 'ambarada': 'oriental',
  'oriental ambar': 'oriental', 'amber': 'oriental',
  'fougere aromatico': 'fougere', 'woody': 'amaderado', 'citrus': 'citrico',
  'floral frutal': 'floral', 'gourmand oriental': 'gourmand',
  // categorías
  'arabe': 'arabe', 'disenador': 'disenador', 'designer': 'disenador', 'niche': 'nicho',
};

/**
 * Elige el `value` de la opción que corresponde a la respuesta de la IA.
 *
 * Orden: coincidencia exacta → alias → la opción más parecida que contenga a
 * la otra. Esto último elige la de largo más cercano: "Parfum" no debe caer en
 * "Parfum Intense" ni en "Eau de Parfum" cuando "Parfum" existe tal cual.
 *
 * @param {Array<{value:string,text?:string}>} opciones  Sin el placeholder vacío.
 * @param {string} respuesta
 * @returns {string} value, o '' si nada se parece.
 */
export function emparejarOpcion(opciones, respuesta) {
  const lista = (opciones || []).filter(o => o && o.value);
  const r = normOpcion(respuesta);
  if (!r || !lista.length) return '';

  const claves = lista.map(o => ({ o, k: normOpcion(o.value), t: normOpcion(o.text || o.value) }));
  const exacta = q => claves.find(c => c.k === q || c.t === q);

  const directa = exacta(r);
  if (directa) return directa.o.value;

  const alias = ALIAS[r];
  if (alias) {
    const viaAlias = exacta(alias);
    if (viaAlias) return viaAlias.o.value;
  }

  // Parciales por palabras completas, para que "oud" no case con "cloud".
  const contiene = (a, b) => (` ${a} `).includes(` ${b} `);
  const parciales = claves
    .filter(c => contiene(c.k, r) || contiene(r, c.k) || contiene(c.t, r) || contiene(r, c.t))
    .sort((a, b) => Math.abs(a.k.length - r.length) - Math.abs(b.k.length - r.length));
  return parciales.length ? parciales[0].o.value : '';
}

const lista = (arr, respaldo) => (arr && arr.length ? arr.join(', ') : respaldo);

/** El prompt único. `marcaPista` es la marca si ya se conoce. */
export function construirPrompt({ nombre = '', marcaPista = '', categorias, familias, tipos } = {}) {
  const quien = `Perfume: "${nombre}"${marcaPista ? ` (la marca indicada es "${marcaPista}")` : ''}.`;

  return `
Eres un perfumista documentando fichas de producto. Sé preciso y sobrio.
${quien}

Devuelve SOLO un JSON válido, sin markdown ni explicaciones.

REGLAS IMPORTANTES:
- "category" y "brand" deben ser coherentes entre sí. Si la casa es árabe
  (Lattafa, Armaf, Rasasi, Afnan, Al Haramain, Ard Al Zaafaran...), entonces
  category = "Árabe" y brand debe ser esa casa árabe. Nunca mezcles una casa
  árabe con category "Diseñador" ni al revés.
- "type" es la CONCENTRACIÓN, no la categoría. Elige exactamente una de la
  lista dada. No pongas ahí "Diseñador" ni "Árabe".
- "family" y "type": copia el texto EXACTO de una opción de su lista.
- Si no conoces el perfume con seguridad, NO inventes: pon confianza "baja"
  y deja en blanco lo que no sepas. Es preferible un campo vacío a un dato falso.

{
  "title": "Nombre exacto y completo del perfume",
  "brand": "Casa que lo fabrica, coherente con category",
  "category": "Exactamente una de: ${lista(categorias, 'Diseñador, Árabe, Nicho')}",
  "gender": "Caballero, Dama o Unisex",
  "family": "Familia olfativa, exactamente una de: ${lista(familias, 'Cítrico, Floral, Amaderado, Oriental')}",
  "type": "Concentración, exactamente una de: ${lista(tipos, 'Eau de Toilette, Eau de Parfum, Parfum, Extrait de Parfum')}",
  "confianza": "alta, media o baja segun lo seguro que estes de este perfume en concreto",
  "desc": "Ficha en texto plano con saltos de linea reales, en este formato exacto y sin encabezados extra:\\n\\n<Una sola frase que defina la personalidad del perfume y a quien le queda: para que ocasion y que proyecta>\\n\\nSalida: <3-4 notas, lo que se huele en los primeros minutos>\\nCorazon: <3-4 notas, el cuerpo del aroma>\\nFondo: <3-4 notas, lo que permanece en piel y ropa>\\n\\nDuracion: <Baja (2-4 h) | Moderada (4-6 h) | Alta (mas de 8 h)> · Estela: <discreta | moderada | fuerte>\\nIdeal para: <Dia | Noche | Dia y noche> · <Clima calido | Clima frio | Todo el año>",
  "px2": "Precio competitivo MXN 2ml: 80-120 diseñador, 180-280 nicho, 50-90 árabe",
  "px3": "Precio competitivo MXN 3ml: 120-170 diseñador, 250-380 nicho, 70-110 árabe",
  "px5": "Precio competitivo MXN 5ml: 180-260 diseñador, 400-600 nicho, 110-170 árabe",
  "px10": "Precio competitivo MXN 10ml: 320-450 diseñador, 750-1200 nicho, 200-300 árabe"
}
`;
}

/** Saca el JSON de la respuesta, tolerando texto alrededor y caracteres de control. */
export function parsearRespuesta(texto) {
  let t = String(texto ?? '');
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  try {
    return JSON.parse(t);
  } catch {
    // eslint-disable-next-line no-control-regex -- justo lo que se quiere limpiar
    return JSON.parse(t.replace(/[\u0000-\u001F]+/g, ' '));
  }
}
