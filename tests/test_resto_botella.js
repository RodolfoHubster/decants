/**
 * Tests for "Resto de Botella" feature
 * Extracts pure logic functions from ventas.js and estadisticas.js and tests them.
 */

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  PASS: ' + testName);
    passed++;
  } else {
    console.log('  FAIL: ' + testName);
    failed++;
  }
}

function assertApprox(actual, expected, testName, tolerance) {
  tolerance = tolerance || 0.01;
  var ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    console.log('  PASS: ' + testName + ' (' + actual + ')');
    passed++;
  } else {
    console.log('  FAIL: ' + testName + ' -- expected ' + expected + ', got ' + actual);
    failed++;
  }
}

// ===============================================================
// TEST 1: tallaItems generates options with "Resto"
// ===============================================================
console.log('\n== TEST 1: tallaItems genera opciones con Resto ==');

function tallaItems(perfumeId, perfumes, paquetesData) {
  if (perfumeId === 'custom') {
    return [
      { value: 'Completo', label: 'Botella Completa', precio: '' },
      { value: 'Otro', label: 'Otro (Manual)', precio: '' }
    ];
  }
  if (!perfumeId) return [];
  var p = perfumes.find(function(x) { return x.id === perfumeId; });
  var isPaquete = false;
  if (!p && paquetesData) {
    p = paquetesData.find(function(x) { return x.id === perfumeId; });
    if (p) isPaquete = true;
  }
  if (!p) return [];
  var items = Object.entries(p.precios || {}).filter(function(e) { return +e[1] > 0; })
    .map(function(e) { return { value: isPaquete ? 'Paquete ' + e[0] : e[0], label: e[0] + 'ml', precio: +e[1] }; });
  if (!isPaquete) {
    items.push({ value: 'Resto', label: 'Resto de Botella (Usada)', precio: '' });
    items.push({ value: 'Completo', label: 'Botella Sellada', precio: '' });
  }
  return items;
}

var mockPerfumes = [
  { id: 'p1', nombre: '212 Men', marca: 'CH', precios: { '2': 60, '3': 80, '5': 120, '10': 210 } },
  { id: 'p2', nombre: 'Sauvage', marca: 'Dior', precios: { '5': 150, '10': 280 } },
];
var mockPaquetes = [
  { id: 'paq1', nombre: 'Paquete Fresh', precios: { '5': 200, '10': 350 } },
];

var items1 = tallaItems('p1', mockPerfumes, mockPaquetes);
assert(items1.some(function(i) { return i.value === 'Resto'; }), 'Perfume regular incluye opcion Resto');
assert(items1.some(function(i) { return i.value === 'Completo'; }), 'Perfume regular incluye opcion Completo');
assert(items1.findIndex(function(i) { return i.value === 'Resto'; }) < items1.findIndex(function(i) { return i.value === 'Completo'; }),
  'Resto aparece ANTES de Completo');

var items2 = tallaItems('paq1', mockPerfumes, mockPaquetes);
assert(!items2.some(function(i) { return i.value === 'Resto'; }), 'Paquete NO incluye Resto');
assert(!items2.some(function(i) { return i.value === 'Completo'; }), 'Paquete NO incluye Completo');

var items3 = tallaItems('custom', mockPerfumes, mockPaquetes);
assert(!items3.some(function(i) { return i.value === 'Resto'; }), 'Custom NO incluye Resto');

var items4 = tallaItems('nonexistent', mockPerfumes, mockPaquetes);
assert(items4.length === 0, 'Perfume inexistente retorna array vacio');

assert(items1.length === 6, 'Perfume p1 tiene 6 opciones (4 tallas + Resto + Completo) = ' + items1.length);

var items5 = tallaItems('p2', mockPerfumes, mockPaquetes);
assert(items5.length === 4, 'Perfume p2 tiene 4 opciones (2 tallas + Resto + Completo) = ' + items5.length);


// ===============================================================
// TEST 2: checkLoteOverflow
// ===============================================================
console.log('\n== TEST 2: checkLoteOverflow detecta Resto como 100% ==');

