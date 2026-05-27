/**
 * cart.js — Logica pura del carrito (sin DOM, sin Firebase)
 * Cada item tiene: { key, id, nombre, marca, imagen, size, price, qty }
 * qty: 1-5 por combinacion perfume+talla
 */

export const MAX_QTY = 5;

/**
 * Agrega un item al carrito o incrementa qty si ya existe.
 * @returns {{ cart: Array, added: boolean, reason: string }}
 */
export function addItem(cart, item) {
  if (!item.key || !item.id) {
    return { cart, added: false, reason: 'invalid_item' };
  }

  const idx = cart.findIndex(i => i.key === item.key);

  if (idx !== -1) {
    // Ya existe: intentar incrementar qty
    if (cart[idx].qty >= MAX_QTY) {
      return { cart, added: false, reason: 'max_qty' };
    }
    const updated = cart.map((i, n) =>
      n === idx ? { ...i, qty: i.qty + 1 } : i
    );
    return { cart: updated, added: true, reason: 'qty_incremented' };
  }

  // Nuevo item
  return {
    cart: [...cart, { ...item, qty: item.qty || 1 }],
    added: true,
    reason: 'ok',
  };
}

/**
 * Decrementa qty de un item. Si qty llega a 0 lo elimina.
 */
export function decrementItem(cart, key) {
  return cart
    .map(i => i.key === key ? { ...i, qty: i.qty - 1 } : i)
    .filter(i => i.qty > 0);
}

/**
 * Elimina un item del carrito por su key (independientemente de qty).
 */
export function removeItem(cart, key) {
  return cart.filter(i => i.key !== key);
}

/**
 * Limpia el carrito completo.
 */
export function clearCart() {
  return [];
}

/**
 * Calcula el total del carrito (price * qty).
 */
export function calcTotal(cart) {
  return cart.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0);
}

/**
 * Total de unidades en el carrito (suma de qty).
 */
export function totalUnits(cart) {
  return cart.reduce((sum, i) => sum + (i.qty || 1), 0);
}

/**
 * Genera la URL de WhatsApp para el pedido completo.
 */
export function buildWhatsAppURL(cart, waNumber) {
  if (!cart.length) return null;
  const total = calcTotal(cart);
  const lines = cart
    .map(i => `• ${i.marca} - ${i.nombre} (${i.size}ml) x${i.qty} — $${i.price * i.qty} MXN`)
    .join('\n');
  const msg = `Hola! Quisiera hacer el siguiente pedido de decants:\n\n${lines}\n\n*Total estimado: $${total} MXN*\n\n¿Tienen disponibilidad? 🙏`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
}

/**
 * Cuantos perfumes distintos hay en el carrito (por id).
 */
export function countUniqueProducts(cart) {
  return new Set(cart.map(i => i.id)).size;
}

/**
 * Devuelve la qty actual de un key especifico, 0 si no existe.
 */
export function getItemQty(cart, key) {
  return cart.find(i => i.key === key)?.qty ?? 0;
}
