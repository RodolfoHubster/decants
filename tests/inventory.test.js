/**
 * Pruebas unitarias para Prioridad 1: Inventario y Mililitros
 */

function getLoteRemaining(perfId, loteId, perfumes, ventas) {
  if (!perfumes || !ventas) return { cap: 100, sold: 0, rem: 100, hasResto: false };
  const p = perfumes.find(x => x.id === perfId);
  if (!p || !p.lotes) return { cap: parseFloat(p?.tamanoBotella)||100, sold: 0, rem: parseFloat(p?.tamanoBotella)||100, hasResto: false };
  const l = p.lotes.find(x => x.id === loteId);
  if (!l) return { cap: parseFloat(p.tamanoBotella)||100, sold: 0, rem: parseFloat(p.tamanoBotella)||100, hasResto: false };
  
  let totalMl = 0;
  let hasResto = false;
  ventas.forEach(v => {
    if (v.estado === 'cancelada') return; // ignore canceled!
    if (v.perfumeId === perfId && v.loteId === loteId) {
       if (v.talla === 'Resto') {
         hasResto = true;
       } else if (v.talla !== 'Completo') {
         // FIXED LOGIC: Extract any number instead of restricting to 2,3,5,10
         const ml = parseInt(v.talla);
         if (!isNaN(ml)) {
           totalMl += ml * (+v.cantidad || 1);
         }
       }
    } else if (v.paqueteItems) {
       const sub = v.paqueteItems.find(i => i.id === perfId);
       if (sub && sub.loteId === loteId) {
          let ml = 0;
          if (v.talla && v.talla.startsWith('Paquete ')) ml = parseInt(v.talla.replace('Paquete ',''));
          else ml = parseInt(v.talla || '0');
          if (!isNaN(ml)) totalMl += ml * (+v.cantidad||1);
       }
    }
  });
  
  const cap = parseFloat(l.tamano) || 100;
  if (hasResto) totalMl = cap; // Resto consumes everything
  
  return { cap, sold: totalMl, rem: Math.max(0, cap - totalMl), hasResto };
}

function getSmartLoteId(p, saleDate) {
  if (!p) return 'lote-1';
  if (!p.lotes || p.lotes.length === 0) return p.loteActivo || 'lote-1';
  if (!saleDate) return p.loteActivo || p.lotes[0].id;
  
  const dSale = new Date(saleDate);
  if (isNaN(dSale.getTime())) return p.loteActivo || p.lotes[0].id;

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return 0;
    if (typeof dateStr === 'number') return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parts[0], parts[1]-1, parts[2]).getTime();
    }
    return new Date(dateStr).getTime();
  };

  const sorted = [...p.lotes].sort((a,b) => parseLocalDate(a.fecha) - parseLocalDate(b.fecha));
  let best = sorted[0];
  for (let l of sorted) {
    if (parseLocalDate(l.fecha) <= dSale.getTime()) {
      best = l;
    }
  }
  return best.id;
}


describe('Prioridad 1 - Inventario y Mililitros', () => {

  const mockPerfumes = [{
    id: 'perf-1',
    tamanoBotella: 100,
    loteActivo: 'lote-b',
    lotes: [
      { id: 'lote-a', tamano: 100, fecha: '2026-08-01' },
      { id: 'lote-b', tamano: 100, fecha: '2026-08-15' }
    ]
  }];

  describe('getLoteRemaining()', () => {
    test('Resta correcta con tallas estándar (2,3,5,10)', () => {
      const ventas = [
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '5', cantidad: 2 }, // 10ml
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '10', cantidad: 1 }, // 10ml
      ];
      const res = getLoteRemaining('perf-1', 'lote-a', mockPerfumes, ventas);
      expect(res.sold).toBe(20);
      expect(res.rem).toBe(80);
    });

    test('Resta correcta con tallas NO estándar (15, 30, "15ml")', () => {
      const ventas = [
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '15', cantidad: 1 }, // 15ml
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '30ml', cantidad: 1 }, // 30ml
      ];
      const res = getLoteRemaining('perf-1', 'lote-a', mockPerfumes, ventas);
      expect(res.sold).toBe(45);
      expect(res.rem).toBe(55);
    });

    test('Ignora ventas canceladas', () => {
      const ventas = [
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '10', cantidad: 1 }, // 10ml
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '10', cantidad: 2, estado: 'cancelada' }, // Ignored
      ];
      const res = getLoteRemaining('perf-1', 'lote-a', mockPerfumes, ventas);
      expect(res.sold).toBe(10);
      expect(res.rem).toBe(90);
    });

    test('Venta tipo "Resto" deja la botella en 0ml (consumida)', () => {
      const ventas = [
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: '10', cantidad: 1 }, // 10ml
        { perfumeId: 'perf-1', loteId: 'lote-a', talla: 'Resto', cantidad: 1 }, // Consume everything
      ];
      const res = getLoteRemaining('perf-1', 'lote-a', mockPerfumes, ventas);
      expect(res.sold).toBe(100);
      expect(res.rem).toBe(0);
      expect(res.hasResto).toBe(true);
    });
  });

  describe('getSmartLoteId()', () => {
    test('Asigna la botella correcta por fecha', () => {
      // Sale on Aug 10 -> Should pick lote-a (Aug 1)
      expect(getSmartLoteId(mockPerfumes[0], new Date(2026, 7, 10).getTime())).toBe('lote-a');
      
      // Sale on Aug 20 -> Should pick lote-b (Aug 15)
      expect(getSmartLoteId(mockPerfumes[0], new Date(2026, 7, 20).getTime())).toBe('lote-b');
    });

    test('Maneja zonas horarias correctamente sin desfasar a medianoche UTC', () => {
      // Sale on Aug 1, 10:00 PM local Mexico time.
      // If parsed as UTC, '2026-08-01' is Aug 1 00:00 UTC.
      // But if user enters '2026-08-15' and it's UTC, Aug 14 7PM Mexico is Aug 15 1AM UTC, causing wrong assignment.
      // Local parsing ensures YYYY-MM-DD string is evaluated in local timezone.
      
      const p = {
        loteActivo: 'lote-1',
        lotes: [
          { id: 'lote-1', fecha: '2026-08-14' },
          { id: 'lote-2', fecha: '2026-08-15' }
        ]
      };
      
      // Venta a las 11:30 PM del 14 de Agosto (Hora local)
      const saleDate = new Date(2026, 7, 14, 23, 30, 0).getTime(); 
      // El lote 2 empezó el 15 de Agosto. Como la venta es el 14, DEBE caer en el lote-1.
      expect(getSmartLoteId(p, saleDate)).toBe('lote-1');
      
      // Venta a la 1:00 AM del 15 de Agosto (Hora local)
      const saleDate2 = new Date(2026, 7, 15, 1, 0, 0).getTime(); 
      // Debe caer en lote-2
      expect(getSmartLoteId(p, saleDate2)).toBe('lote-2');
    });
  });

});
