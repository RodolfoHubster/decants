import {
  FILTROS_VACIOS, ATAJOS, filtrarPerfumes, contarAtajos, cuantosActivos,
  ordenarPerfumes, restaurarFiltros, tieneCostoBotella,
} from '../assets/js/filtros-perfumes.js';

const PIRAMIDE = 'Frase.\n\nSalida: bergamota\nCorazón: lavanda\nFondo: vainilla';
const perfume = (extra = {}) => ({
  id: extra.id || 'x', nombre: 'Perfume', marca: 'Marca', categoria: 'Diseñador', genero: 'Caballero',
  familia: 'Oriental', tipo: 'Eau de Parfum', imagen: 'img.jpg', descripcion: PIRAMIDE,
  precios: { 5: 90 }, lotes: [{ id: 'l1', costo: 1200, tamano: 100 }], clicks: 0, creadoEn: 1, ...extra,
});

const asad = perfume({ id: 'asad', nombre: 'Asad', marca: 'Lattafa', categoria: 'Árabe', clicks: 50, creadoEn: 30,
  inspiradoEn: { nombre: 'Sauvage Elixir', marca: 'Dior' } });
const hawas = perfume({ id: 'hawas', nombre: 'Hawas Ice', marca: 'Rasasi', categoria: 'Árabe', estadoStock: 'agotado', clicks: 63, creadoEn: 20 });
const scandal = perfume({ id: 'scandal', nombre: 'Scandal', marca: 'Jean Paul Gaultier', genero: 'Dama', estadoStock: 'por_acabarse', imagen: '', clicks: 5, creadoEn: 10 });
const oculto = perfume({ id: 'oculto', nombre: 'Oculto', activo: false, descripcion: 'Un párrafo libre', lotes: [], clicks: 0, creadoEn: 40 });
const archivado = perfume({ id: 'arch', nombre: 'Viejo', archivado: true, activo: false });
const accesorio = { id: 'acc', nombre: 'Atomizador', marca: 'Accesorios', isAccesorio: true, precio: 50 };
const todos = [asad, hawas, scandal, oculto, archivado, accesorio];
const ids = lista => lista.map(p => p.id);

describe('filtrarPerfumes', () => {
  test('sin filtros: todo menos los archivados', () => {
    expect(ids(filtrarPerfumes(todos))).toEqual(['asad', 'hawas', 'scandal', 'oculto', 'acc']);
  });
  test('la pestaña Archivados solo trae los archivados', () => {
    expect(ids(filtrarPerfumes(todos, FILTROS_VACIOS, { archivados: true }))).toEqual(['arch']);
  });
  test('los selects acotan', () => {
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, categoria: 'Árabe' }))).toEqual(['asad', 'hawas']);
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, genero: 'Dama' }))).toEqual(['scandal']);
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, marca: 'Rasasi', categoria: 'Árabe' }))).toEqual(['hawas']);
  });
  test('busca por nombre, marca y por el original del dupe', () => {
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, q: 'lattafa' }))).toEqual(['asad']);
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, q: 'Sauvage' }))).toEqual(['asad']);
  });
  test('un atajo acota junto con lo demás', () => {
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, atajo: 'agotado' }))).toEqual(['hawas']);
    expect(ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, atajo: 'agotado', genero: 'Dama' }))).toEqual([]);
  });
});

