import { buscarEnCatalogo, armarInspirado, resolverInspirado, etiquetaCatalogo } from '../assets/js/inspirado.js';

const sauvage = { id: 's1', nombre: 'Sauvage Elixir', marca: 'Dior', imagen: 'https://img/sauvage.jpg' };
const sauvageEdt = { id: 's2', nombre: 'Sauvage', marca: 'Dior', imagen: 'https://img/edt.jpg' };
const asad = { id: 'a1', nombre: 'Asad', marca: 'Lattafa' };
const paquete = { id: 'k1', nombre: 'Sauvage Elixir', marca: 'Dior', tipo: 'paquete' };
const catalogo = [asad, sauvage, sauvageEdt, paquete];

describe('buscarEnCatalogo', () => {
  test('"Nombre · Marca" como lo da el buscador del panel', () => {
    expect(buscarEnCatalogo('Sauvage Elixir · Dior', catalogo)).toBe(sauvage);
    expect(buscarEnCatalogo(etiquetaCatalogo(sauvageEdt), catalogo)).toBe(sauvageEdt);
  });
  test('solo el nombre, o con la marca pegada, sin importar acentos ni mayúsculas', () => {
    expect(buscarEnCatalogo('sauvage elixir', catalogo)).toBe(sauvage);
    expect(buscarEnCatalogo('Dior Sauvage Elixir', catalogo)).toBe(sauvage);
  });
  test('solo nombres exactos: "Sauvage" no es "Sauvage Elixir"', () => {
    expect(buscarEnCatalogo('Sauvage · Dior', catalogo)).toBe(sauvageEdt);
    expect(buscarEnCatalogo('Elixir', catalogo)).toBeNull();
  });
  test('la marca tiene que coincidir si se escribió', () => {
    expect(buscarEnCatalogo('Sauvage Elixir · Chanel', catalogo)).toBeNull();
  });
  test('no se enlaza a sí mismo ni a paquetes', () => {
    expect(buscarEnCatalogo('Sauvage Elixir', [paquete])).toBeNull();
    expect(buscarEnCatalogo('Sauvage Elixir', catalogo, 's1')).toBeNull();
    expect(buscarEnCatalogo('', catalogo)).toBeNull();
  });
});

describe('armarInspirado', () => {
  test('solo guarda lo que tiene valor', () => {
    expect(armarInspirado({ nombre: ' Sauvage Elixir ', marca: 'Dior', imagen: '' })).toEqual({ nombre: 'Sauvage Elixir', marca: 'Dior' });
    expect(armarInspirado({ nombre: 'Sauvage Elixir', perfumeId: 's1', imagen: 'x' })).toEqual({ nombre: 'Sauvage Elixir', perfumeId: 's1', imagen: 'x' });
  });
  test('sin nombre no hay nada que guardar', () => {
    expect(armarInspirado({ marca: 'Dior' })).toBeNull();
    expect(armarInspirado()).toBeNull();
  });
});

describe('resolverInspirado', () => {
  test('sin dato, nada', () => {
    expect(resolverInspirado(asad, catalogo)).toBeNull();
    expect(resolverInspirado({ ...asad, inspiradoEn: {} }, catalogo)).toBeNull();
  });
  test('si el original está en la tienda, se enlaza y usa su foto', () => {
    const r = resolverInspirado({ ...asad, inspiradoEn: { nombre: 'Sauvage Elixir', perfumeId: 's1', imagen: 'vieja.jpg' } }, catalogo);
    expect(r.producto).toBe(sauvage);
    expect(r.imagen).toBe('https://img/sauvage.jpg');
  });
  test('lo encuentra por nombre aunque no tenga id (se dio de alta después)', () => {
    const r = resolverInspirado({ ...asad, inspiradoEn: { nombre: 'Sauvage Elixir', marca: 'Dior' } }, catalogo);
    expect(r.producto).toBe(sauvage);
  });
  test('si no está (u ocultaron el original), muestra nombre e imagen guardados', () => {
    const r = resolverInspirado({ ...asad, inspiradoEn: { nombre: 'Sauvage Elixir', marca: 'Dior', perfumeId: 's1', imagen: 'guardada.jpg' } }, [asad]);
    expect(r).toEqual({ nombre: 'Sauvage Elixir', marca: 'Dior', imagen: 'guardada.jpg', producto: null });
  });
  test('sin imagen guardada, imagen vacía', () => {
    const r = resolverInspirado({ ...asad, inspiradoEn: { nombre: 'Erba Pura' } }, catalogo);
    expect(r).toEqual({ nombre: 'Erba Pura', marca: '', imagen: '', producto: null });
  });
});
