/**
 * Unit tests para la lógica de deducción de "Reforzada"
 * Verifica que el sistema detecte correctamente si un perfume fue vendido
 * en su versión reforzada (precio mayor al base) al importarlo de la cesta.
 */

function deduceReforzada(itemPrecio, finalTalla, itemsList) {
  let isReforzada = false;
  let basePrecio = 0;
  const found = itemsList.find(i => i.value === finalTalla);
  
  if (found && found.precio) {
    basePrecio = found.precio;
    // Si el precio cobrado es estrictamente mayor al precio base del catálogo
    if (Number(itemPrecio) > Number(found.precio)) {
      isReforzada = true;
    }
  }
  
  return { isReforzada, basePrecio };
}

describe('Deducción de versión Reforzada al importar de la Cesta', () => {
  
  const mockItemsList = [
    { value: '3', precio: 60 },
    { value: '5', precio: 90 },
    { value: '10', precio: 160 }
  ];

  test('Debe detectar como NO reforzada si el precio es igual al base', () => {
    const result = deduceReforzada(90, '5', mockItemsList);
    expect(result.isReforzada).toBe(false);
    expect(result.basePrecio).toBe(90);
  });

  test('Debe detectar como REFORZADA si el precio cobrado es mayor al base (ej. +$15)', () => {
    const result = deduceReforzada(175, '10', mockItemsList);
    expect(result.isReforzada).toBe(true);
    expect(result.basePrecio).toBe(160);
  });

  test('Debe manejar correctamente precios enviados como strings ("175")', () => {
    const result = deduceReforzada("175", '10', mockItemsList);
    expect(result.isReforzada).toBe(true);
    expect(result.basePrecio).toBe(160);
  });

  test('Debe devolver valores por defecto si la talla no existe en el catálogo', () => {
    const result = deduceReforzada(100, '30', mockItemsList);
    expect(result.isReforzada).toBe(false);
    expect(result.basePrecio).toBe(0);
  });

});