function checkLoteOverflow(perfId, loteId, mlToSell, perfumes, ventas) {
  var p = perfumes.find(function(x) { return x.id === perfId; });
  if (!p || !p.lotes) return { overflow: false };
  var l = p.lotes.find(function(x) { return x.id === loteId; });
  if (!l) return { overflow: false };

  var totalMl = 0;
  var hasResto = false;
  ventas.forEach(function(v) {
    if (v.perfumeId === perfId && v.loteId === loteId) {
      if (['2','3','5','10'].indexOf(v.talla) >= 0) totalMl += parseInt(v.talla) * (+v.cantidad || 1);
      if (v.talla === 'Resto') hasResto = true;
    }
  });

  var maxCap = parseFloat(l.tamano) || 100;
  if (hasResto) totalMl = maxCap;

  return { overflow: totalMl + mlToSell > maxCap, totalMl: totalMl, maxCap: maxCap, hasResto: hasResto };
}

var perfumesWithLotes = [
  { id: 'p1', nombre: '212 Men', lotes: [{ id: 'lote-1', tamano: 100, costo: 1200 }] },
];

var ventasNormal = [
  { perfumeId: 'p1', loteId: 'lote-1', talla: '5', cantidad: 1, precio: 120 },
  { perfumeId: 'p1', loteId: 'lote-1', talla: '10', cantidad: 2, precio: 210 },
];
var r2a = checkLoteOverflow('p1', 'lote-1', 5, perfumesWithLotes, ventasNormal);
assert(!r2a.overflow, 'Sin overflow: 25ml + 5ml = 30ml < 100ml');
assertApprox(r2a.totalMl, 25, 'totalMl = 5 + 10*2 = 25');

var r2b = checkLoteOverflow('p1', 'lote-1', 80, perfumesWithLotes, ventasNormal);
assert(r2b.overflow, 'Con overflow: 25ml + 80ml = 105ml > 100ml');

var ventasConResto = [
  { perfumeId: 'p1', loteId: 'lote-1', talla: '5', cantidad: 1, precio: 120 },
  { perfumeId: 'p1', loteId: 'lote-1', talla: 'Resto', cantidad: 1, precio: 500 },
];
var r2c = checkLoteOverflow('p1', 'lote-1', 5, perfumesWithLotes, ventasConResto);
assert(r2c.overflow, 'Resto vendido: cualquier venta extra causa overflow');
assert(r2c.hasResto, 'hasResto es true');
assertApprox(r2c.totalMl, 100, 'totalMl forzado a maxCap (100) por Resto');

var r2d = checkLoteOverflow('p1', 'lote-1', 0, perfumesWithLotes, ventasConResto);
assert(!r2d.overflow, 'Resto + 0ml extra NO es overflow (100 + 0 no > 100)');


// ===============================================================
// TEST 3: Profitability
// ===============================================================
console.log('\n== TEST 3: Rentabilidad con venta de Resto ==');

function calcLoteProfitability(loteHist, lote, precios, costoInsumoUnitario) {
  var totalMlVendidos = 0;
  var totalDecantsVendidos = 0;
  var ingresoReal = 0;
  var restoVendido = false;

  loteHist.forEach(function(v) {
    if (['2','3','5','10'].indexOf(v.talla) >= 0) {
      var c = +v.cantidad || 1;
      totalMlVendidos += (parseInt(v.talla) * c);
      totalDecantsVendidos += c;
      ingresoReal += (+v.precio || 0) * c;
    } else if (v.talla === 'Resto') {
      var c2 = +v.cantidad || 1;
      ingresoReal += (+v.precio || 0) * c2;
      restoVendido = true;
    }
  });

  var costoBotella = parseFloat(lote.costo) || 0;
  var tamanoBotella = parseFloat(lote.tamano) || 100;

  if (restoVendido) totalMlVendidos = tamanoBotella;

  var progresoPorcentaje = tamanoBotella > 0 ? Math.min(100, Math.round((totalMlVendidos / tamanoBotella) * 100)) : 0;
  var costoInsumosReal = totalDecantsVendidos * costoInsumoUnitario;
  var costoInversionReal = costoBotella + costoInsumosReal;
  var gananciaReal = ingresoReal - costoInversionReal;

  var gananciaNetaFinal = gananciaReal;
  if (!restoVendido && totalMlVendidos < tamanoBotella) {
    gananciaNetaFinal = -9999;
  }

  return { totalMlVendidos: totalMlVendidos, ingresoReal: ingresoReal, progresoPorcentaje: progresoPorcentaje, costoInversionReal: costoInversionReal, gananciaReal: gananciaReal, gananciaNetaFinal: gananciaNetaFinal, restoVendido: restoVendido };
}

