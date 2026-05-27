/**
 * cart.js — Logica pura del carrito (sin DOM, sin Firebase)
 * Exportada para poder ser testeada con Jest.
 * catalog.js importa estas funciones en lugar de definirlas inline.
 */

/**
 * Agrega un item al carrito.
 * @param {Array} cart  - Estado actual del carrito
 * @param {Object} item - { key, id, nombre, marca, imagen, size, price }
 * @returns {{ cart: Array, added: boolean, reason: string }}
 */
export function addItem(cart, item) {
  if (!item.key || !item.id) {
    return { cart, added: false, reason: 'invalid_item' };
  }
  if (cart.find(i => i.key === item.key)) {
    return { cart, added: false, reason: 'duplicate' };
  }
  return { cart: [...cart, item], added: true, reason: 'ok' };
}

/**
 * Elimina un item del carrito por su key.
 * @param {Array} cart
 * @param {string} key
 * @returns {Array}
 */
export function removeItem(cart, key) {
  return cart.filter(i => i.key !== key);
}

/**
 * Limpia el carrito completo.
 * @returns {Array}
 */
export function clearCart() {
  return [];
}

/**
 * Calcula el total del carrito.
 * @param {Array} cart
 * @returns {number}
 */
export function calcTotal(cart) {
  return cart.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
}

/**
 * Genera el mensaje de WhatsApp para el pedido.
 * @param {Array} cart
 * @param {string} waNumber  - e.g. '526648162623'
 * @returns {string} URL completa de wa.me
 */
export function buildWhatsAppURL(cart, waNumber) {
  if (!cart.length) return null;
  const total = calcTotal(cart);
  const lines = cart
    .map(i => `• ${i.marca} - ${i.nombre} (${i.size}ml) — $${i.price} MXN`)
    .join('\n');
  const msg = `Hola! Quisiera hacer el siguiente pedido de decants:\n\n${lines}\n\n*Total estimado: $${total} MXN*\n\n¿Tienen disponibilidad? 🙏`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
}

/**
 * Devuelve cuantos items distintos hay en el carrito (por id, no por key).
 * @param {Array} cart
 * @returns {number}
 */
export function countUniqueProducts(cart) {
  return new Set(cart.map(i => i.id)).size;
}
