/**
 * cart.js — Logica pura del carrito (sin DOM, sin Firebase)
 * Cada item tiene: { key, id, nombre, marca, imagen, size, price, qty }
 * qty: 1-5 por combinacion perfume+talla
 */

export const MAX_QTY = 5;

// ── Persistencia localStorage con TTL ────────────────────────────────────────
const CART_KEY    = 'decants_cart';
const CART_TTL_MS = 60 * 60 * 1000; // 60 minutos

/**
 * Guarda el carrito en localStorage con timestamp.
 * Falla silenciosamente si localStorage no está disponible (ej. sandbox).
 */
export function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({
      items:     cart,
      savedAt:   Date.now(),
      expiresAt: Date.now() + CART_TTL_MS,
    }));
  } catch (_) { /* sandbox / privado: ignorar */ }
}

/**
 * Carga el carrito desde localStorage.
 * Devuelve [] si no existe, está expirado o es inválido.
 */
export function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const { items, expiresAt } = JSON.parse(raw);
    if (!Array.isArray(items) || Date.now() > expiresAt) {
      localStorage.removeItem(CART_KEY);
      return [];
    }
    return items;
  } catch (_) {
    return [];
  }
}

/**
 * Borra el carrito guardado (al limpiar pedido o enviarlo).
 */
export function clearSavedCart() {
  try { localStorage.removeItem(CART_KEY); } catch (_) {}
}

/**
 * Devuelve cuántos minutos quedan antes de que expire el carrito guardado.
 * Devuelve null si no hay nada guardado.
 */
export function cartExpiresInMinutes() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const { expiresAt } = JSON.parse(raw);
    const remaining = Math.ceil((expiresAt - Date.now()) / 60000);
    return remaining > 0 ? remaining : null;
  } catch (_) {
    return null;
  }
}

// ── Lógica pura del carrito ───────────────────────────────────────────────────

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
    if (cart[idx].qty >= MAX_QTY) {
      return { cart, added: false, reason: 'max_qty' };
    }
    const updated = cart.map((i, n) =>
      n === idx ? { ...i, qty: i.qty + 1 } : i
    );
    return { cart: updated, added: true, reason: 'qty_incremented' };
  }

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
 * Elimina un item del carrito por su key.
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
