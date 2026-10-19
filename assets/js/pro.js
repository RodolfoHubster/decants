/**
 * pro.js — Decant PRO (reforzado). Sin DOM.
 *
 * El PRO es el mismo perfume en un envase reforzado y cubierto de aluminio de
 * color: aguanta caídas y es ideal para viaje. Se ofrece en 5 y 10 ml a
 * +$extra (Costos → "Reforzada: precio de venta", que la tienda lee de
 * config/tienda.reforzadaVenta). El cliente elige el color.
 */

export const TALLAS_PRO = ['5', '10'];

export const COLORES_PRO = [
  { id: 'negro', nombre: 'Negro', hex: '#151515' },
  { id: 'azul-marino', nombre: 'Azul marino', hex: '#1f2f5c' },
  { id: 'plateado', nombre: 'Plateado', hex: '#c3c7cf' },
  { id: 'dorado', nombre: 'Dorado', hex: '#c9a84c' },
  { id: 'rosa', nombre: 'Rosa', hex: '#e9a3bd' },
  { id: 'morado', nombre: 'Morado', hex: '#6d3fa3' },
  { id: 'rojo', nombre: 'Rojo', hex: '#b3202a' },
];

export const colorPro = id => COLORES_PRO.find(c => c.id === id) || null;

/**
 * Presentaciones PRO de un perfume: solo en 5 y 10 ml que se vendan (precio > 0)
 * y si hay precio extra configurado.
 * @returns {Array<{talla:string, precio:number}>}
 */
export function opcionesPro(precios, extra) {
  const ex = Number(extra) || 0;
  if (ex <= 0) return [];
  return TALLAS_PRO
    .filter(t => Number((precios || {})[t]) > 0)
    .map(t => ({ talla: t, precio: Number(precios[t]) + ex }));
}

/** Parte de la clave del carrito: el mismo perfume en PRO dorado y en PRO negro son renglones distintos. */
export function sufijoPro(pro, colorId) {
  return pro ? `-pro-${colorId || 'sin-color'}` : '';
}

/** "5ml PRO · Dorado" para el carrito y WhatsApp. */
export function etiquetaTalla(item) {
  const ml = String((item && item.size) || '').replace(/^Paquete\s+/i, '');
  if (!item || !item.pro) return `${ml}ml`;
  const c = colorPro(item.color);
  return `${ml}ml PRO${c ? ` · ${c.nombre}` : ''}`;
}
