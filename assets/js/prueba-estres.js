/**
 * prueba-estres.js — Productos de mentira, con todo exagerado, para ver cómo
 * aguanta la tienda: muchos perfumes, muchas presentaciones, textos larguísimos.
 *
 * Solo se carga en Live Server con `?estres=1` (catalog.js lo revisa). No se
 * guarda en Firestore ni en la caché, y en el sitio real ni se descarga.
 * Módulo puro: lo importa catalog.js y su test.
 */
const FRASE = 'Perfume de prueba con un texto exageradamente largo para ver cómo se acomoda todo cuando la descripción no cabe. ';
const NOTAS = 'bergamota de Calabria, mandarina verde, pimienta rosa, cardamomo, azafrán, jengibre';

/** `n` perfumes para llenar un paquete: los reales del catálogo y, si faltan, inventados. */
function perfumesPara(catalogo, n) {
  const reales = (catalogo || [])
    .filter(p => p && p.tipo !== 'paquete' && p.tipo !== 'accesorio' && !p.isAccesorio)
    .slice(0, n)
    .map(p => ({ id: p.id, nombre: p.nombre, marca: p.marca || '', imagen: p.imagen || '' }));
  const extra = Array.from({ length: Math.max(0, n - reales.length) }, (_, i) => ({
    id: `estres-p${i}`,
    nombre: `Perfume de prueba número ${i + 1} con nombre largo`,
    marca: 'Casa de Prueba Internacional',
    imagen: '',
  }));
  return [...reales, ...extra];
}

/** @returns {Array} Productos con forma de catálogo; sus id empiezan con "estres-". */
export function productosEstres(catalogo) {
  const foto = ((catalogo || []).find(p => p && p.imagen) || {}).imagen || '';
  const comun = { activo: true, categoria: 'Diseñador', familia: 'Amaderado', genero: 'Unisex' };
  return [
    {
      ...comun, id: 'estres-arma', tipo: 'paquete', esPersonalizable: true, maxSeleccion: 3,
      nombre: 'PRUEBA Arma tu paquete con 40 perfumes',
      imagen: foto,
      descripcion: FRASE.repeat(3),
      items: perfumesPara(catalogo, 40),
      precios: { 3: 159, 5: 209, 10: 389 },
    },
    {
      ...comun, id: 'estres-fijo', tipo: 'paquete',
      nombre: 'PRUEBA Paquete fijo con 12 perfumes y 6 presentaciones',
      imagen: foto,
      descripcion: FRASE.repeat(2),
      items: perfumesPara(catalogo, 12),
      precios: { 2: 99, 3: 159, 5: 209, 10: 389, 15: 549, 30: 999 },
    },
    {
      ...comun, id: 'estres-largo', marca: 'Maison de Parfums Extraordinairement Longue et Internationale',
      nombre: 'PRUEBA Nombre de perfume larguísimo Eau de Parfum Intense Édition Limitée Collector 2026',
      imagen: foto,
      descripcion: `${FRASE.repeat(4)}\n\nSalida: ${NOTAS}\nCorazon: ${NOTAS}\nFondo: ${NOTAS}\n\nDuracion: Alta (mas de 8 h) · Estela: fuerte\nIdeal para: Dia y noche · Todo el año`,
      precios: { 2: 80, 3: 120, 5: 170, 10: 320 },
    },
    {
      ...comun, id: 'estres-sinfoto', tipo: 'paquete',
      nombre: 'PRUEBA Paquete sin foto',
      imagen: '',
      descripcion: 'Un paquete sin imagen para ver el espacio vacío.',
      items: perfumesPara(catalogo, 3),
      precios: { 5: 209 },
    },
  ];
}