var lote = { id: 'lote-1', tamano: 100, costo: 1200 };
var costoInsumo = 15;

var hist3a = [
  { talla: '5', cantidad: 3, precio: 120 },
  { talla: '10', cantidad: 2, precio: 210 },
];
var r3a = calcLoteProfitability(hist3a, lote, {}, costoInsumo);
assertApprox(r3a.totalMlVendidos, 35, '3a: totalMlVendidos = 15+20 = 35');
assertApprox(r3a.ingresoReal, 780, '3a: ingresoReal = 360+420 = $780');
assert(r3a.progresoPorcentaje === 35, '3a: progreso = 35%');
assertApprox(r3a.costoInversionReal, 1275, '3a: costoInversion = 1200 + 75 = $1275');
assertApprox(r3a.gananciaReal, -495, '3a: gananciaReal = -$495');
assert(!r3a.restoVendido, '3a: restoVendido = false');
assert(r3a.gananciaNetaFinal === -9999, '3a: projection would run');

var hist3b = [
  { talla: '5', cantidad: 3, precio: 120 },
  { talla: '10', cantidad: 2, precio: 210 },
  { talla: 'Resto', cantidad: 1, precio: 500 },
];
var r3b = calcLoteProfitability(hist3b, lote, {}, costoInsumo);
assertApprox(r3b.totalMlVendidos, 100, '3b: totalMlVendidos forzado a 100 por Resto');
assert(r3b.progresoPorcentaje === 100, '3b: progreso = 100%');
assertApprox(r3b.ingresoReal, 1280, '3b: ingresoReal = 780 + 500 = $1280');
assertApprox(r3b.costoInversionReal, 1275, '3b: costoInversion = $1275');
assertApprox(r3b.gananciaReal, 5, '3b: gananciaReal = $5');
assert(r3b.restoVendido, '3b: restoVendido = true');
assertApprox(r3b.gananciaNetaFinal, r3b.gananciaReal, '3b: gananciaNetaFinal = gananciaReal');

var hist3c = [
  { talla: 'Resto', cantidad: 1, precio: 800 },
];
var r3c = calcLoteProfitability(hist3c, lote, {}, costoInsumo);
assertApprox(r3c.totalMlVendidos, 100, '3c: totalMlVendidos = 100');
assert(r3c.progresoPorcentaje === 100, '3c: progreso = 100%');
assertApprox(r3c.ingresoReal, 800, '3c: ingresoReal = $800');
assertApprox(r3c.costoInversionReal, 1200, '3c: costoInversion = $1200');
assertApprox(r3c.gananciaReal, -400, '3c: gananciaReal = -$400');
assert(r3c.gananciaNetaFinal === r3c.gananciaReal, '3c: gananciaNetaFinal = gananciaReal');


// ===============================================================
// TEST 4: Alertas Inventario
// ===============================================================
console.log('\n== TEST 4: Alertas de Inventario con Resto ==');

function calcAlertPct(perfume, pSoldsData) {
  var data = pSoldsData[perfume.id] || { ml: 0, byLote: {} };
  var totalCap = 0;
  var sold = 0;

  if (perfume.lotes && perfume.lotes.length > 0) {
    perfume.lotes.forEach(function(l) {
      var lCap = +l.tamano || 0;
      totalCap += lCap;
      var lSoldData = data.byLote[l.id] || { ml: 0, hasResto: false };
      var lSold = lSoldData.ml;
      if (lSoldData.hasResto) lSold = lCap;
      sold += lSold;
    });
  } else {
    totalCap = +perfume.tamanoBotella || 0;
    sold = data.ml;
    if (data.byLote['lote-1'] && data.byLote['lote-1'].hasResto) sold = totalCap;
  }

  return { pct: totalCap > 0 ? (sold / totalCap) * 100 : 0, sold: sold, totalCap: totalCap };
}

