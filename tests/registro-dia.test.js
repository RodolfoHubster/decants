import { modoDeCanal, nombreTicketNuevo, resumenRenglones, ticketsSinNombre, validarRegistro } from '../assets/js/registro-dia.js';

const fila = (extra = {}) => ({ tid: 't1', perfumeId: 'p1', talla: '5', precio: 100, cantidad: 1, cliente: 'Laura', ...extra });

describe('modoDeCanal', () => {
  test('sobre ruedas numera; todo lo demás pide nombre', () => {
    expect(modoDeCanal('mercado')).toBe('ruedas');
    expect(modoDeCanal('online')).toBe('entregas');
    expect(modoDeCanal('otro')).toBe('entregas');
  });
});

describe('nombreTicketNuevo', () => {
  test('en sobre ruedas sigue la numeración sin repetir', () => {
    expect(nombreTicketNuevo('ruedas', [])).toBe('Cliente 1');
    expect(nombreTicketNuevo('ruedas', ['Cliente 1', 'Juan', 'Cliente 3'])).toBe('Cliente 4');
  });
  test('en entregas nace vacío para escribir el nombre', () => {
    expect(nombreTicketNuevo('entregas', ['Cliente 1'])).toBe('');
  });
});

describe('resumenRenglones', () => {
  test('dos clientes con varios perfumes; los renglones vacíos no cuentan', () => {
    const r = resumenRenglones([
      fila({ tid: 't1', precio: 135 }), fila({ tid: 't1', precio: 90 }),
      fila({ tid: 't2', cliente: 'Pedro', precio: 100, cantidad: 2 }),
      { tid: 't2', perfumeId: '', precio: '' },
    ]);
    expect(r).toEqual({ ventas: 3, clientes: 2, total: 425 });
  });
});

describe('ticketsSinNombre', () => {
  test('lista los tickets con perfumes y sin nombre, una vez cada uno', () => {
    const r = ticketsSinNombre([
      fila({ tid: 't1' }), fila({ tid: 't2', cliente: '' }), fila({ tid: 't2', cliente: '' }),
      fila({ tid: 't3', cliente: '  ' }), { tid: 't4', perfumeId: '', cliente: '' },
    ]);
    expect(r).toEqual(['t2', 't3']);
  });
});

describe('validarRegistro', () => {
  test('entregas: cada cliente necesita nombre', () => {
    expect(validarRegistro([fila(), fila({ tid: 't2', cliente: '' })], 'entregas'))
      .toEqual({ mensaje: 'Ponle nombre al cliente', tid: 't2' });
    expect(validarRegistro([fila({ cliente: '' }), fila({ tid: 't2', cliente: '' })], 'entregas').mensaje)
      .toBe('Faltan 2 nombres de cliente');
    expect(validarRegistro([fila()], 'entregas').mensaje).toBe('');
  });
  test('sobre ruedas no exige nombre', () => {
    expect(validarRegistro([fila({ cliente: '' })], 'ruedas').mensaje).toBe('');
  });
  test('sin perfumes completos', () => {
    expect(validarRegistro([{ tid: 't1', perfumeId: 'p', talla: '', precio: 0 }], 'ruedas').mensaje)
      .toMatch(/al menos un perfume/);
  });
});
