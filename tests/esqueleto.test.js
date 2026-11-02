import { barra, filasTabla, tarjetas, lista, desdeAtributo } from '../assets/js/esqueleto.js';

const cuenta = (html, txt) => html.split(txt).length - 1;

describe('filasTabla', () => {
  test('pinta las filas y columnas pedidas, con <td> reales', () => {
    const h = filasTabla(4, 3);
    expect(cuenta(h, '<tr ')).toBe(3);
    expect(cuenta(h, '<td>')).toBe(12);
  });
  test('con foto, solo la primera celda de cada fila lleva miniatura', () => {
    expect(cuenta(filasTabla(4, 3, { foto: true }), 'esq-foto')).toBe(3);
    expect(cuenta(filasTabla(4, 3), 'esq-foto')).toBe(0);
  });
});

describe('alto de las filas', () => {
  test('63 px por defecto, o el que pida el atributo, con o sin foto', () => {
    expect(filasTabla(2, 1)).toContain('--alto:63px');
    expect(desdeAtributo('tabla:6:8::86')).toContain('--alto:86px');
    expect(desdeAtributo('tabla:6:8::86')).not.toContain('esq-foto');
    expect(desdeAtributo('tabla:10:6:foto:150')).toContain('--alto:150px');
  });
});

describe('tarjetas y lista', () => {
  test('respetan cuántas y el alto', () => {
    const t = tarjetas(2, 210);
    expect(cuenta(t, 'esq-tarjeta')).toBe(2);
    expect(t).toContain('min-height:210px');
    const l = lista(3, 60);
    expect(cuenta(l, 'esq-renglon')).toBe(3);
    expect(l).toContain('height:60px');
  });
  test('barra lleva su ancho', () => {
    expect(barra(40)).toContain('width:40%');
  });
});

describe('desdeAtributo', () => {
  test('entiende los tres tipos', () => {
    expect(cuenta(desdeAtributo('tabla:10:8:foto'), '<tr ')).toBe(8);
    expect(cuenta(desdeAtributo('tabla:10:8:foto'), 'esq-foto')).toBe(8);
    expect(cuenta(desdeAtributo('tarjetas:6:150'), 'esq-tarjeta')).toBe(6);
    expect(cuenta(desdeAtributo('lista:4:44'), 'esq-renglon')).toBe(4);
  });
  test('un valor raro no pinta nada ni truena', () => {
    expect(desdeAtributo('')).toBe('');
    expect(desdeAtributo(undefined)).toBe('');
    expect(desdeAtributo('otra:1:2')).toBe('');
  });
  test('números inválidos usan el valor por defecto', () => {
    expect(cuenta(desdeAtributo('tabla:x:y'), '<tr ')).toBe(8);
  });
});
