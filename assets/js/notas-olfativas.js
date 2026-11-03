/**
 * notas-olfativas.js — Qué significa cada nota de la pirámide olfativa. Sin DOM.
 *
 * La tienda muestra un globito al pasar el cursor (o tocar, en el teléfono)
 * sobre una nota: a qué huele y qué le aporta al perfume. Las notas vienen
 * escritas a mano o por la IA ("Vainilla bourbon", "Madera de cedro",
 * "Notas amaderadas"), así que se busca por partes:
 *
 *   1. La nota tal cual (sin acentos ni mayúsculas) o un alias.
 *   2. La nota conocida más larga que aparezca dentro: "vainilla bourbon" → vainilla,
 *      "flor de azahar del naranjo" → flor de azahar.
 *   3. Su familia: "notas amaderadas", "maderas secas", "acorde marino"...
 *
 * Si nada se parece devuelve null y la nota se muestra sin globito.
 */

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** clave normalizada → [tipo, qué es y qué aporta] */
export const NOTAS = {
  // ── Cítricos ──
  'bergamota': ['Cítrico', 'Cítrico italiano entre limón y naranja, con un toque floral y amargo. Abre el perfume con una frescura elegante.'],
  'limon': ['Cítrico', 'Ácido, chispeante y limpio. Da una primera impresión fresca y llena de energía.'],
  'mandarina': ['Cítrico', 'Dulce y jugosa, más suave que la naranja. Aporta alegría y una salida luminosa.'],
  'naranja': ['Cítrico', 'Jugosa y dulce, como pelar una naranja. Transmite alegría y cercanía.'],
  'toronja': ['Cítrico', 'Amarga y fresca. Despierta los sentidos y da un aire moderno y deportivo.'],
  'lima': ['Cítrico', 'Verde, ácida y vibrante. Refresca al instante; ideal para el calor.'],
  'yuzu': ['Cítrico', 'Cítrico japonés entre toronja y mandarina, muy aromático. Da una frescura sofisticada.'],
  'chinotto': ['Cítrico', 'Naranja amarga italiana con un fondo resinoso. Fresca y diferente.'],
  'petitgrain': ['Cítrico', 'Hojas y ramitas del naranjo: verde, amaderado y algo amargo. Huele a colonia clásica.'],
  'citricos': ['Cítrico', 'Limón, naranja y bergamota juntos: frescos y alegres. Dan limpieza inmediata.'],

  // ── Frutas ──
  'manzana': ['Fruta', 'Crujiente y jugosa, entre dulce y ácida. Aporta frescura fácil de llevar y un aire juvenil.'],
  'pera': ['Fruta', 'Jugosa, dulce y acuosa. Da suavidad y un toque fresco y luminoso.'],
  'pina': ['Fruta', 'Tropical, dulce y ácida; la firma de los perfumes tipo Aventus. Aporta energía y brillo.'],
  'grosella negra': ['Fruta', 'Cassis: afrutada, ácida y un poco verde. Da un toque jugoso y vibrante.'],
  'ciruela': ['Fruta', 'Oscura, madura y dulce. Aporta profundidad y sensualidad.'],
  'coco': ['Fruta', 'Cremoso, lechoso y tropical. Evoca playa y piel bronceada.'],
  'durazno': ['Fruta', 'Aterciopelado, dulce y jugoso. Aporta suavidad y calidez.'],
  'frutos rojos': ['Fruta', 'Fresa, frambuesa y moras: dulces y un poco ácidos. Dan alegría y un toque coqueto.'],
  'frutos silvestres': ['Fruta', 'Moras y bayas del bosque: dulces, ácidas y jugosas.'],
  'cereza': ['Fruta', 'Dulce y jugosa, con un matiz de almendra. Aporta un aire seductor y goloso.'],
  'lichi': ['Fruta', 'Tropical, floral y jugoso; recuerda a la rosa. Da una frescura dulce y exótica.'],
  'pitahaya': ['Fruta', 'Fruta del dragón: suave, acuosa y ligeramente dulce. Frescura exótica.'],
  'higo': ['Fruta', 'Lechoso, dulce y un poco verde. Evoca el Mediterráneo en verano.'],
  'melon': ['Fruta', 'Acuoso, fresco y dulce. Da sensación de verano.'],
  'sandia': ['Fruta', 'Acuosa y dulce, muy refrescante. Da un aire veraniego.'],
  'fresa': ['Fruta', 'Dulce y jugosa, casi de caramelo. Aporta un toque juguetón.'],
  'frambuesa': ['Fruta', 'Dulce, ácida y un poco floral. Da chispa y alegría.'],
  'mora': ['Fruta', 'Oscura, jugosa y ácida. Aporta un toque afrutado profundo.'],
  'mango': ['Fruta', 'Tropical, jugoso y dulce. Da un aire exótico y alegre.'],
  'maracuya': ['Fruta', 'Ácido, tropical y perfumado. Aporta frescura vibrante.'],
  'guayaba': ['Fruta', 'Dulce, tropical y un poco verde. Da un toque afrutado muy mexicano.'],
  'papaya': ['Fruta', 'Tropical, suave y cremosa. Aporta dulzor fresco.'],
  'kiwi': ['Fruta', 'Ácido, verde y jugoso. Da frescura chispeante.'],
  'granada': ['Fruta', 'Ácida, jugosa y un poco astringente. Aporta un brillo afrutado.'],
  'albaricoque': ['Fruta', 'Chabacano: aterciopelado, dulce y algo floral. Da calidez.'],
  'datiles': ['Fruta', 'Dulces, melosos y oscuros, muy de la perfumería árabe. Aportan un fondo goloso.'],
  'ruibarbo': ['Fruta', 'Ácido, verde y crujiente. Da una frescura original.'],
  'frutas tropicales': ['Fruta', 'Mango, piña y maracuyá: dulces y jugosas. Ambiente de vacaciones.'],
  'notas frutales': ['Fruta', 'Frutas jugosas y dulces que dan alegría y frescura.'],
  'hoja de higuera': ['Verde', 'Verde, lechosa y con un toque de coco. Evoca el Mediterráneo.'],
  'frutas confitadas': ['Fruta', 'Fruta cocida en azúcar: dulce, densa y golosa.'],

  // ── Flores ──
  'jazmin': ['Flor', 'Flor blanca intensa, dulce y sensual. Aporta elegancia y seducción.'],
  'rosa': ['Flor', 'La reina de las flores: aterciopelada, romántica y algo afrutada. Da clase.'],
  'iris': ['Flor', 'Polvoso, elegante y frío, como talco fino o lápiz labial. Es de las materias más caras.'],
  'lirio': ['Flor', 'Polvoso y elegante, como talco fino o lápiz labial. Aporta sofisticación.'],
  'lirio de los valles': ['Flor', 'Muguet: fresco, verde y limpio, como primavera. Da delicadeza.'],
  'geranio': ['Flor', 'Floral verde con matiz de rosa y menta. Da una frescura limpia; muy usado en caballero.'],
  'flor de azahar': ['Flor', 'Flor del naranjo: blanca, dulce y luminosa, con un toque de miel. Limpia y sensual.'],
  'neroli': ['Flor', 'Flor del naranjo destilada: fresca, verde y un poco amarga. Limpia y muy mediterránea.'],
  'violeta': ['Flor', 'Polvosa y dulce, un poco retro. Aporta delicadeza.'],
  'hoja de violeta': ['Verde', 'Verde y fresca, casi como pepino. Da un aire moderno; muy usada en caballero.'],
  'tuberosa': ['Flor', 'Blanca, cremosa y embriagadora. Muy sensual y llamativa.'],
  'peonia': ['Flor', 'Fresca, rosada y ligera. Da un aire juvenil y alegre.'],
  'gardenia': ['Flor', 'Blanca, cremosa y verde. Elegante y romántica.'],
  'ylang ylang': ['Flor', 'Exótica, cremosa y algo afrutada. Aporta sensualidad tropical.'],
  'flores blancas': ['Flor', 'Jazmín, azahar y tuberosa: luminosas, limpias y sensuales.'],
  'magnolia': ['Flor', 'Floral cremoso con un toque cítrico. Fresca y elegante.'],
  'orquidea': ['Flor', 'Floral suave, cremoso y un poco dulce. Da un aire exótico.'],
  'flor de loto': ['Flor', 'Floral acuático, limpio y sereno. Aporta calma y frescura.'],
  'nenufar': ['Flor', 'Flor de agua: fresca, verde y limpia. Transmite calma.'],
  'heliotropo': ['Flor', 'Polvoso, con aroma a almendra y vainilla. Suave y nostálgico.'],
  'osmanto': ['Flor', 'Floral con olor a chabacano y un toque de cuero. Elegante y diferente.'],
  'mimosa': ['Flor', 'Polvosa, dulce y con matiz de miel. Suave y luminosa.'],
  'fresia': ['Flor', 'Floral fresco, limpio y un poco afrutado. Ligera y alegre.'],
  'frangipani': ['Flor', 'Flor tropical cremosa y dulce, con un toque de coco. Huele a vacaciones.'],
  'plumeria': ['Flor', 'Flor tropical cremosa y dulce, con un toque de coco. Huele a vacaciones.'],
  'narciso': ['Flor', 'Floral verde, intenso y un poco animal. Da carácter.'],
  'clavel': ['Flor', 'Floral especiado con aroma a clavo. Cálido y clásico.'],
  'madreselva': ['Flor', 'Floral dulce con matiz de miel. Suave y veraniega.'],
  'campanilla': ['Flor', 'Floral fresco, verde y acuoso. Ligera y delicada.'],
  'amapola': ['Flor', 'Floral suave, polvoso y ligeramente dulce.'],
  'flor de manzano': ['Flor', 'Floral fresco con un toque afrutado. Primaveral.'],
  'flor de jengibre': ['Flor', 'Floral fresco y especiado, con un toque cítrico.'],

  // ── Hierbas aromáticas ──
  'lavanda': ['Hierba aromática', 'Floral y herbal, limpia como ropa recién lavada. Transmite calma; es el corazón de muchos perfumes clásicos de caballero.'],
  'salvia': ['Hierba aromática', 'Herbal, un poco amaderada y ambarada. Da un aire masculino, limpio y relajado.'],
  'menta': ['Hierba aromática', 'Fresca y helada. Despierta y da sensación de limpieza inmediata.'],
  'romero': ['Hierba aromática', 'Herbal, alcanforado y fresco. Aporta energía y un aire mediterráneo.'],
  'artemisa': ['Hierba aromática', 'Amarga, verde y aromática. Da carácter y un toque silvestre.'],
  'enebro': ['Hierba aromática', 'Fresco y resinoso; recuerda a la ginebra. Da un aire limpio y vigorizante.'],
  'hoja de laurel': ['Hierba aromática', 'Herbal y ligeramente especiada. Aporta un toque fresco y seco.'],
  'mirto': ['Hierba aromática', 'Herbal, fresco y un poco alcanforado. Aire mediterráneo.'],
  'hinojo': ['Hierba aromática', 'Dulce y anisado, entre verde y especiado.'],
  'anis': ['Especia', 'Dulce, con sabor a regaliz. Aporta un toque cálido y original.'],
  'absenta': ['Hierba aromática', 'Amarga, verde y herbal, como el licor. Da un aire misterioso.'],
  'davana': ['Hierba aromática', 'Herbal con matiz afrutado y alcoholado. Cálida y diferente.'],
  'calamo': ['Hierba aromática', 'Raíz verde, especiada y un poco amaderada.'],
  'te verde': ['Hierba aromática', 'Fresco, verde y limpio. Transmite calma y ligereza.'],
  'notas aromaticas': ['Hierba aromática', 'Mezcla de hierbas como lavanda, romero y salvia: fresca, limpia y masculina.'],

  // ── Especias ──
  'cardamomo': ['Especia', 'Especia verde y fresca, ligeramente cítrica. Da un toque elegante y vibrante sin picar.'],
  'jengibre': ['Especia', 'Picante y fresco a la vez, con chispa cítrica. Aporta energía.'],
  'canela': ['Especia', 'Dulce, cálida y acogedora, como pan recién horneado. Da calidez y un toque goloso.'],
  'pimienta rosa': ['Especia', 'Picante suave, afrutada y rosada. Da chispa sin agresividad.'],
  'pimienta negra': ['Especia', 'Seca, picante y amaderada. Aporta carácter y un toque masculino.'],
  'nuez moscada': ['Especia', 'Cálida, dulce y un poco amaderada. Da calidez y profundidad.'],
  'azafran': ['Especia', 'Entre cuero, miel y metal; muy de la perfumería árabe. Da lujo y misterio.'],
  'pimienta de sichuan': ['Especia', 'Picante cítrico y eléctrico. Aporta frescura vibrante.'],
  'pimienta de jamaica': ['Especia', 'Entre clavo, canela y pimienta. Cálida y especiada.'],
  'pimenton': ['Especia', 'Picante cálido y un poco ahumado.'],
  'especias': ['Especia', 'Canela, clavo y nuez moscada: cálidas, envolventes y sensuales. Ideales para el frío y la noche.'],

  // ── Maderas ──
  'cedro': ['Madera', 'Seco y limpio, como lápiz recién afilado. Da estructura y elegancia.'],
  'sandalo': ['Madera', 'Cremoso, suave y lechoso. Aporta calidez sensual y mucha permanencia.'],
  'vetiver': ['Madera', 'Raíz terrosa, ahumada y verde. Da elegancia, sobriedad y un aire muy limpio.'],
  'pachuli': ['Madera', 'Terroso, oscuro y un poco dulce, como tierra húmeda. Da profundidad y permanencia.'],
  'madera de cachemira': ['Madera', 'Suave, cálida y almizclada, como un suéter de cachemira. Da una sensación acogedora.'],
  'cashmeran': ['Madera', 'Suave, cálida y almizclada, como un suéter de cachemira. Da una sensación acogedora.'],
  'madera de guayaco': ['Madera', 'Ahumada, suave y un poco dulce. Aporta calidez.'],
  'oud': ['Madera', 'Madera de agar: oscura, ahumada e intensa. El lujo árabe por excelencia.'],
  'abedul': ['Madera', 'Ahumado, a cuero y fogata. Da un aire rudo y masculino.'],
  'cipres': ['Madera', 'Resinoso, verde y fresco. Da sensación de bosque.'],
  'papiro': ['Madera', 'Seco, amaderado y un poco ahumado. Elegancia sobria.'],
  'akigalawood': ['Madera', 'Pachulí moderno con matiz de pimienta y oud. Profundidad especiada.'],
  'palo santo': ['Madera', 'Amaderado, resinoso y un poco cítrico, como incienso suave.'],
  'ebano': ['Madera', 'Madera oscura, seca y elegante.'],
  'caoba': ['Madera', 'Madera cálida, seca y elegante.'],
  'palo de rosa': ['Madera', 'Amaderado con matiz floral de rosa. Suave y elegante.'],
  'madera flotante': ['Madera', 'Madera seca con un toque salino, como la que arrastra el mar.'],
  'bambu': ['Verde', 'Verde, acuoso y limpio. Da frescura natural.'],
  'maderas': ['Madera', 'Cedro, sándalo y vetiver: secos, cálidos y elegantes. Dan estructura y permanencia.'],

  // ── Resinas y bálsamos ──
  'incienso': ['Resina', 'Resina ahumada y fresca, con matiz cítrico; recuerda a iglesia. Da misterio y elegancia.'],
  'benjui': ['Resina', 'Dulce y balsámica, entre vainilla y canela. Aporta calidez envolvente.'],
  'ladano': ['Resina', 'Resina ambarada, cálida y un poco animal. Da sensualidad; es la base del ámbar.'],
  'elemi': ['Resina', 'Fresca, alimonada y resinosa. Aporta luminosidad.'],
  'mirra': ['Resina', 'Balsámica, amarga y misteriosa.'],
  'almaciga': ['Resina', 'Fresca, resinosa y un poco pinosa.'],
  'abeto': ['Resina', 'Pino y bosque: resinoso, dulce y navideño.'],
  'notas balsamicas': ['Resina', 'Resinas dulces y cálidas, entre vainilla y canela. Envolventes.'],

  // ── Ámbar, almizcles y moléculas ──
  'ambar': ['Ámbar', 'No es la piedra: es una mezcla cálida de resinas y vainilla. Da calidez, dulzor y mucha permanencia.'],
  'ambar gris': ['Ámbar', 'Salino, cálido y un poco animal. Da un efecto de piel limpia y mucha estela.'],
  'ambroxan': ['Molécula', 'Versión moderna del ámbar gris: amaderada, salina y mineral. Da una estela enorme; es la firma de Sauvage.'],
  'madera de ambar': ['Molécula', 'Amaderado ambarado, seco y potente. Da proyección y un aire moderno.'],
  'almizcle': ['Almizcle', 'Suave y limpio, como piel recién bañada. Fija el perfume y le da un efecto sensual y cercano.'],
  'ambreta': ['Almizcle', 'Almizcle vegetal, suave y un poco afrutado. Sensualidad limpia.'],
  'calypsone': ['Molécula', 'Acuática, con aroma a melón y brisa marina. Da frescura.'],
  'aldehidos': ['Molécula', 'Efervescentes, jabonosos y brillantes. Dan limpieza y luminosidad.'],

  // ── Gourmand ──
  'vainilla': ['Gourmand', 'Dulce, cremosa y cálida. Da sensualidad y confort; hace que el perfume se sienta abrazador.'],
  'haba tonka': ['Gourmand', 'Semilla de olor dulce entre vainilla, almendra y tabaco. Aporta calidez y un fondo adictivo.'],
  'caramelo': ['Gourmand', 'Azúcar tostada, dulce y golosa. Da un toque juguetón y seductor.'],
  'praline': ['Gourmand', 'Almendra o avellana caramelizada: dulce, tostada y adictiva.'],
  'chocolate': ['Gourmand', 'Oscuro, amargo-dulce y cálido. Aporta sensualidad golosa.'],
  'cacao': ['Gourmand', 'Amargo, tostado y cálido. Da profundidad golosa sin empalagar.'],
  'cafe': ['Gourmand', 'Tostado, amargo y energizante. Da un aire nocturno y seductor.'],
  'malvavisco': ['Gourmand', 'Bombón: dulce, suave y esponjoso. Tierno y goloso.'],
  'crema batida': ['Gourmand', 'Cremosa, ligera y dulce. Aporta suavidad golosa.'],
  'toffee': ['Gourmand', 'Caramelo con mantequilla: dulce, denso y cálido.'],
  'azucar': ['Gourmand', 'Dulzor limpio, como algodón de azúcar o caramelo.'],
  'algodon de azucar': ['Gourmand', 'Dulce, esponjoso y de feria. Juguetón y llamativo.'],
  'miel': ['Gourmand', 'Dulce, cálida y un poco animal. Aporta sensualidad.'],
  'almendra': ['Gourmand', 'Dulce y un poco amarga, como mazapán. Cálida y reconfortante.'],
  'merengue': ['Gourmand', 'Dulce, aireado y azucarado.'],
  'panacota': ['Gourmand', 'Postre de crema y vainilla: lácteo, suave y dulce.'],
  'leche': ['Gourmand', 'Lácteo, cremoso y suave. Da una sensación reconfortante.'],
  'pistache': ['Gourmand', 'Tostado, cremoso y un poco salado. Goloso y diferente.'],
  'castana': ['Gourmand', 'Tostada, dulce y cálida. Muy otoñal.'],
  'frutos secos': ['Gourmand', 'Nueces y almendras tostadas: cálidos y golosos.'],
  'conac': ['Licor', 'Licor añejo, afrutado y amaderado. Da calidez y sofisticación.'],
  'whisky': ['Licor', 'Licor ahumado, amaderado y un poco dulce. Aire maduro y nocturno.'],
  'notas gourmand': ['Gourmand', 'Notas que huelen a postre: vainilla, caramelo, chocolate. Dulces y adictivas.'],

  // ── Cueros, musgos y otros ──
  'cuero': ['Cuero', 'Ahumado, seco y animal, como una chamarra de piel. Da carácter y lujo.'],
  'gamuza': ['Cuero', 'Cuero suave y aterciopelado: más limpio y elegante.'],
  'tabaco': ['Otro', 'Hojas secas, dulces y algo melosas. Da calidez y un aire maduro y sofisticado.'],
  'musgo de roble': ['Musgo', 'Terroso, húmedo y amaderado, como bosque tras la lluvia. Elegancia clásica.'],
  'musgo': ['Musgo', 'Terroso, húmedo y verde. Da profundidad natural.'],
  'trufa': ['Otro', 'Terrosa, oscura y un poco animal. Misteriosa.'],
  'pepino': ['Verde', 'Acuoso, verde y muy fresco. Da limpieza.'],
  'notas verdes': ['Verde', 'Hojas y tallos recién cortados: frescos, naturales y vivos.'],
  'notas marinas': ['Marino', 'Brisa de mar, sal y agua: frescas y limpias. Evocan la playa.'],
  'sal': ['Marino', 'Salina y mineral, como piel después del mar.'],
  'notas minerales': ['Marino', 'Piedra mojada y sal: frías, limpias y modernas.'],
  'notas ozonicas': ['Marino', 'Aire limpio, como después de la lluvia. Frescas y ligeras.'],
  'notas heladas': ['Marino', 'Efecto frío y helado que da una frescura inmediata.'],
  'notas atalcadas': ['Otro', 'Talco y polvo suave: delicadas y limpias.'],
  'acorde jabonoso': ['Otro', 'Huele a jabón limpio: fresco y pulcro.'],
};

