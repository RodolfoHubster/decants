import { opcionesRapidas, precioDesde, eleccionCompleta, itemRapido } from '../assets/js/compra-rapida.js';
import { addItem } from '../assets/js/cart.js';

const odyssey = { id: 'o1', nombre: 'Odyssey Mandarin Sky', marca: 'Armaf', imagen: 'x.jpg', precios: { 10: 150, 3: 60, 5: 90, 2: 0 } };
const ids = ops => ops.map(o => o.id);

describe('opcionesRapidas', () => {
  test('tamaños de chico a grande con el ahorro, y después los PRO', () => {
    const ops = opcionesRapidas(odyssey, { proExtra: 15 });
    expect(ids(ops)).toEqual(['3', '5', '10', '5-pro', '10-pro']);
    expect(ops[2]).toEqual({ id: '10', size: '10', price: 150, ahorro: 30, pro: false });
    expect(ops[4]).toEqual({ id: '10-pro', size: '10', price: 165, ahorro: 0, pro: true });
  });
  test('sin precio extra configurado no hay PRO', () => {
    expect(ids(opcionesRapidas(odyssey))).toEqual(['3', '5', '10']);
  });
  test('respeta las tallas apagadas en la tienda (2 ml)', () => {
    const p = { ...odyssey, precios: { 2: 40, 5: 90 } };
    expect(ids(opcionesRapidas(p, { permitida: k => k !== '2' }))).toEqual(['5']);
  });
  test('paquetes, accesorios, agotados y sin precios: nada (se compran desde la ficha)', () => {
    expect(opcionesRapidas({ ...odyssey, tipo: 'paquete' }, { proExtra: 15 })).toEqual([]);
    expect(opcionesRapidas({ ...odyssey, tipo: 'accesorio' })).toEqual([]);
    expect(opcionesRapidas(odyssey, { agotado: true, proExtra: 15 })).toEqual([]);
    expect(opcionesRapidas({ id: 'x', precios: { 5: '' } })).toEqual([]);
    expect(opcionesRapidas(null)).toEqual([]);
  });
  test('perfumes viejos con un solo precio suelto', () => {
    expect(opcionesRapidas({ id: 'v', ml: 5, precio: 80 })).toEqual([{ id: '5', size: '5', price: 80, ahorro: 0, pro: false }]);
  });
});

describe('precioDesde y eleccionCompleta', () => {
  test('el precio más bajo', () => {
    expect(precioDesde(opcionesRapidas(odyssey, { proExtra: 15 }))).toBe(60);
    expect(precioDesde([])).toBe(0);
  });
  test('el PRO necesita color; los normales no', () => {
    const [chico, , , pro] = opcionesRapidas(odyssey, { proExtra: 15 });
    expect(eleccionCompleta(chico)).toBe(true);
    expect(eleccionCompleta(pro)).toBe(false);
    expect(eleccionCompleta(pro, 'dorado')).toBe(true);
    expect(eleccionCompleta(null)).toBe(false);
  });
});

describe('itemRapido', () => {
  const [, cinco, diez, cincoPro] = opcionesRapidas(odyssey, { proExtra: 15 });
  test('misma clave que arma la ficha, normal y PRO con su color', () => {
    expect(itemRapido(odyssey, cinco, null, 'mini.jpg')).toMatchObject({ key: 'o1-5', size: '5', price: 90, pro: false, color: null, imagen: 'mini.jpg' });
    expect(itemRapido(odyssey, cincoPro, 'dorado')).toMatchObject({ key: 'o1-5-pro-dorado', size: '5', price: 105, pro: true, color: 'dorado' });
  });
  test('mismo tamaño suma en el mismo renglón; PRO de otro color es otro renglón', () => {
    let cart = addItem([], itemRapido(odyssey, cinco)).cart;
    cart = addItem(cart, itemRapido(odyssey, cinco)).cart;
    cart = addItem(cart, itemRapido(odyssey, diez)).cart;
    cart = addItem(cart, itemRapido(odyssey, cincoPro, 'dorado')).cart;
    cart = addItem(cart, itemRapido(odyssey, cincoPro, 'negro')).cart;
    expect(cart.map(i => `${i.key}x${i.qty}`)).toEqual(['o1-5x2', 'o1-10x1', 'o1-5-pro-doradox1', 'o1-5-pro-negrox1']);
  });
});
