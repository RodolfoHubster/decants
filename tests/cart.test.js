/**
 * Unit tests — Logica del carrito (cart.js)
 * Ejecutar: npm test
 */

import {
  addItem,
  removeItem,
  clearCart,
  calcTotal,
  buildWhatsAppURL,
  countUniqueProducts,
} from '../assets/js/cart.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ITEM_A = {
  key:    'abc123-5',
  id:     'abc123',
  nombre: 'Sauvage',
  marca:  'Dior',
  imagen: '',
  size:   '5',
  price:  90,
};

const ITEM_B = {
  key:    'xyz999-3',
  id:     'xyz999',
  nombre: 'Hawas Ice',
  marca:  'Rasasi',
  imagen: '',
  size:   '3',
  price:  70,
};

const ITEM_A_10ML = {
  key:    'abc123-10',
  id:     'abc123',       // mismo perfume, distinta talla
  nombre: 'Sauvage',
  marca:  'Dior',
  imagen: '',
  size:   '10',
  price:  160,
};

// ─── addItem ─────────────────────────────────────────────────────────────────

describe('addItem', () => {
  test('agrega un item a carrito vacio', () => {
    const { cart, added, reason } = addItem([], ITEM_A);
    expect(added).toBe(true);
    expect(reason).toBe('ok');
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject(ITEM_A);
  });

  test('agrega un segundo item diferente', () => {
    const initial = [ITEM_A];
    const { cart, added } = addItem(initial, ITEM_B);
    expect(added).toBe(true);
    expect(cart).toHaveLength(2);
  });

  test('rechaza duplicado (mismo key)', () => {
    const initial = [ITEM_A];
    const { cart, added, reason } = addItem(initial, ITEM_A);
    expect(added).toBe(false);
    expect(reason).toBe('duplicate');
    expect(cart).toHaveLength(1); // no muto el carrito
  });

  test('permite mismo perfume en talla diferente (key distinta)', () => {
    const initial = [ITEM_A];
    const { cart, added } = addItem(initial, ITEM_A_10ML);
    expect(added).toBe(true);
    expect(cart).toHaveLength(2);
  });

  test('rechaza item sin key', () => {
    const bad = { id: 'abc', nombre: 'X', price: 50 }; // sin key
    const { cart, added, reason } = addItem([], bad);
    expect(added).toBe(false);
    expect(reason).toBe('invalid_item');
    expect(cart).toHaveLength(0);
  });

  test('rechaza item sin id', () => {
    const bad = { key: 'x-5', nombre: 'X', price: 50 }; // sin id
    const { added, reason } = addItem([], bad);
    expect(added).toBe(false);
    expect(reason).toBe('invalid_item');
  });

  test('no muta el array original', () => {
    const original = [ITEM_A];
    addItem(original, ITEM_B);
    expect(original).toHaveLength(1); // inmutable
  });
});

// ─── removeItem ──────────────────────────────────────────────────────────────

describe('removeItem', () => {
  test('elimina el item con la key correcta', () => {
    const cart = [ITEM_A, ITEM_B];
    const result = removeItem(cart, ITEM_A.key);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe(ITEM_B.key);
  });

  test('devuelve carrito igual si la key no existe', () => {
    const cart = [ITEM_A];
    const result = removeItem(cart, 'clave-inexistente');
    expect(result).toHaveLength(1);
  });

  test('devuelve array vacio si era el unico item', () => {
    const result = removeItem([ITEM_A], ITEM_A.key);
    expect(result).toHaveLength(0);
  });

  test('no muta el array original', () => {
    const original = [ITEM_A, ITEM_B];
    removeItem(original, ITEM_A.key);
    expect(original).toHaveLength(2);
  });
});

// ─── clearCart ───────────────────────────────────────────────────────────────

describe('clearCart', () => {
  test('devuelve array vacio', () => {
    expect(clearCart()).toEqual([]);
  });

  test('devuelve array vacio sin importar el estado previo', () => {
    // clearCart es pura, no recibe estado — siempre retorna []
    expect(clearCart()).toHaveLength(0);
  });
});

// ─── calcTotal ───────────────────────────────────────────────────────────────

describe('calcTotal', () => {
  test('suma correctamente con multiples items', () => {
    expect(calcTotal([ITEM_A, ITEM_B])).toBe(160); // 90 + 70
  });

  test('devuelve 0 en carrito vacio', () => {
    expect(calcTotal([])).toBe(0);
  });

  test('maneja price como string (coercion)', () => {
    const item = { ...ITEM_A, price: '90' };
    expect(calcTotal([item])).toBe(90);
  });

  test('ignora items con price invalido (NaN → 0)', () => {
    const bad = { ...ITEM_A, price: 'raro' };
    expect(calcTotal([bad, ITEM_B])).toBe(70);
  });

  test('calcula correctamente con 3 items', () => {
    expect(calcTotal([ITEM_A, ITEM_B, ITEM_A_10ML])).toBe(320); // 90+70+160
  });
});

// ─── buildWhatsAppURL ─────────────────────────────────────────────────────────

describe('buildWhatsAppURL', () => {
  const WA = '526648162623';

  test('retorna null si el carrito esta vacio', () => {
    expect(buildWhatsAppURL([], WA)).toBeNull();
  });

  test('contiene el numero de WA en la URL', () => {
    const url = buildWhatsAppURL([ITEM_A], WA);
    expect(url).toContain(`wa.me/${WA}`);
  });

  test('contiene el nombre del perfume en el mensaje', () => {
    const url = buildWhatsAppURL([ITEM_A], WA);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Sauvage');
    expect(decoded).toContain('Dior');
  });

  test('contiene el total correcto en el mensaje', () => {
    const url = buildWhatsAppURL([ITEM_A, ITEM_B], WA);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('$160 MXN'); // 90 + 70
  });

  test('incluye todos los items en el mensaje', () => {
    const url = buildWhatsAppURL([ITEM_A, ITEM_B], WA);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Sauvage');
    expect(decoded).toContain('Hawas Ice');
  });

  test('URL esta correctamente encoded', () => {
    const url = buildWhatsAppURL([ITEM_A], WA);
    expect(url).toMatch(/^https:\/\/wa\.me\/.+\?text=.+/);
    // No debe haber espacios sin encodear
    expect(url).not.toContain(' ');
  });
});

// ─── countUniqueProducts ─────────────────────────────────────────────────────

describe('countUniqueProducts', () => {
  test('cuenta 1 producto unico', () => {
    expect(countUniqueProducts([ITEM_A])).toBe(1);
  });

  test('cuenta 2 productos distintos', () => {
    expect(countUniqueProducts([ITEM_A, ITEM_B])).toBe(2);
  });

  test('mismo perfume en 2 tallas cuenta como 1 producto', () => {
    expect(countUniqueProducts([ITEM_A, ITEM_A_10ML])).toBe(1);
  });

  test('carrito vacio = 0 productos', () => {
    expect(countUniqueProducts([])).toBe(0);
  });

  test('3 items: 2 perfumes distintos', () => {
    expect(countUniqueProducts([ITEM_A, ITEM_A_10ML, ITEM_B])).toBe(2);
  });
});
