import { productosEstres } from '../assets/js/prueba-estres.js';

const catalogo = [
  { id: 'a', nombre: 'Real', marca: 'Casa', imagen: 'https://x/y.jpg' },
  { id: 'b', tipo: 'paquete', nombre: 'Un paquete', imagen: 'https://x/z.jpg' },
];

describe('productosEstres', () => {
  const lista = productosEstres(catalogo);
  const de = id => lista.find(p => p.id === id);

  test('todos se distinguen como prueba y empiezan con "estres-"', () => {
    expect(lista.length).toBeGreaterThanOrEqual(4);
    lista.forEach(p => {
      expect(p.id.startsWith('estres-')).toBe(true);
      expect(p.nombre.startsWith('PRUEBA')).toBe(true);
    });
  });
  test('el paquete para armar trae 40 perfumes: reales primero, sin paquetes adentro', () => {
    const p = de('estres-arma');
    expect(p.esPersonalizable).toBe(true);
    expect(p.items).toHaveLength(40);
    expect(p.items[0].id).toBe('a');
    expect(p.items.some(i => i.id === 'b')).toBe(false);
  });
  test('hay uno con muchas presentaciones y uno sin foto', () => {
    expect(Object.keys(de('estres-fijo').precios)).toHaveLength(6);
    expect(de('estres-sinfoto').imagen).toBe('');
  });
  test('funciona con el catálogo vacío', () => {
    expect(productosEstres([]).find(p => p.id === 'estres-arma').items).toHaveLength(40);
    expect(productosEstres(undefined)).toHaveLength(lista.length);
  });
});
