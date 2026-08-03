/**
 * Pruebas unitarias para Prioridad 2: Precios y Totales
 */

function batchRefreshTotal(row) {
  // Lógica extraída y reparada de batchRefreshTotal
  if (!row) return '—';
  // FIX: Allow precio to be 0 by explicitly checking undefined/null or using typeof
  if (typeof row.precio === 'number' && typeof row.cantidad === 'number') {
    return '$' + (row.precio * (row.cantidad || 1)).toLocaleString('es-MX');
  }
  // Also handle string numbers
  if (row.precio !== '' && row.precio !== undefined && row.precio !== null && row.cantidad) {
    return '$' + ((+row.precio) * (+row.cantidad || 1)).toLocaleString('es-MX');
  }
  return '—';
}

function tallaItems(perfumeId, perfumes, paquetesData, accesoriosData) {
  if (perfumeId === 'custom') {
    return [
      { value: 'Completo', label: 'Botella Completa', precio: '' },
      { value: 'Otro', label: 'Otro (Manual)', precio: '' }
    ];
  }
  if (!perfumeId) return [];
  let p = perfumes.find(x => x.id === perfumeId);
  let isPaquete = false;
  let isAccesorio = false;
  if (!p && paquetesData) {
    p = paquetesData.find(x => x.id === perfumeId);
    if (p) isPaquete = true;
  }
  if (!p && accesoriosData) {
    p = accesoriosData.find(x => x.id === perfumeId);
    if (p) isAccesorio = true;
  }
  if (!p) return [];
  
  if (isAccesorio) {
    if (p.precios && Object.values(p.precios).some(v => +v > 0)) {
      return Object.entries(p.precios).filter(([,v])=>+v>0)
        .map(([k,v]) => ({ value: k, label: `${k}ml — $${v}`, precio: +v }));
    }
    // FIX: Fallback to 0 if p.precio is undefined
    const pr = p.precio || 0;
    return [{ value: '1 ud', label: `1 ud — $${pr}`, precio: pr }];
  }
  
  const items = Object.entries(p.precios||{}).filter(([,v])=>+v>0)
    .map(([k,v]) => ({ value: isPaquete ? `Paquete ${k}` : k, label: `${isPaquete ? 'Paquete ' : ''}${k}ml — $${v}`, precio: +v }));
  if (!isPaquete) {
    items.push({ value: 'Resto', label: 'Resto de Botella (Usada) 🍾', precio: '' });
    items.push({ value: 'Completo', label: 'Botella Sellada 🍾', precio: '' });
  }
  return items;
}


describe('Prioridad 2 - Precios y Totales', () => {

  describe('batchRefreshTotal()', () => {
    test('Maneja precio normal correctamente', () => {
      const row = { precio: 150, cantidad: 2 };
      expect(batchRefreshTotal(row)).toBe('$300');
    });

    test('Maneja precio de $0 correctamente (promoción o regalo)', () => {
      const row = { precio: 0, cantidad: 1 };
      // Before fix, this would return '—' because 0 is falsy
      expect(batchRefreshTotal(row)).toBe('$0');
    });

    test('Maneja precio vacío como "—"', () => {
      const row = { precio: '', cantidad: 1 };
      expect(batchRefreshTotal(row)).toBe('—');
    });
  });

  describe('tallaItems()', () => {
    const mockPerfumes = [{ id: 'p1', precios: { '3': 50, '5': 80 } }];
    const mockPaquetes = [{ id: 'paq1', precios: { '5': 200 } }];
    const mockAccesorios = [{ id: 'acc1', precio: undefined }, { id: 'acc2', precio: 120 }];

    test('Opciones para perfume normal incluyen Resto y Completo', () => {
      const items = tallaItems('p1', mockPerfumes, mockPaquetes, mockAccesorios);
      expect(items.length).toBe(4);
      expect(items[0].value).toBe('3');
      expect(items.find(i => i.value === 'Resto')).toBeDefined();
    });

    test('Opciones para paquete NO incluyen Resto ni Completo', () => {
      const items = tallaItems('paq1', mockPerfumes, mockPaquetes, mockAccesorios);
      expect(items.length).toBe(1);
      expect(items[0].value).toBe('Paquete 5');
    });

    test('Opciones para accesorio sin precio definido asumen $0', () => {
      const items = tallaItems('acc1', mockPerfumes, mockPaquetes, mockAccesorios);
      expect(items.length).toBe(1);
      expect(items[0].precio).toBe(0);
      expect(items[0].label).toBe('1 ud — $0');
    });

    test('Opciones para item custom', () => {
      const items = tallaItems('custom', mockPerfumes, mockPaquetes, mockAccesorios);
      expect(items.length).toBe(2);
      expect(items[0].value).toBe('Completo');
    });
  });

});
