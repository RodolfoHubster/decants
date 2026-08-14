/**
 * Pruebas del módulo real assets/js/stock.js
 */

import { estaAgotado, resolverItemsPaquete, contarDisponibles, paqueteArmable } from '../assets/js/stock.js';

describe('estaAgotado', () => {
  test('disponible se puede vender', () => {
    expect(estaAgotado({ estadoStock: 'disponible', activo: true })).toBe(false);
  });

  test('agotado no se puede vender', () => {
    expect(estaAgotado({ estadoStock: 'agotado', activo: true })).toBe(true);
  });

  test('un perfume que ya no está en el catálogo cuenta como no disponible', () => {
    expect(estaAgotado(null)).toBe(true);
    expect(estaAgotado(undefined)).toBe(true);
  });

  test('inactivo o archivado tampoco se ofrece', () => {
    expect(estaAgotado({ activo: false })).toBe(true);
    expect(estaAgotado({ activo: true, archivado: true })).toBe(true);
  });

  test('sin estadoStock se asume vendible: no bloquear por dato faltante', () => {
    expect(estaAgotado({ activo: true })).toBe(false);
  });
});

describe('resolverItemsPaquete', () => {
  // El caso reportado: el combo Hawas ofrecía Hawas Fire estando agotado.
  const perfumes = [
    { id: 'p-ice',  nombre: 'Hawas Ice',  estadoStock: 'disponible', activo: true },
    { id: 'p-fire', nombre: 'Hawas Fire', estadoStock: 'agotado',    activo: true },
    { id: 'p-him',  nombre: 'Hawas for Him', estadoStock: 'disponible', activo: true }
  ];
  // El paquete guarda una copia vieja, sin datos de stock.
  const itemsPaquete = [
    { id: 'p-ice',  nombre: 'Hawas Ice' },
    { id: 'p-fire', nombre: 'Hawas Fire' },
    { id: 'p-him',  nombre: 'Hawas for Him' }
  ];

  test('marca como agotado el que lo está en el catálogo vivo', () => {
    const r = resolverItemsPaquete(itemsPaquete, perfumes);
    expect(r.map(i => i.agotado)).toEqual([false, true, false]);
  });

  test('conserva nombre e imagen guardados en el paquete', () => {
    const conImagen = [{ id: 'p-fire', nombre: 'Hawas Fire', imagen: 'fire.jpg' }];
    const [item] = resolverItemsPaquete(conImagen, perfumes);
    expect(item.nombre).toBe('Hawas Fire');
    expect(item.imagen).toBe('fire.jpg');
    expect(item.agotado).toBe(true);
  });

  test('un item cuyo perfume ya no existe queda bloqueado', () => {
    const [item] = resolverItemsPaquete([{ id: 'borrado', nombre: 'Viejo' }], perfumes);
    expect(item.agotado).toBe(true);
  });

  test('tolera entradas vacías', () => {
    expect(resolverItemsPaquete(null, perfumes)).toEqual([]);
    expect(resolverItemsPaquete(itemsPaquete, null).every(i => i.agotado)).toBe(true);
  });
});

describe('contarDisponibles y paqueteArmable', () => {
  const resueltos = [
    { agotado: false }, { agotado: true }, { agotado: false }
  ];

  test('cuenta solo los seleccionables', () => {
    expect(contarDisponibles(resueltos)).toBe(2);
  });

  test('con 2 disponibles no se puede armar un combo de 3', () => {
    expect(paqueteArmable(resueltos, 3)).toBe(false);
  });

  test('con 2 disponibles sí se arma un combo de 2', () => {
    expect(paqueteArmable(resueltos, 2)).toBe(true);
  });
});