/** Formas de escribir una nota que ya está en el diccionario con otro nombre. */
const ALIAS = {
  'limon siciliano': 'limon', 'pomelo': 'toronja', 'azahar': 'flor de azahar',
  'flor de naranjo': 'flor de azahar', 'olibano': 'incienso', 'ambrox': 'ambroxan',
  'ambrofix': 'ambroxan', 'tonka': 'haba tonka', 'haba de tonka': 'haba tonka',
  'batonca': 'haba tonka', 'pimienta': 'pimienta negra', 'lavandin': 'lavanda',
  'artemisia': 'artemisa', 'jara': 'ladano', 'loto': 'flor de loto',
  'orquidea de vainilla': 'vainilla', 'cassis': 'grosella negra', 'tangerina': 'mandarina',
  'muguet': 'lirio de los valles', 'chabacano': 'albaricoque',
};

/** Familias para las notas genéricas ("notas amaderadas", "acorde marino"...). */
const FAMILIAS = [
  [/\bacuati|\bacuos|\bmarin|\bsalin/, 'notas marinas'],
  [/\bozon/, 'notas ozonicas'],
  [/\bmineral/, 'notas minerales'],
  [/\bhelad/, 'notas heladas'],
  [/\bamaderad|\bmaderas?\b/, 'maderas'],
  [/\bespeciad|\bespecias?\b/, 'especias'],
  [/\baromatic/, 'notas aromaticas'],
  [/\bverdes?\b/, 'notas verdes'],
  [/\bbalsamic/, 'notas balsamicas'],
  [/\bambarad/, 'ambar'],
  [/\bgourmand|\bacaramelad/, 'notas gourmand'],
  [/\batalcad/, 'notas atalcadas'],
  [/\bjabon/, 'acorde jabonoso'],
  [/\bcitric/, 'citricos'],
  [/\bfrutal|\bfrutas?\b/, 'frutas tropicales'],
];

