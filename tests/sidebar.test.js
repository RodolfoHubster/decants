/**
 * Pruebas unitarias para Prioridad 4: Carrito POS (Cesta)
 */

function renamePosClient(cid, newName, localStorageMock) {
  const names = JSON.parse(localStorageMock.getItem('posClientNames') || '{}');
  if (newName !== null && newName.trim() !== '') {
    names[cid] = newName.trim();
    localStorageMock.setItem('posClientNames', JSON.stringify(names));
  }
}

function clearPosCart(localStorageMock, savePosCartMock) {
  localStorageMock.setItem('posClientId', '1');
  localStorageMock.removeItem('posClientNames'); // FIX: Added to clear names on empty
  savePosCartMock([]);
}

function groupCartItems(cart) {
  const groups = {};
  cart.forEach(item => {
    const cid = item.cartClientId || 1;
    if (!groups[cid]) groups[cid] = { total: 0, count: 0 };
    groups[cid].total += Number(item.precio) * Number(item.cant);
    groups[cid].count += item.cant;
  });
  return groups;
}


describe('Prioridad 4 - Carrito POS (Cesta)', () => {

  let lsStore = {};
  const mockLocalStorage = {
    getItem: (key) => lsStore[key] || null,
    setItem: (key, val) => { lsStore[key] = val.toString(); },
    removeItem: (key) => { delete lsStore[key]; }
  };

  beforeEach(() => {
    lsStore = {};
  });

  describe('Agrupación por cartClientId', () => {
    test('Agrupa correctamente items del mismo cartClientId', () => {
      const cart = [
        { cartClientId: 1, precio: 100, cant: 1 },
        { cartClientId: 1, precio: 50, cant: 2 },
        { cartClientId: 2, precio: 200, cant: 1 }
      ];
      const groups = groupCartItems(cart);
      
      expect(groups[1]).toBeDefined();
      expect(groups[1].count).toBe(3);
      expect(groups[1].total).toBe(200);

      expect(groups[2]).toBeDefined();
      expect(groups[2].count).toBe(1);
      expect(groups[2].total).toBe(200);
    });

    test('Asume cartClientId=1 si no existe', () => {
      const cart = [{ precio: 10, cant: 1 }];
      const groups = groupCartItems(cart);
      expect(groups[1]).toBeDefined();
      expect(groups[1].count).toBe(1);
    });
  });

  describe('renamePosClient', () => {
    test('Actualiza el nombre si es válido', () => {
      renamePosClient('1', 'Juan', mockLocalStorage);
      const names = JSON.parse(mockLocalStorage.getItem('posClientNames'));
      expect(names['1']).toBe('Juan');
    });

    test('Rechaza nombres vacíos o solo espacios', () => {
      mockLocalStorage.setItem('posClientNames', JSON.stringify({ '1': 'Original' }));
      
      renamePosClient('1', '   ', mockLocalStorage);
      const namesAfterSpaces = JSON.parse(mockLocalStorage.getItem('posClientNames'));
      expect(namesAfterSpaces['1']).toBe('Original');

      renamePosClient('1', '', mockLocalStorage);
      const namesAfterEmpty = JSON.parse(mockLocalStorage.getItem('posClientNames'));
      expect(namesAfterEmpty['1']).toBe('Original');
    });
  });

  describe('clearPosCart', () => {
    test('Reinicia posClientId y borra posClientNames', () => {
      mockLocalStorage.setItem('posClientId', '3');
      mockLocalStorage.setItem('posClientNames', JSON.stringify({ '1': 'A', '2': 'B' }));
      
      let cartSaved = false;
      const savePosCartMock = (c) => { if(c.length === 0) cartSaved = true; };
      
      clearPosCart(mockLocalStorage, savePosCartMock);
      
      expect(mockLocalStorage.getItem('posClientId')).toBe('1');
      expect(mockLocalStorage.getItem('posClientNames')).toBe(null); // Debe estar borrado
      expect(cartSaved).toBe(true);
    });
  });

});
