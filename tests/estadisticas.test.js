/**
 * Pruebas unitarias para Prioridad 3: Estadísticas y Ganancias
 */

function calculateKPIs(ventasFiltradas, perfumes, costosOp) {
  let ingresosTotales = 0;
  let costoTotalInversion = 0;
  const ventasUnicas = new Set();
  const costoInsumoUnitario = (+costosOp.botella || 0) + (+costosOp.etiqueta || 0) + (+costosOp.bolsa || 0);
  
  ventasFiltradas.forEach(v => {
    if (v.estado === 'cancelada') return; // FIX: Ignore canceled in KPIs
    
    const cant = +v.cantidad || 1;
    const precio = +v.precio || 0;
    ingresosTotales += (precio * cant);
    
    // FIX: Unique transactions using posClientId if available, or exact timestamp
    let orderKey = '';
    if (v.cartClientId) {
      const d = new Date(v.creadoEn || 0);
      const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      orderKey = `${v.cliente || 'Anon'}_${dateStr}_cart${v.cartClientId}`;
    } else {
      orderKey = (v.creadoEn || Math.random()).toString();
    }
    ventasUnicas.add(orderKey);

    const getLote = (p, lId) => {
      if (!p || !p.lotes) return null;
      return p.lotes.find(l => l.id === lId) || p.lotes[0];
    };

    if (v.talla === 'Completo') {
      const p = perfumes.find(x => x.id === v.perfumeId);
      if (p) costoTotalInversion += (+p.costoBotella || 0) * cant;
    } else if (v.paqueteItems && Array.isArray(v.paqueteItems)) {
      let t = parseFloat(v.talla.replace('Paquete ', '')) || 0;
      let itemCount = v.paqueteItems.length;
      if (t > 0) {
        let costoInsumosPaquete = (+costosOp.bolsa || 0) + (((+costosOp.botella || 0) + (+costosOp.etiqueta || 0)) * itemCount);
        costoTotalInversion += (costoInsumosPaquete * cant);
        
        v.paqueteItems.forEach(item => {
          const p = perfumes.find(x => x.id === item.id);
          if (p) {
            const l = getLote(p, item.loteId); // FIX: Use specific lote
            let costoMl = 0;
            if (l) costoMl = (+l.costo || 0) / (+l.tamano || 1);
            else if (p.costoBotella && p.tamanoBotella) costoMl = (+p.costoBotella) / (+p.tamanoBotella);
            costoTotalInversion += (costoMl * t * cant);
          }
        });
      }
    } else if (v.talla !== 'Otro') {
      let t = parseFloat(v.talla);
      if (!isNaN(t) && t > 0) {
        costoTotalInversion += (costoInsumoUnitario * cant);
        const p = perfumes.find(x => x.id === v.perfumeId);
        if (p) {
          const l = getLote(p, v.loteId); // FIX: Use specific lote
          let costoMl = 0;
          if (l) costoMl = (+l.costo || 0) / (+l.tamano || 1);
          else if (p.costoBotella && p.tamanoBotella) costoMl = (+p.costoBotella) / (+p.tamanoBotella);
          costoTotalInversion += (costoMl * t * cant);
        }
      } else if (v.talla === 'Resto') {
        // FIX: No cobra insumos unitarios (botella+etiqueta) para Resto, solo el costo del líquido/botella original.
        const p = perfumes.find(x => x.id === v.perfumeId);
        if (p) {
          const l = getLote(p, v.loteId); // FIX: Use specific lote
          let costoResto = 0;
          if (l) costoResto = +l.costo || 0;
          else costoResto = +p.costoBotella || 0;
          costoTotalInversion += (costoResto * cant);
        }
      }
    }
  });
  
  return {
    ingresosTotales,
    costoTotalInversion,
    ventasUnicasCount: ventasUnicas.size
  };
}


describe('Prioridad 3 - Estadísticas y Ganancias', () => {

  const mockCostosOp = { botella: 10, etiqueta: 5, bolsa: 2 }; // Total insumo = 17
  const mockPerfumes = [{
    id: 'p1',
    costoBotella: 1000,
    tamanoBotella: 100, // $10 per ml
    lotes: [
      { id: 'lote-1', costo: 1000, tamano: 100 }, // $10 per ml
      { id: 'lote-2', costo: 1500, tamano: 100 }  // $15 per ml (subida de precio)
    ]
  }];

  test('Ingreso total = suma de (precio x cantidad) ignorando ventas canceladas', () => {
    const ventas = [
      { estado: 'pagada', precio: 100, cantidad: 1 },
      { estado: 'cancelada', precio: 200, cantidad: 1 },
      { estado: 'pendiente', precio: 150, cantidad: 2 },
    ];
    const res = calculateKPIs(ventas, mockPerfumes, mockCostosOp);
    expect(res.ingresosTotales).toBe(400); // 100 + (150*2)
  });

  test('Costo usa el lote específico de la venta, no siempre el lote 1', () => {
    const ventas = [
      // Vende 10ml del lote 1 ($10/ml * 10 = $100 líquido + $17 insumos)
      { estado: 'pagada', perfumeId: 'p1', loteId: 'lote-1', talla: '10', cantidad: 1, precio: 200 },
      // Vende 10ml del lote 2 ($15/ml * 10 = $150 líquido + $17 insumos)
      { estado: 'pagada', perfumeId: 'p1', loteId: 'lote-2', talla: '10', cantidad: 1, precio: 250 },
    ];
    const res = calculateKPIs(ventas, mockPerfumes, mockCostosOp);
    expect(res.costoTotalInversion).toBe(117 + 167); 
  });

  test('Rentabilidad de "Resto" NO cobra doble insumos (no suma botella+etiqueta)', () => {
    const ventas = [
      // Resto del lote 2 (costo original 1500). No suma insumos.
      { estado: 'pagada', perfumeId: 'p1', loteId: 'lote-2', talla: 'Resto', cantidad: 1, precio: 500 },
    ];
    const res = calculateKPIs(ventas, mockPerfumes, mockCostosOp);
    expect(res.costoTotalInversion).toBe(1500); // Sólo cobra el costo de la botella, no insumos extra
  });

  test('Ticket promedio agrupa transacciones usando identificador único de ticket', () => {
    const ventas = [
      { estado: 'pagada', cliente: 'Juan', creadoEn: 1000, cartClientId: 1 },
      { estado: 'pagada', cliente: 'Juan', creadoEn: 1000, cartClientId: 1 }, // Mismo ticket
      { estado: 'pagada', cliente: 'Juan', creadoEn: 5000, cartClientId: 2 }, // Ticket distinto, mismo día, mismo cliente
    ];
    const res = calculateKPIs(ventas, mockPerfumes, mockCostosOp);
    expect(res.ventasUnicasCount).toBe(2); 
  });

});
