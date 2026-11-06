/**
 * compra-rapida.js — Elegir tamaño y agregar al carrito desde la tarjeta. Sin DOM.
 *
 * La tarjeta muestra "Desde $X ▾"; al tocarlo se despliegan los tamaños (y los
 * PRO, que piden color). Elegido uno, la bolsita de la foto lo agrega. Los
 * paquetes (hay que escoger perfumes) se compran desde la ficha.
 */
import { ahorroPorTalla } from './precios.js';
import { opcionesPro, sufijoPro } from './pro.js';

/**
 * Lo que se puede agregar desde la tarjeta: tamaños normales de chico a grande
 * y después los PRO.
 * @param {object} p
 * @param {{permitida?:(talla:string)=>boolean, agotado?:boolean, proExtra?:number}} [opciones]
 *   `permitida` deja fuera tallas apagadas en la tienda (el 2 ml); `proExtra`
 *   es lo que cuesta de más el PRO (sin él no hay PRO).
 * @returns {Array<{id:string, size:string, price:number, ahorro:number, pro:boolean}>}
 */
export function opcionesRapidas(p, { permitida = () => true, agotado = false, proExtra = 0 } = {}) {
  if (!p || agotado || p.tipo === 'paquete' || p.tipo === 'accesorio' || p.isAccesorio) return [];
  const pr = p.precios || (p.ml && p.precio ? { [p.ml]: p.precio } : {});
  const sizes = Object.entries(pr)
    .filter(([k, v]) => +v > 0 && permitida(String(k)))
    .sort((a, b) => +a[0] - +b[0]);
  const normales = sizes.map(([k, v]) => ({
    id: String(k), size: String(k), price: +v, ahorro: ahorroPorTalla(sizes, k, v), pro: false,
  }));
  const pros = opcionesPro(pr, proExtra).map(o => ({
    id: `${o.talla}-pro`, size: o.talla, price: o.precio, ahorro: 0, pro: true,
  }));
  return [...normales, ...pros];
}

/** El precio más bajo, para el "Desde $X" de la tarjeta (0 si no hay). */
export function precioDesde(opciones) {
  const precios = (opciones || []).map(o => +o.price).filter(v => v > 0);
  return precios.length ? Math.min(...precios) : 0;
}

/** ¿Ya se puede agregar? El PRO necesita color. */
export function eleccionCompleta(op, colorId) {
  return !!op && (!op.pro || !!colorId);
}

/**
 * El renglón del carrito, igual al que arma la ficha: misma `key`, así la ficha
 * reconoce lo que ya llevas y muestra el − 1 +.
 */
export function itemRapido(p, op, colorId = null, imagen = '') {
  const pro = !!op.pro;
  return {
    key: `${p.id}-${op.size}${sufijoPro(pro, colorId)}`,
    id: p.id,
    nombre: p.nombre,
    marca: p.marca || '',
    imagen,
    size: String(op.size),
    pro,
    color: pro ? colorId : null,
    price: +op.price,
    qty: 1,
    customItems: null,
    sorpresa: false,
    esPaquete: false,
    esSorpresa: false,
    temporada: p.temporada || null,
    precioExtra: 0,
  };
}
