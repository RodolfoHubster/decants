/**
 * Tests for "Resto de Botella" feature
 * Extracts pure logic from ventas.js and estadisticas.js to test offline.
 */

// ── Extracted: tallaItems from ventas.js ──
function tallaItems(perfumeId, perfumes, paquetesData) {
  if (perfumeId === 'custom') {
    return [
      { value: 'Completo', label: 'Botella Completa', precio: '' },
      { value: 'Otro', label: 'Otro (Manual)', precio: '' }
    ];
  }
  if (!perfumeId) return [];
  let p = perfumes.find(x => x.id === perfumeId);
  let isPaquete = false;
  if (!p && paquetesData) {
    p = paquetesData.find(x => x.id === perfumeId);
    if (p) isPaquete = true;
  }
  if (!p) return [];
  const items = Object.entries(p.precios || {}).filter(([, v]) => +v > 0)
    .map(([k, v]) => ({ value: isPaquete ? `Paquete ${k}` : k, label: `${k}ml`, precio: +v }));
  if (!isPaquete) {
    items.push({ value: 'Resto', label: 'Resto de Botella (Usada)', precio: '' });
    items.push({ value: 'Completo', label: 'Botella Sellada', precio: '' });
  }
  return items;
}

// ── Extracted: checkLoteOverflow from ventas.js ──
function checkLoteOverflow(perfId, loteId, mlToSell, perfumes, ventas) {
  const p = perfumes.find(x => x.id === perfId);
  if (!p || !p.lotes) return { overflow: false };
  const l = p.lotes.find(x => x.id === loteId);
  if (!l) return { overflow: false };

  let totalMl = 0;
  let hasResto = false;
  ventas.forEach(v => {
    if (v.perfumeId === perfId && v.loteId === loteId) {
      if (['2', '3', '5', '10'].includes(v.talla)) totalMl += parseInt(v.talla) * (+v.cantidad || 1);
      if (v.talla === 'Resto') hasResto = true;
    }
  });

  const maxCap = parseFloat(l.tamano) || 100;
  if (hasResto) totalMl = maxCap;

  return { overflow: totalMl + mlToSell > maxCap, totalMl, maxCap, hasResto };
}

// ── Extracted: profitability calc from estadisticas.js ──
function calcLoteProfitability(loteHist, lote, costoInsumoUnitario) {
  let totalMlVendidos = 0;
  let totalDecantsVendidos = 0;
  let ingresoReal = 0;
  let restoVendido = false;

  loteHist.forEach(v => {
    if (['2', '3', '5', '10'].includes(v.talla)) {
      const c = +v.cantidad || 1;
      totalMlVendidos += parseInt(v.talla) * c;
      totalDecantsVendidos += c;
      ingresoReal += (+v.precio || 0) * c;
    } else if (v.talla === 'Resto') {
      const c = +v.cantidad || 1;
      ingresoReal += (+v.precio || 0) * c;
      restoVendido = true;
    }
  });

  const costoBotella = parseFloat(lote.costo) || 0;
  const tamanoBotella = parseFloat(lote.tamano) || 100;
  if (restoVendido) totalMlVendidos = tamanoBotella;

  const progresoPorcentaje = tamanoBotella > 0 ? Math.min(100, Math.round((totalMlVendidos / tamanoBotella) * 100)) : 0;
  const costoInsumosReal = totalDecantsVendidos * costoInsumoUnitario;
  const costoInversionReal = costoBotella + costoInsumosReal;
  const gananciaReal = ingresoReal - costoInversionReal;

  let gananciaNetaFinal = gananciaReal;
  if (!restoVendido && totalMlVendidos < tamanoBotella) {
    gananciaNetaFinal = null; // projection would run
  }

  return { totalMlVendidos, ingresoReal, progresoPorcentaje, costoInversionReal, gananciaReal, gananciaNetaFinal, restoVendido };
}

// ── Extracted: alert % calc from estadisticas.js ──
function calcAlertPct(perfume, pSoldsData) {
  const data = pSoldsData[perfume.id] || { ml: 0, byLote: {} };
  let totalCap = 0;
  let sold = 0;

  if (perfume.lotes && perfume.lotes.length > 0) {
    perfume.lotes.forEach(l => {
      const lCap = +l.tamano || 0;
      totalCap += lCap;
      const lSoldData = data.byLote[l.id] || { ml: 0, hasResto: false };
      let lSold = lSoldData.ml;
      if (lSoldData.hasResto) lSold = lCap;
      sold += lSold;
    });
  } else {
    totalCap = +perfume.tamanoBotella || 0;
    sold = data.ml;
    if (data.byLote['lote-1'] && data.byLote['lote-1'].hasResto) sold = totalCap;
  }

  return { pct: totalCap > 0 ? (sold / totalCap) * 100 : 0, sold, totalCap };
}