var perfAlerta = { id: 'p1', nombre: '212 Men', lotes: [{ id: 'lote-1', tamano: 100 }] };

var r4a = calcAlertPct(perfAlerta, {});
assertApprox(r4a.pct, 0, '4a: Sin ventas = 0%');

var pSoldsNormal = { p1: { ml: 50, byLote: { 'lote-1': { ml: 50, hasResto: false } } } };
var r4b = calcAlertPct(perfAlerta, pSoldsNormal);
assertApprox(r4b.pct, 50, '4b: 50ml de 100ml = 50%');

var pSoldsResto = { p1: { ml: 30, byLote: { 'lote-1': { ml: 30, hasResto: true } } } };
var r4c = calcAlertPct(perfAlerta, pSoldsResto);
assertApprox(r4c.pct, 100, '4c: Resto vendido fuerza 100%');

var perfMultiLote = { id: 'p2', nombre: 'Sauvage', lotes: [
  { id: 'lote-1', tamano: 100 },
  { id: 'lote-2', tamano: 100 },
]};
var pSoldsMulti = { p2: { ml: 60, byLote: {
  'lote-1': { ml: 40, hasResto: true },
  'lote-2': { ml: 20, hasResto: false },
}}};
var r4d = calcAlertPct(perfMultiLote, pSoldsMulti);
assertApprox(r4d.pct, 60, '4d: Multi-lote: (100+20)/200 = 60%');
assertApprox(r4d.sold, 120, '4d: sold = 100 + 20 = 120');

var perfLegacy = { id: 'p3', nombre: 'Legacy', tamanoBotella: 50 };
var pSoldsLegacy = { p3: { ml: 10, byLote: { 'lote-1': { ml: 10, hasResto: true } } } };
var r4e = calcAlertPct(perfLegacy, pSoldsLegacy);
assertApprox(r4e.pct, 100, '4e: Legacy sin lotes + Resto = 100%');


// ===============================================================
// TEST 5: KPIs
// ===============================================================
console.log('\n== TEST 5: KPIs incluyen ingreso de Resto ==');

function calcKPIs(ventasFiltradas) {
  var ingresos = 0;
  var decants = 0;
  var ml = 0;

  ventasFiltradas.forEach(function(v) {
    var cant = +v.cantidad || 1;
    var precio = +v.precio || 0;

    if (v.talla !== 'Completo' && v.talla !== 'Otro') {
      var t = parseFloat(v.talla) || 0;
      decants += cant;
      ml += (t * cant);
    }

    ingresos += (precio * cant);
  });

  return { ingresos: ingresos, decants: decants, ml: ml };
}

var ventasResto = [
  { perfumeId: 'p1', talla: 'Resto', cantidad: 1, precio: 500 },
];
var r5a = calcKPIs(ventasResto);
assertApprox(r5a.ingresos, 500, '5a: Ingresos incluyen $500 de Resto');
assert(r5a.decants === 1, '5a: decants cuenta Resto como 1 unidad');
assertApprox(r5a.ml, 0, '5a: ml = 0 (Resto no tiene ml numericos)');

var ventasMixed = [
  { perfumeId: 'p1', talla: '5', cantidad: 2, precio: 120 },
  { perfumeId: 'p1', talla: 'Resto', cantidad: 1, precio: 500 },
];
var r5b = calcKPIs(ventasMixed);
assertApprox(r5b.ingresos, 740, '5b: Ingresos = 240 + 500 = $740');


// ===============================================================
// SUMMARY
// ===============================================================
console.log('\n==========================================');
console.log('  RESULTADOS: ' + passed + ' passed, ' + failed + ' failed');
console.log('==========================================');
if (failed > 0) {
  process.exit(1);
} else {
  console.log('  Todos los tests pasaron correctamente.\n');
}
