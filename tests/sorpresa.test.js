import { sorpresaDisponible, opcionesSorpresa, preciosDelCarrito, desgloseSorpresa, paraVenderEnPanel } from '../assets/js/sorpresa.js';

const calaverita = (extra = {}) => ({ key: 'cal-3', id: 'cal', size: 'Paquete 3', price: 59, qty: 1,
  esPaquete: true, esSorpresa: true, temporada: 'halloween', precioExtra: 49, ...extra });
const truco = (extra = {}) => ({ key: 'tru-5', id: 'tru', size: 'Paquete 5', price: 300, qty: 1,
  esPaquete: true, temporada: 'halloween', ...extra });
const decant = { key: 'p-5', id: 'p', size: '5', price: 90, qty: 1 };

describe('disponibilidad', () => {
  test('basta un perfume con stock; todos agotados = agotado', () => {
    expect(sorpresaDisponible([{ agotado: true }, { agotado: false }])).toBe(true);
    expect(sorpresaDisponible([{ agotado: true }, { agotado: true }])).toBe(false);
    expect(sorpresaDisponible([])).toBe(false);
    expect(opcionesSorpresa([{ agotado: true }, {}, {}])).toBe(2);
  });
});

describe('preciosDelCarrito', () => {
  test('sola cuesta su precio normal', () => {
    expect(preciosDelCarrito([calaverita(), decant]).total).toBe(59 + 90);
  });
  test('con un paquete de temporada va a $49', () => {
    const r = preciosDelCarrito([truco(), calaverita()]);
    expect(r.renglones[1]).toMatchObject({ conExtra: 1, extra: 49, total: 49 });
    expect(r.total).toBe(349);
  });
  test('una a $49 por cada paquete; las demás a $59', () => {
    const r = preciosDelCarrito([truco(), calaverita({ qty: 3 })]);
    expect(r.renglones[1]).toMatchObject({ conExtra: 1, total: 49 + 59 * 2 });
    const dos = preciosDelCarrito([truco({ qty: 2 }), calaverita({ qty: 3 })]);
    expect(dos.renglones[1]).toMatchObject({ conExtra: 2, total: 49 * 2 + 59 });
  });
  test('si se quita el paquete, regresa a $59', () => {
    const cart = [truco(), calaverita()];
    expect(preciosDelCarrito(cart).total).toBe(349);
    expect(preciosDelCarrito(cart.slice(1)).total).toBe(59);
  });
  test('otra sorpresa, un paquete de otra temporada o un decant no dan cupo', () => {
    expect(preciosDelCarrito([calaverita({ key: 'a' }), calaverita({ key: 'b' })]).total).toBe(118);
    expect(preciosDelCarrito([truco({ temporada: 'navidad' }), calaverita()]).renglones[1].conExtra).toBe(0);
    expect(preciosDelCarrito([decant, calaverita()]).renglones[1].conExtra).toBe(0);
  });
  test('solo en 3 ml', () => {
    expect(preciosDelCarrito([truco(), calaverita({ size: 'Paquete 5', price: 89 })]).renglones[1].conExtra).toBe(0);
  });
  test('desglose para el carrito y WhatsApp', () => {
    const [, r] = preciosDelCarrito([truco(), calaverita({ qty: 3 })]).renglones;
    expect(desgloseSorpresa(r)).toBe('1 a $49 (precio con paquete) + 2 a $59');
    expect(desgloseSorpresa({ conExtra: 0 })).toBe('');
  });
});

describe('paraVenderEnPanel', () => {
  test('la sorpresa se registra eligiendo 1 perfume del caldero', () => {
    expect(paraVenderEnPanel({ id: 'cal', esSorpresa: true, items: [1, 2, 3] })).toMatchObject({ esPersonalizable: true, maxSeleccion: 1 });
  });
  test('los demás paquetes no cambian', () => {
    const p = { id: 'x', esPersonalizable: true, maxSeleccion: 3 };
    expect(paraVenderEnPanel(p)).toBe(p);
  });
});
