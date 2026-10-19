import { slugDe, rutaProducto, carpetaDe, slugDeBusqueda, findBySlug } from '../assets/js/slug.js';
import { similares } from '../assets/js/similares.js';
import { opcionesPro, sufijoPro, etiquetaTalla, COLORES_PRO } from '../assets/js/pro.js';

describe('dirección propia de cada perfume', () => {
  const p = { id: 'x', marca: 'Rasasi', nombre: 'Hawas Ice' };
  test('producto.html?p=marca-nombre', () => {
    expect(slugDe(p)).toBe('rasasi-hawas-ice');
    expect(rutaProducto(p)).toBe('producto.html?p=rasasi-hawas-ice');
  });
  test('la carpeta del sitio sirve para armar el link completo', () => {
    expect(carpetaDe('https://rodolfohubster.github.io/decants/index.html?tab=x')).toBe('https://rodolfohubster.github.io/decants/');
    expect(carpetaDe('http://127.0.0.1:5501/producto.html?p=a')).toBe('http://127.0.0.1:5501/');
  });
  test('la página lee el slug y encuentra el perfume', () => {
    expect(slugDeBusqueda('?p=rasasi-hawas-ice')).toBe('rasasi-hawas-ice');
    expect(slugDeBusqueda('')).toBeNull();
    expect(findBySlug([p], 'rasasi-hawas-ice')).toBe(p);
  });
});

describe('productos similares', () => {
  const base = { id: 'b', tipo: 'perfume', familia: 'Amaderado', categoria: 'Árabe', genero: 'Caballero', marca: 'Lattafa', precios: { 5: 100 } };
  const todos = [
    base,
    { id: 'a1', familia: 'Amaderado', categoria: 'Árabe', genero: 'Caballero', marca: 'Lattafa', precios: { 5: 110 } },
    { id: 'a2', familia: 'Amaderado', categoria: 'Diseñador', genero: 'Dama', precios: { 5: 300 } },
    { id: 'a3', familia: 'Cítrico', categoria: 'Árabe', genero: 'Unisex', precios: { 5: 95 } },
    { id: 'ag', familia: 'Amaderado', categoria: 'Árabe', genero: 'Caballero', estadoStock: 'agotado' },
    { id: 'acc', tipo: 'accesorio', familia: 'Amaderado' },
    { id: 'arch', familia: 'Amaderado', archivado: true },
    { id: 'nada', familia: 'Floral', categoria: 'Nicho', genero: 'Dama', precios: { 5: 900 } },
    { id: 'pq', tipo: 'paquete', items: [{ id: 'a1' }] },
  ];
  const agotado = q => q.estadoStock === 'agotado';
  test('del más parecido al menos; sin él mismo, agotados, accesorios ni archivados', () => {
    expect(similares(base, todos, { agotado }).map(q => q.id)).toEqual(['a1', 'a3', 'a2']);
  });
  test('respeta el máximo', () => {
    expect(similares(base, todos, { n: 1, agotado })).toHaveLength(1);
  });
  test('en un paquete: primero los perfumes que trae, luego otros paquetes', () => {
    const otro = { id: 'pq2', tipo: 'paquete', items: [] };
    expect(similares(todos[8], [...todos, otro], { agotado }).map(q => q.id)).toEqual(['a1', 'pq2']);
  });
});

describe('PRO', () => {
  test('solo en 5 y 10 ml que se vendan, a +extra', () => {
    expect(opcionesPro({ 3: 60, 5: 90, 10: 160 }, 15)).toEqual([{ talla: '5', precio: 105 }, { talla: '10', precio: 175 }]);
    expect(opcionesPro({ 3: 60, 5: 90, 10: '' }, 15)).toEqual([{ talla: '5', precio: 105 }]);
    expect(opcionesPro({ 5: 90 }, 0)).toEqual([]);
  });
  test('los 7 colores que manejas', () => {
    expect(COLORES_PRO.map(c => c.nombre)).toEqual(['Negro', 'Azul marino', 'Plateado', 'Dorado', 'Rosa', 'Morado', 'Rojo']);
  });
  test('clave y etiqueta del carrito', () => {
    expect(sufijoPro(true, 'dorado')).toBe('-pro-dorado');
    expect(sufijoPro(false, 'dorado')).toBe('');
    expect(etiquetaTalla({ size: '5', pro: true, color: 'azul-marino' })).toBe('5ml PRO · Azul marino');
    expect(etiquetaTalla({ size: 'Paquete 3' })).toBe('3ml');
  });
});
