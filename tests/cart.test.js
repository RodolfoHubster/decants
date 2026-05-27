/**
 * Unit tests — Logica del carrito (cart.js)
 * npm test
 */

import {
  addItem,
  decrementItem,
  removeItem,
  clearCart,
  calcTotal,
  totalUnits,
  buildWhatsAppURL,
  countUniqueProducts,
  getItemQty,
  MAX_QTY,
} from '../assets/js/cart.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ITEM_A = { key: 'abc-5',  id: 'abc', nombre: 'Sauvage',   marca: 'Dior',   imagen: '', size: '5',  price: 90,  qty: 1 };
const ITEM_B = { key: 'xyz-3',  id: 'xyz', nombre: 'Hawas Ice', marca: 'Rasasi', imagen: '', size: '3',  price: 70,  qty: 1 };
const ITEM_A2= { key: 'abc-10', id: 'abc', nombre: 'Sauvage',   marca: 'Dior',   imagen: '', size: '10', price: 160, qty: 1 };

// ── addItem ───────────────────────────────────────────────────────────────────

describe('addItem', () => {
  test('agrega item nuevo a carrito vacio', () => {
    const { cart, added, reason } = addItem([], ITEM_A);
    expect(added).toBe(true);
    expect(reason).toBe('ok');
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(1);
  });

  test('incrementa qty si el mismo key ya existe', () => {
    const { cart, added, reason } = addItem([ITEM_A], ITEM_A);
    expect(added).toBe(true);
    expect(reason).toBe('qty_incremented');
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  test('rechaza cuando qty alcanza MAX_QTY', () => {
    const full = [{ ...ITEM_A, qty: MAX_QTY }];
    const { cart, added, reason } = addItem(full, ITEM_A);
    expect(added).toBe(false);
    expect(reason).toBe('max_qty');
    expect(cart[0].qty).toBe(MAX_QTY); // no muto
  });

  test('permite mismo perfume en talla diferente (key distinta)', () => {
    const { cart, added } = addItem([ITEM_A], ITEM_A2);
    expect(added).toBe(true);
    expect(cart).toHaveLength(2);
  });

  test('rechaza item sin key', () => {
    const { added, reason } = addItem([], { id: 'x', nombre: 'X', price: 50, qty: 1 });
    expect(added).toBe(false);
    expect(reason).toBe('invalid_item');
  });

  test('rechaza item sin id', () => {
    const { added, reason } = addItem([], { key: 'x-5', nombre: 'X', price: 50, qty: 1 });
    expect(added).toBe(false);
    expect(reason).toBe('invalid_item');
  });

  test('no muta el array original', () => {
    const orig = [ITEM_A];
    addItem(orig, ITEM_B);
    expect(orig).toHaveLength(1);
  });

  test('puede agregar hasta MAX_QTY veces', () => {
    let c = [];
    for (let i = 0; i < MAX_QTY; i++) {
      const res = addItem(c, ITEM_A);
      expect(res.added).toBe(true);
      c = res.cart;
    }
    expect(c[0].qty).toBe(MAX_QTY);
    // intento MAX_QTY+1 debe fallar
    const over = addItem(c, ITEM_A);
    expect(over.added).toBe(false);
    expect(over.reason).toBe('max_qty');
  });
});

// ── decrementItem ─────────────────────────────────────────────────────────────

describe('decrementItem', () => {
  test('decrementa qty de 2 a 1', () => {
    const cart = [{ ...ITEM_A, qty: 2 }];
    const result = decrementItem(cart, ITEM_A.key);
    expect(result[0].qty).toBe(1);
  });

  test('elimina el item si qty llega a 0', () => {
    const cart = [{ ...ITEM_A, qty: 1 }];
    const result = decrementItem(cart, ITEM_A.key);
    expect(result).toHaveLength(0);
  });

  test('no afecta otros items', () => {
    const cart = [{ ...ITEM_A, qty: 2 }, ITEM_B];
    const result = decrementItem(cart, ITEM_A.key);
    expect(result).toHaveLength(2);
    expect(result.find(i => i.key === ITEM_B.key).qty).toBe(1);
  });

  test('no muta el array original', () => {
    const orig = [{ ...ITEM_A, qty: 2 }];
    decrementItem(orig, ITEM_A.key);
    expect(orig[0].qty).toBe(2);
  });
});

// ── removeItem ────────────────────────────────────────────────────────────────

describe('removeItem', () => {
  test('elimina el item correcto', () => {
    const result = removeItem([ITEM_A, ITEM_B], ITEM_A.key);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe(ITEM_B.key);
  });

  test('devuelve igual si key no existe', () => {
    expect(removeItem([ITEM_A], 'no-existe')).toHaveLength(1);
  });

  test('devuelve vacio si era el unico', () => {
    expect(removeItem([ITEM_A], ITEM_A.key)).toHaveLength(0);
  });
});

// ── clearCart ─────────────────────────────────────────────────────────────────

describe('clearCart', () => {
  test('siempre devuelve array vacio', () => {
    expect(clearCart()).toEqual([]);
  });
});

// ── calcTotal ─────────────────────────────────────────────────────────────────

describe('calcTotal', () => {
  test('suma price * qty correctamente', () => {
    const cart = [{ ...ITEM_A, qty: 2 }, { ...ITEM_B, qty: 1 }];
    expect(calcTotal(cart)).toBe(250); // 90*2 + 70*1
  });

  test('devuelve 0 en carrito vacio', () => {
    expect(calcTotal([])).toBe(0);
  });

  test('maneja price como string', () => {
    expect(calcTotal([{ ...ITEM_A, price: '90', qty: 3 }])).toBe(270);
  });

  test('ignora price invalido (NaN -> 0)', () => {
    const bad = { ...ITEM_A, price: 'raro', qty: 1 };
    expect(calcTotal([bad, ITEM_B])).toBe(70);
  });
});

// ── totalUnits ────────────────────────────────────────────────────────────────

describe('totalUnits', () => {
  test('suma todas las qty', () => {
    const cart = [{ ...ITEM_A, qty: 3 }, { ...ITEM_B, qty: 2 }];
    expect(totalUnits(cart)).toBe(5);
  });

  test('devuelve 0 en carrito vacio', () => {
    expect(totalUnits([])).toBe(0);
  });
});

// ── getItemQty ────────────────────────────────────────────────────────────────

describe('getItemQty', () => {
  test('devuelve qty del item existente', () => {
    const cart = [{ ...ITEM_A, qty: 3 }];
    expect(getItemQty(cart, ITEM_A.key)).toBe(3);
  });

  test('devuelve 0 si el key no existe', () => {
    expect(getItemQty([], ITEM_A.key)).toBe(0);
    expect(getItemQty([ITEM_B], ITEM_A.key)).toBe(0);
  });
});

// ── buildWhatsAppURL ──────────────────────────────────────────────────────────

describe('buildWhatsAppURL', () => {
  const WA = '526648162623';

  test('retorna null si carrito vacio', () => {
    expect(buildWhatsAppURL([], WA)).toBeNull();
  });

  test('contiene numero WA', () => {
    expect(buildWhatsAppURL([ITEM_A], WA)).toContain(`wa.me/${WA}`);
  });

  test('refleja qty en el mensaje (x2)', () => {
    const cart = [{ ...ITEM_A, qty: 2 }];
    const decoded = decodeURIComponent(buildWhatsAppURL(cart, WA));
    expect(decoded).toContain('x2');
  });

  test('total correcto con qty > 1', () => {
    const cart = [{ ...ITEM_A, qty: 2 }, { ...ITEM_B, qty: 1 }];
    const decoded = decodeURIComponent(buildWhatsAppURL(cart, WA));
    expect(decoded).toContain('$250 MXN'); // 90*2 + 70*1
  });

  test('URL sin espacios sin encodear', () => {
    const url = buildWhatsAppURL([ITEM_A], WA);
    expect(url).not.toContain(' ');
  });
});

// ── countUniqueProducts ───────────────────────────────────────────────────────

describe('countUniqueProducts', () => {
  test('mismo perfume 2 tallas = 1 producto unico', () => {
    expect(countUniqueProducts([ITEM_A, ITEM_A2])).toBe(1);
  });

  test('2 perfumes distintos = 2', () => {
    expect(countUniqueProducts([ITEM_A, ITEM_B])).toBe(2);
  });

  test('carrito vacio = 0', () => {
    expect(countUniqueProducts([])).toBe(0);
  });
});
