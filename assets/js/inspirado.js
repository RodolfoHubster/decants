/**
 * inspirado.js — "Inspirado en": el perfume original de un dupe. Sin DOM.
 *
 * Cada perfume puede guardar `inspiradoEn: { nombre, marca, imagen, perfumeId }`.
 * Si el original está en la tienda, la ficha lleva a su página; si no, muestra
 * su nombre y la imagen que se puso en el panel.
 *
 * El enlace se busca en el catálogo vivo cada vez: si el original se da de alta
 * después, o se oculta, la ficha se entera sola.
 */

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Lo que se ve en el buscador del panel: "Sauvage Elixir · Dior". */
export const etiquetaCatalogo = p => [p && p.nombre, p && p.marca].filter(Boolean).join(' · ');

const esPerfume = p => p && p.tipo !== 'paquete' && p.tipo !== 'accesorio' && !p.isAccesorio;

/**
 * El perfume del catálogo que corresponde a lo escrito: "Nombre · Marca",
 * "Nombre" o "Marca Nombre". Solo nombres exactos: "Sauvage" no debe llevar a
 * "Sauvage Elixir".
 * @param {string} texto
 * @param {Array} perfumes
 * @param {string} [excluirId]  El perfume que se está editando.
 */
export function buscarEnCatalogo(texto, perfumes, excluirId) {
  const [nombreTxt, marcaTxt] = String(texto || '').split('·');
  const n = norm(nombreTxt), m = norm(marcaTxt);
  if (!n) return null;
  return (perfumes || []).find(p => {
    if (!esPerfume(p) || p.id === excluirId) return false;
    const pn = norm(p.nombre), pm = norm(p.marca);
    if (m) return pn === n && pm === m;
    return pn === n || `${pm} ${pn}` === n || `${pn} ${pm}` === n;
  }) || null;
}

/** Lo que se guarda: solo los campos con valor (Firestore rechaza undefined), o null. */
export function armarInspirado({ nombre = '', marca = '', imagen = '', perfumeId = '' } = {}) {
  const r = {};
  if (String(nombre).trim()) r.nombre = String(nombre).trim();
  if (String(marca).trim()) r.marca = String(marca).trim();
  if (String(imagen).trim()) r.imagen = String(imagen).trim();
  if (perfumeId) r.perfumeId = perfumeId;
  return r.nombre ? r : null;
}

/** Agotado según el panel ("Estado Stock Físico"); la tienda pasa el suyo. */
export const agotadoBasico = p => !!p && p.estadoStock === 'agotado';

/**
 * Para la ficha de la tienda.
 * @param {object} [opciones]
 * @param {function} [opciones.agotado]  Si el original está agotado se muestra
 *   igual (con su foto), pero sin enlace y sin decir que está agotado.
 * @returns {{nombre:string, marca:string, imagen:string, producto:object|null}|null}
 *   `producto` es el original si está en la tienda y se puede comprar (para enlazarlo).
 */
export function resolverInspirado(p, todos, { agotado = agotadoBasico } = {}) {
  const ins = p && p.inspiradoEn;
  if (!ins || !ins.nombre) return null;
  const lista = todos || [];
  const porId = ins.perfumeId && lista.find(x => x.id === ins.perfumeId && esPerfume(x) && x.id !== p.id);
  const producto = porId
    || buscarEnCatalogo(ins.marca ? `${ins.nombre} · ${ins.marca}` : ins.nombre, lista, p.id);
  return {
    nombre: producto ? producto.nombre : ins.nombre,
    marca: (producto ? producto.marca : ins.marca) || '',
    imagen: (producto && producto.imagen) || ins.imagen || '',
    producto: producto && !agotado(producto) ? producto : null,
  };
}