const CLAVES = Object.keys(NOTAS).sort((a, b) => b.length - a.length);

/** La clave del diccionario que corresponde a una nota, o '' si ninguna. */
export function claveNota(nombre) {
  const n = norm(nombre);
  if (!n) return '';
  if (NOTAS[n]) return n;
  if (ALIAS[n]) return ALIAS[n];
  // Primero alias contenidos ("orquídea de vainilla" no es una orquídea).
  const alias = Object.keys(ALIAS).sort((a, b) => b.length - a.length)
    .find(a => (` ${n} `).includes(` ${a} `));
  const clave = CLAVES.find(k => (` ${n} `).includes(` ${k} `));
  if (alias && (!clave || alias.length >= clave.length)) return ALIAS[alias];
  if (clave) return clave;
  const fam = FAMILIAS.find(([re]) => re.test(n));
  return fam ? fam[1] : '';
}

/** Qué significa una nota: { nombre, tipo, texto } o null si no se conoce. */
export function significadoNota(nombre) {
  const clave = claveNota(nombre);
  if (!clave) return null;
  const [tipo, texto] = NOTAS[clave];
  const n = String(nombre).trim();   // en la ficha a veces vienen en minúsculas
  return { nombre: n.charAt(0).toUpperCase() + n.slice(1), tipo, texto };
}