// ══════════════════════════════════════════════════════════════
// TEST DATA
// ══════════════════════════════════════════════════════════════
const mockPerfumes = [
  { id: 'p1', nombre: '212 Men', marca: 'CH', precios: { '2': 60, '3': 80, '5': 120, '10': 210 } },
  { id: 'p2', nombre: 'Sauvage', marca: 'Dior', precios: { '5': 150, '10': 280 } },
];
const mockPaquetes = [
  { id: 'paq1', nombre: 'Paquete Fresh', precios: { '5': 200, '10': 350 } },
];
const perfumesWithLotes = [
  { id: 'p1', nombre: '212 Men', lotes: [{ id: 'lote-1', tamano: 100, costo: 1200 }] },
];
const lote = { id: 'lote-1', tamano: 100, costo: 1200 };
const costoInsumo = 15;


// ══════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════

describe('tallaItems — dropdown options', () => {
  test('perfume regular incluye Resto y Completo', () => {
    const items = tallaItems('p1', mockPerfumes, mockPaquetes);
    expect(items.some(i => i.value === 'Resto')).toBe(true);
    expect(items.some(i => i.value === 'Completo')).toBe(true);
  });

  test('Resto aparece antes de Completo', () => {
    const items = tallaItems('p1', mockPerfumes, mockPaquetes);
    const iResto = items.findIndex(i => i.value === 'Resto');
    const iCompleto = items.findIndex(i => i.value === 'Completo');
    expect(iResto).toBeLessThan(iCompleto);
  });

  test('paquete NO incluye Resto ni Completo', () => {
    const items = tallaItems('paq1', mockPerfumes, mockPaquetes);
    expect(items.some(i => i.value === 'Resto')).toBe(false);
    expect(items.some(i => i.value === 'Completo')).toBe(false);
  });

  test('custom NO incluye Resto', () => {
    const items = tallaItems('custom', mockPerfumes, mockPaquetes);
    expect(items.some(i => i.value === 'Resto')).toBe(false);
  });

  test('perfume inexistente retorna array vacío', () => {
    expect(tallaItems('xxx', mockPerfumes, mockPaquetes)).toEqual([]);
  });

  test('p1 tiene 6 opciones (4 tallas + Resto + Completo)', () => {
    expect(tallaItems('p1', mockPerfumes, mockPaquetes).length).toBe(6);
  });

  test('p2 tiene 4 opciones (2 tallas + Resto + Completo)', () => {
    expect(tallaItems('p2', mockPerfumes, mockPaquetes).length).toBe(4);
  });
});


describe('checkLoteOverflow — Resto fuerza 100%', () => {
  test('sin overflow: 25ml + 5ml < 100ml', () => {
    const ventas = [
      { perfumeId: 'p1', loteId: 'lote-1', talla: '5', cantidad: 1 },
      { perfumeId: 'p1', loteId: 'lote-1', talla: '10', cantidad: 2 },
    ];
    const r = checkLoteOverflow('p1', 'lote-1', 5, perfumesWithLotes, ventas);
    expect(r.overflow).toBe(false);
    expect(r.totalMl).toBe(25);
  });

  test('con overflow: 25ml + 80ml > 100ml', () => {
    const ventas = [
      { perfumeId: 'p1', loteId: 'lote-1', talla: '5', cantidad: 1 },
      { perfumeId: 'p1', loteId: 'lote-1', talla: '10', cantidad: 2 },
    ];
    const r = checkLoteOverflow('p1', 'lote-1', 80, perfumesWithLotes, ventas);
    expect(r.overflow).toBe(true);
  });

  test('Resto vendido: cualquier venta extra causa overflow', () => {
    const ventas = [
      { perfumeId: 'p1', loteId: 'lote-1', talla: '5', cantidad: 1 },
      { perfumeId: 'p1', loteId: 'lote-1', talla: 'Resto', cantidad: 1 },
    ];
    const r = checkLoteOverflow('p1', 'lote-1', 5, perfumesWithLotes, ventas);
    expect(r.overflow).toBe(true);
    expect(r.hasResto).toBe(true);
    expect(r.totalMl).toBe(100);
  });

  test('Resto + 0ml extra NO es overflow (100 + 0 = 100, not > 100)', () => {
    const ventas = [
      { perfumeId: 'p1', loteId: 'lote-1', talla: 'Resto', cantidad: 1 },
    ];
    const r = checkLoteOverflow('p1', 'lote-1', 0, perfumesWithLotes, ventas);
    expect(r.overflow).toBe(false);
  });
});


