import { estadoStockAuto, siguienteEstado } from '../assets/js/estado-stock.js';

const venta = (talla, extra = {}) => ({ perfumeId: 'p', talla, cantidad: 1, estado: 'pagada', ...extra });

// Libre: botella 1 vieja (con ventas sin registrar), botella 2 en uso.
const libre = {
  id: 'p', loteActivo: 'b2',
  lotes: [{ id: 'b1', tamano: 90, costo: 1960, mlAjuste: 39 }, { id: 'b2', tamano: 150, costo: 2200 }],
};

describe('estadoStockAuto', () => {
  test('una botella vieja con huecos ya no impide marcar agotado', () => {
    const ventas = [venta('10', { loteId: 'b2', cantidad: 15 })];
    expect(estadoStockAuto(libre, ventas).estado).toBe('agotado');
  });
  test('vender el Resto de la botella en uso la deja en 0', () => {
    expect(estadoStockAuto(libre, [venta('Resto', { loteId: 'b2' })])).toEqual({ estado: 'agotado', restante: 0, capacidad: 150 });
  });
  test('el Resto no agota si hay una botella nueva después de la activa', () => {
    const conNueva = { ...libre, lotes: [...libre.lotes, { id: 'b3', tamano: 100 }] };
    expect(estadoStockAuto(conNueva, [venta('Resto', { loteId: 'b2' })]).estado).toBe('normal');
  });
  test('poner "quedan 0 ml" (ajuste) agota, cuente o no las ventas sin botella', () => {
    // Miss Dior: 75 ml vendidos (algunos sin botella guardada) + ajuste 25 = 100.
    const dior = { id: 'p', loteActivo: 'd1', lotes: [{ id: 'd1', tamano: 100, mlAjuste: 25 }] };
    const ventas = [venta('5', { loteId: 'd1', cantidad: 10 }), venta('5', { cantidad: 5 })];
    expect(estadoStockAuto(dior, ventas).estado).toBe('agotado');
  });
  test('lo dejado en un punto externo cuenta como usado', () => {
    const p = { id: 'p', loteActivo: 'a', lotes: [{ id: 'a', tamano: 100 }] };
    const ventas = [venta('10', { loteId: 'a', cantidad: 6 })];
    expect(estadoStockAuto(p, ventas).estado).toBe('normal');
    expect(estadoStockAuto(p, ventas, [{ perfumeId: 'p', talla: '10', cantidad: 3 }]).estado).toBe('por_acabarse');
  });
  test('por acabarse con 15% o menos de lo que queda', () => {
    const p = { id: 'p', loteActivo: 'a', lotes: [{ id: 'a', tamano: 100 }] };
    expect(estadoStockAuto(p, [venta('5', { loteId: 'a', cantidad: 17 })]).estado).toBe('por_acabarse');
    expect(estadoStockAuto(p, [venta('5', { loteId: 'a', cantidad: 16 })]).estado).toBe('normal');
  });
  test('las ventas canceladas no gastan', () => {
    expect(estadoStockAuto(libre, [venta('Resto', { loteId: 'b2', estado: 'cancelada' })]).estado).toBe('normal');
  });
  test('sin botella activa guardada, usa la última', () => {
    const p = { ...libre, loteActivo: undefined };
    expect(estadoStockAuto(p, [venta('Resto', { loteId: 'b2' })]).estado).toBe('agotado');
  });
  test('perfume de antes de los lotes y perfume sin datos de botella', () => {
    const viejo = { id: 'p', costoBotella: 900, tamanoBotella: 50 };
    expect(estadoStockAuto(viejo, [venta('10', { cantidad: 5 })]).estado).toBe('agotado');
    expect(estadoStockAuto({ id: 'p' }, [venta('10')]).estado).toBe('normal');
  });
});

describe('siguienteEstado', () => {
  test('al medir la botella manda lo medido, en los dos sentidos', () => {
    expect(siguienteEstado('normal', 'agotado')).toBe('agotado');
    expect(siguienteEstado('agotado', 'normal')).toBe('normal');
  });
  test('al registrar ventas solo sube: no quita un agotado puesto a mano', () => {
    expect(siguienteEstado('normal', 'por_acabarse', { soloSubir: true })).toBe('por_acabarse');
    expect(siguienteEstado('por_acabarse', 'agotado', { soloSubir: true })).toBe('agotado');
    expect(siguienteEstado('agotado', 'normal', { soloSubir: true })).toBeNull();
  });
  test('sin cambio o con valores raros, nada', () => {
    expect(siguienteEstado('agotado', 'agotado')).toBeNull();
    expect(siguienteEstado(undefined, 'normal')).toBeNull();
    expect(siguienteEstado(undefined, 'agotado', { soloSubir: true })).toBe('agotado');
    expect(siguienteEstado('normal', 'otro')).toBeNull();
  });
});
