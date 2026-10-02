import {
  INACTIVIDAD_MS, itemsDeCliente, sugiereNuevoCliente,
  siguienteClienteId, nombreCliente, resumenPorCliente
} from '../assets/js/pos-cliente.js';

const AHORA = 1_700_000_000_000;
const item = (cid, addedAt, extra = {}) => ({ cartClientId: cid, addedAt, cant: 1, precio: 100, ...extra });

describe('itemsDeCliente', () => {
  test('filtra por cliente y trata cartClientId ausente como 1', () => {
    const cart = [item(1, AHORA), { addedAt: AHORA, cant: 1, precio: 50 }, item(2, AHORA)];
    expect(itemsDeCliente(cart, 1)).toHaveLength(2);
    expect(itemsDeCliente(cart, 2)).toHaveLength(1);
  });
  test('tolera canasta vacía o nula', () => {
    expect(itemsDeCliente([], 1)).toEqual([]);
    expect(itemsDeCliente(null, 1)).toEqual([]);
  });
});

describe('sugiereNuevoCliente', () => {
  test('no pregunta si el cliente actual está vacío', () => {
    // Caso real: primer perfume del día. Partir aquí sería absurdo.
    expect(sugiereNuevoCliente([], 1, AHORA)).toBe(false);
    expect(sugiereNuevoCliente([item(2, AHORA)], 1, AHORA)).toBe(false);
  });

  test('no pregunta si se acaba de agregar algo del mismo cliente', () => {
    // El cliente sigue escogiendo: agrega dos decants seguidos.
    const cart = [item(1, AHORA - 5_000)];
    expect(sugiereNuevoCliente(cart, 1, AHORA)).toBe(false);
  });

  test('pregunta si pasó el umbral desde el último movimiento', () => {
    // Atendió, armó el decant, pasó el rato y llegó otro cliente.
    const cart = [item(1, AHORA - (INACTIVIDAD_MS + 1_000))];
    expect(sugiereNuevoCliente(cart, 1, AHORA)).toBe(true);
  });

  test('mide contra el movimiento MÁS reciente, no el primero', () => {
    const cart = [item(1, AHORA - 600_000), item(1, AHORA - 10_000)];
    expect(sugiereNuevoCliente(cart, 1, AHORA)).toBe(false);
  });

  test('no pregunta si los items no traen addedAt', () => {
    // Canasta vieja guardada antes de que existiera el timestamp.
    expect(sugiereNuevoCliente([{ cartClientId: 1, cant: 1 }], 1, AHORA)).toBe(false);
  });

  test('respeta un umbral personalizado', () => {
    const cart = [item(1, AHORA - 30_000)];
    expect(sugiereNuevoCliente(cart, 1, AHORA, 10_000)).toBe(true);
    expect(sugiereNuevoCliente(cart, 1, AHORA, 60_000)).toBe(false);
  });
});

describe('siguienteClienteId', () => {
  test('canasta vacía arranca en 2 desde el cliente 1', () => {
    expect(siguienteClienteId([], 1)).toBe(2);
  });
  test('nunca reutiliza un número ya usado', () => {
    // Si el 3 existe, el siguiente es 4 aunque el activo sea el 1.
    const cart = [item(1, AHORA), item(3, AHORA)];
    expect(siguienteClienteId(cart, 1)).toBe(4);
  });
  test('avanza desde el activo si va por delante de la canasta', () => {
    expect(siguienteClienteId([item(1, AHORA)], 5)).toBe(6);
  });
});

describe('nombreCliente', () => {
  test('usa el nombre puesto a mano', () => {
    expect(nombreCliente({ 2: 'Juan' }, 2)).toBe('Juan');
  });
  test('cae a Cliente N sin nombre, con nombre vacío o con espacios', () => {
    expect(nombreCliente({}, 3)).toBe('Cliente 3');
    expect(nombreCliente({ 3: '   ' }, 3)).toBe('Cliente 3');
    expect(nombreCliente(null, 3)).toBe('Cliente 3');
  });
});

describe('resumenPorCliente', () => {
  test('suma piezas y total por cliente, en orden numérico', () => {
    const cart = [
      item(2, AHORA, { precio: 90, cant: 2 }),
      item(1, AHORA, { precio: 100, cant: 1 }),
      item(1, AHORA, { precio: 50,  cant: 3 }),
    ];
    const r = resumenPorCliente(cart, { 2: 'Juan' });
    expect(r.map(g => g.cid)).toEqual([1, 2]);
    expect(r[0]).toMatchObject({ nombre: 'Cliente 1', piezas: 4, total: 250 });
    expect(r[1]).toMatchObject({ nombre: 'Juan', piezas: 2, total: 180 });
  });
  test('trata cantidad y precio inválidos como 1 y 0', () => {
    const cart = [{ cartClientId: 1, cant: null, precio: undefined }];
    expect(resumenPorCliente(cart)[0]).toMatchObject({ piezas: 1, total: 0 });
  });
  test('canasta vacía devuelve lista vacía', () => {
    expect(resumenPorCliente([])).toEqual([]);
  });
});
