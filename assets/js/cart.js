/**
 * cart.js — Lógica pura del carrito (sin DOM, sin Firebase)
 * Cada item: { key, id, nombre, marca, imagen, size, price, qty }
 */

import { preciosDelCarrito, desgloseSorpresa } from './sorpresa.js';
import { etiquetaTalla } from './pro.js';

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

// El total respeta el precio de extra de los paquetes sorpresa (sorpresa.js).
export function calcTotal(cart) {
  return preciosDelCarrito(cart).total;
}

export function totalUnits(cart) {
  return cart.reduce((sum, i) => sum + (i.qty || 1), 0);
}

export function buildWhatsAppURL(cart, waNumber) {
  if (!cart.length) return null;
  const { renglones, total } = preciosDelCarrito(cart);
  const lines = cart.map((i, n) => {
    const r = renglones[n];
    const nombre = i.esSorpresa ? `${i.nombre} sorpresa` : i.nombre;
    let base = `• ${i.marca} - ${nombre} (${etiquetaTalla(i)}) x${i.qty} — $${r.total} MXN`;
    // Cuáles van a precio de extra y cuáles a precio normal.
    if (r.conExtra === r.qty) base += ' (precio con paquete)';
    else if (r.conExtra) base += `
  ↳ ${desgloseSorpresa(r)}`;
    if (i.esSorpresa) base += `
  ↳ Perfume sorpresa: Fito lo elige al preparar tu pedido`;
    if (i.customItems && i.customItems.length) {
      const names = i.customItems.map(c => c.nombre).join(', ');
      base += `\n  ↳ [${names}]`;
    }
    // Truco o Trato: el cliente eligió uno menos y el último lo escoge Fito.
    if (i.sorpresa) base += `\n  ↳ +1 sorpresa de Fito`;
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

/**
 * Revisa el pedido guardado contra el catálogo vivo antes de usarlo.
 *
 * El pedido vive hasta una hora en el teléfono del cliente. Si mientras tanto
 * el dueño cambia un precio o marca algo agotado, el WhatsApp salía con el
 * precio viejo o con un producto que ya no hay.
 *
 * @param {Array} cart
 * @param {object} cat
 * @param {(id:string)=>object|undefined} cat.buscar     producto vivo por id
 * @param {(p:object)=>boolean}           cat.disponible si se puede pedir
 * @param {(p:object, size:string)=>number} cat.precioDe precio actual; 0 si esa talla ya no se vende
 * @param {(items:Array)=>boolean}       [cat.itemsDisponibles] para combos armados por el cliente
 * @returns {{cart:Array, quitados:string[], actualizados:string[]}}
 */
export function revalidarCarrito(cart, { buscar, disponible, precioDe, itemsDisponibles }) {
  const quitados = [], actualizados = [], nuevo = [];
  (cart || []).forEach(it => {
    const p = buscar(it.id);
    // El renglón va como tercer dato: un PRO cuesta su talla + el extra.
    const precio = p ? Number(precioDe(p, it.size, it)) || 0 : 0;
    const comboOk = !it.customItems || !itemsDisponibles || itemsDisponibles(it.customItems);
    if (!p || !disponible(p) || precio <= 0 || !comboOk) { quitados.push(it.nombre); return; }
    if (precio !== Number(it.price)) {
      actualizados.push(it.nombre);
      nuevo.push({ ...it, price: precio });
      return;
    }
    nuevo.push(it);
  });
  return { cart: nuevo, quitados, actualizados };
}