describe('atajos', () => {
  const de = id => ids(filtrarPerfumes(todos, { ...FILTROS_VACIOS, atajo: id }));
  test('stock, novedades y ocultos', () => {
    expect(de('por_acabarse')).toEqual(['scandal']);
    expect(de('oculto')).toEqual(['oculto']);
    expect(de('novedad')).toEqual([]);
  });
  test('lo incompleto no cuenta a los accesorios', () => {
    expect(de('sin_foto')).toEqual(['scandal']);
    expect(de('sin_piramide')).toEqual(['oculto']);
    expect(de('sin_costo')).toEqual(['oculto']);
  });
  test('sin precios: ni una talla con precio (el accesorio tiene precio suelto)', () => {
    const sinPrecio = perfume({ id: 'sp', precios: { 2: 0, 5: '' } });
    expect(ids(filtrarPerfumes([...todos, sinPrecio], { ...FILTROS_VACIOS, atajo: 'sin_precio' }))).toEqual(['sp']);
  });
  test('árabes sin dupe: solo los árabes sin "Inspirado en"', () => {
    expect(de('sin_dupe')).toEqual(['hawas']);
  });
  test('contarAtajos cuenta con los demás filtros puestos, sin el atajo elegido', () => {
    const n = contarAtajos(todos, { ...FILTROS_VACIOS, categoria: 'Árabe', atajo: 'agotado' });
    expect(n.agotado).toBe(1);
    expect(n.sin_dupe).toBe(1);
    expect(n.por_acabarse).toBe(0);
    expect(Object.keys(n)).toEqual(ATAJOS.map(a => a.id));
  });
});

describe('tieneCostoBotella', () => {
  test('algún lote con costo, o el costo de antes de los lotes', () => {
    expect(tieneCostoBotella({ lotes: [{ costo: 0 }, { costo: 900 }] })).toBe(true);
    expect(tieneCostoBotella({ lotes: [{ costo: 0 }] })).toBe(false);
    expect(tieneCostoBotella({ costoBotella: 800 })).toBe(true);
    expect(tieneCostoBotella({})).toBe(false);
  });
});

describe('cuantosActivos', () => {
  test('cuenta los filtros puestos; el orden no', () => {
    expect(cuantosActivos(FILTROS_VACIOS)).toBe(0);
    expect(cuantosActivos({ ...FILTROS_VACIOS, orden: 'clicks' })).toBe(0);
    expect(cuantosActivos({ ...FILTROS_VACIOS, marca: 'Armaf', atajo: 'agotado', q: '  ' })).toBe(2);
  });
});

describe('ordenarPerfumes', () => {
  const lista = [scandal, asad, hawas, oculto];
  test('populares y menos vistos (empates por nombre)', () => {
    expect(ids(ordenarPerfumes(lista, 'clicks'))).toEqual(['hawas', 'asad', 'scandal', 'oculto']);
    expect(ids(ordenarPerfumes(lista, 'menos_vistos'))).toEqual(['oculto', 'scandal', 'asad', 'hawas']);
  });
  test('por fecha y por nombre', () => {
    expect(ids(ordenarPerfumes(lista, 'recientes'))).toEqual(['oculto', 'asad', 'hawas', 'scandal']);
    expect(ids(ordenarPerfumes(lista, 'antiguos'))).toEqual(['scandal', 'hawas', 'asad', 'oculto']);
    expect(ids(ordenarPerfumes(lista, 'az'))).toEqual(['asad', 'hawas', 'oculto', 'scandal']);
    expect(ids(ordenarPerfumes(lista, 'za'))).toEqual(['scandal', 'oculto', 'hawas', 'asad']);
  });
  test('sin orden deja el manual y no toca la lista original', () => {
    expect(ids(ordenarPerfumes(lista, ''))).toEqual(ids(lista));
    ordenarPerfumes(lista, 'az');
    expect(ids(lista)).toEqual(['scandal', 'asad', 'hawas', 'oculto']);
  });
});

describe('restaurarFiltros', () => {
  test('recupera lo guardado', () => {
    const f = { ...FILTROS_VACIOS, marca: 'Armaf', atajo: 'agotado', orden: 'clicks' };
    expect(restaurarFiltros(JSON.stringify(f))).toEqual(f);
  });
  test('ignora claves desconocidas, tipos raros y atajos que ya no existen', () => {
    expect(restaurarFiltros(JSON.stringify({ marca: 5, otra: 'x', atajo: 'viejo', genero: 'Dama' })))
      .toEqual({ ...FILTROS_VACIOS, genero: 'Dama' });
  });
  test('nada guardado o JSON roto: vacíos', () => {
    expect(restaurarFiltros(null)).toEqual(FILTROS_VACIOS);
    expect(restaurarFiltros('{roto')).toEqual(FILTROS_VACIOS);
    expect(restaurarFiltros('"texto"')).toEqual(FILTROS_VACIOS);
  });
});