describe('Rentabilidad — Resto marca botella 100% y suma ingreso', () => {
  test('solo decants: progreso parcial, ganancia negativa si pocos', () => {
    const hist = [
      { talla: '5', cantidad: 3, precio: 120 },  // 15ml, $360
      { talla: '10', cantidad: 2, precio: 210 }, // 20ml, $420
    ];
    const r = calcLoteProfitability(hist, lote, costoInsumo);
    expect(r.totalMlVendidos).toBe(35);
    expect(r.ingresoReal).toBe(780);
    expect(r.progresoPorcentaje).toBe(35);
    expect(r.costoInversionReal).toBe(1275); // 1200 + 5*15
    expect(r.gananciaReal).toBe(-495);
    expect(r.restoVendido).toBe(false);
    expect(r.gananciaNetaFinal).toBeNull(); // projection would run
  });

  test('decants + Resto: 100%, ingreso incluye venta del Resto', () => {
    const hist = [
      { talla: '5', cantidad: 3, precio: 120 },
      { talla: '10', cantidad: 2, precio: 210 },
      { talla: 'Resto', cantidad: 1, precio: 500 },
    ];
    const r = calcLoteProfitability(hist, lote, costoInsumo);
    expect(r.totalMlVendidos).toBe(100);
    expect(r.progresoPorcentaje).toBe(100);
    expect(r.ingresoReal).toBe(1280); // 780 + 500
    expect(r.costoInversionReal).toBe(1275); // solo decants generan insumos
    expect(r.gananciaReal).toBe(5);
    expect(r.restoVendido).toBe(true);
    expect(r.gananciaNetaFinal).toBe(r.gananciaReal); // no projection
  });

  test('solo Resto sin decants: 100%, perdida si vendió barato', () => {
    const hist = [
      { talla: 'Resto', cantidad: 1, precio: 800 },
    ];
    const r = calcLoteProfitability(hist, lote, costoInsumo);
    expect(r.totalMlVendidos).toBe(100);
    expect(r.progresoPorcentaje).toBe(100);
    expect(r.ingresoReal).toBe(800);
    expect(r.costoInversionReal).toBe(1200); // solo botella
    expect(r.gananciaReal).toBe(-400);
    expect(r.gananciaNetaFinal).toBe(-400);
  });
});


describe('Alertas Inventario — Resto = 100% consumido', () => {
  test('sin ventas = 0%', () => {
    const perf = { id: 'p1', lotes: [{ id: 'lote-1', tamano: 100 }] };
    expect(calcAlertPct(perf, {}).pct).toBe(0);
  });

  test('50ml vendidos de 100ml = 50%', () => {
    const perf = { id: 'p1', lotes: [{ id: 'lote-1', tamano: 100 }] };
    const data = { p1: { ml: 50, byLote: { 'lote-1': { ml: 50, hasResto: false } } } };
    expect(calcAlertPct(perf, data).pct).toBe(50);
  });

  test('Resto vendido fuerza 100% aunque solo 30ml de decants', () => {
    const perf = { id: 'p1', lotes: [{ id: 'lote-1', tamano: 100 }] };
    const data = { p1: { ml: 30, byLote: { 'lote-1': { ml: 30, hasResto: true } } } };
    expect(calcAlertPct(perf, data).pct).toBe(100);
  });

  test('multi-lote: uno con Resto otro sin', () => {
    const perf = { id: 'p2', lotes: [
      { id: 'lote-1', tamano: 100 },
      { id: 'lote-2', tamano: 100 },
    ]};
    const data = { p2: { ml: 60, byLote: {
      'lote-1': { ml: 40, hasResto: true },  // forces to 100
      'lote-2': { ml: 20, hasResto: false },  // stays at 20
    }}};
    const r = calcAlertPct(perf, data);
    expect(r.pct).toBe(60);  // 120/200
    expect(r.sold).toBe(120);
  });

  test('perfume legacy sin lotes + Resto = 100%', () => {
    const perf = { id: 'p3', tamanoBotella: 50 };
    const data = { p3: { ml: 10, byLote: { 'lote-1': { ml: 10, hasResto: true } } } };
    expect(calcAlertPct(perf, data).pct).toBe(100);
  });
});
