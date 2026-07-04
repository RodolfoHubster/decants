/**
 * cart.js — Lógica pura del carrito (sin DOM, sin Firebase)
 * Cada item: { key, id, nombre, marca, imagen, size, price, qty }
 */

export const MAX_QTY = 5;

// ── Persistencia localStorage con TTL ─────────────
const CART_KEY    = 'decants_cart';
const CART_TTL_MS = 60 * 60 * 1000; // 60 minutos

export function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({
      items:     cart,
      savedAt:   Date.now(),
      expiresAt: Date.now() + CART_TTL_MS,
    }));
  } catch (_) {}
}

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
  } catch (_) { return []; }
}

export function clearSavedCart() {
  try { localStorage.removeItem(CART_KEY); } catch (_) {}
}

export function cartExpiresInMinutes() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const { expiresAt } = JSON.parse(raw);
    const remaining = Math.ceil((expiresAt - Date.now()) / 60000);
    return remaining > 0 ? remaining : null;
  } catch (_) { return null; }
}

// ── Lógica pura ────────────────────────────────────

export function addItem(cart, item) {
  if (!item.key || !item.id) return { cart, added: false, reason: 'invalid_item' };
  const idx = cart.findIndex(i => i.key === item.key);
  if (idx !== -1) {
    if (cart[idx].qty >= MAX_QTY) return { cart, added: false, reason: 'max_qty' };
    const updated = cart.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i);
    return { cart: updated, added: true, reason: 'qty_incremented' };
  }
  return { cart: [...cart, { ...item, qty: item.qty || 1 }], added: true, reason: 'ok' };
}

export function decrementItem(cart, key) {
  return cart.map(i => i.key === key ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0);
}

export function removeItem(cart, key) {
  return cart.filter(i => i.key !== key);
}

export function clearCart() { return []; }

export function calcTotal(cart) {
  return cart.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0);
}

export function totalUnits(cart) {
  return cart.reduce((sum, i) => sum + (i.qty || 1), 0);
}

export function buildWhatsAppURL(cart, waNumber) {
  if (!cart.length) return null;
  const total = calcTotal(cart);
  const lines = cart.map(i => {
    let base = `• ${i.marca} - ${i.nombre} (${i.size.replace('Paquete ', '')}ml) x${i.qty} — $${i.price * i.qty} MXN`;
    if (i.customItems && i.customItems.length) {
      const names = i.customItems.map(c => c.nombre).join(', ');
      base += `\n  ↳ [${names}]`;
    }
    return base;
  }).join('\n');
  const msg   = `Hola! Quisiera hacer el siguiente pedido de decants:\n\n${lines}\n\n*Total estimado: $${total} MXN*\n\n¿Tienen disponibilidad? 🙏`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
}

export function countUniqueProducts(cart) {
  return new Set(cart.map(i => i.id)).size;
}

export function getItemQty(cart, key) {
  return cart.find(i => i.key === key)?.qty ?? 0;
}
