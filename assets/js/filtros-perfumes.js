/**
 * filtros-perfumes.js — Filtros, atajos y orden del catálogo del panel. Sin DOM.
 *
 * Los selects (género, categoría, marca, familia, tipo) acotan; los atajos son
 * lo que hay que revisar seguido: qué se acaba, qué está oculto, qué perfume
 * está incompleto (sin foto, sin pirámide, sin costo de botella, sin dupe).
 * Cada atajo muestra cuántos hay con los demás filtros puestos.
 *
 * Los filtros se guardan en la sesión: antes, al guardar un perfume se
 * recargaba el catálogo, se rehacían las opciones de los selects y todo
 * volvía a "Todas".
 */
import { matchSearch, puntajeBusqueda } from './search-engine.js?v=2';
import { parsearFicha } from './ficha.js';

export const FILTROS_VACIOS = Object.freeze({
  q: '', genero: '', categoria: '', marca: '', familia: '', tipo: '', atajo: '', orden: '',
});

const sinAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const esPerfume = p => !p.isAccesorio;

/** Tiene lo que costó su botella (en algún lote, o el dato de antes de los lotes). */
export function tieneCostoBotella(p) {
  if (Array.isArray(p.lotes) && p.lotes.some(l => +l.costo > 0)) return true;
  return +p.costoBotella > 0;
}

/** Los atajos, en el orden en que se muestran. */
export const ATAJOS = [
  { id: 'por_acabarse', etiqueta: 'Por acabarse', icono: 'bi-hourglass-split', tono: 'aviso', prueba: p => p.estadoStock === 'por_acabarse' },
  { id: 'agotado', etiqueta: 'Agotados', icono: 'bi-x-circle', tono: 'peligro', prueba: p => p.estadoStock === 'agotado' },
  { id: 'novedad', etiqueta: 'Novedades', icono: 'bi-stars', prueba: p => p.novedad === true },
  { id: 'oculto', etiqueta: 'Ocultos', icono: 'bi-eye-slash', prueba: p => p.activo === false && p.archivado !== true },
  { id: 'sin_precio', etiqueta: 'Sin precios', icono: 'bi-tag', tono: 'peligro',
    prueba: p => !Object.values(p.precios || {}).some(v => +v > 0) && !(+p.precio > 0) },
  { id: 'sin_foto', etiqueta: 'Sin foto', icono: 'bi-image', prueba: p => esPerfume(p) && !p.imagen },
  { id: 'sin_piramide', etiqueta: 'Sin pirámide', icono: 'bi-triangle', prueba: p => esPerfume(p) && !parsearFicha(p.descripcion).estructurada },
  { id: 'sin_costo', etiqueta: 'Sin costo de botella', icono: 'bi-cash-coin', prueba: p => esPerfume(p) && !tieneCostoBotella(p) },
  { id: 'sin_dupe', etiqueta: 'Árabes sin dupe', icono: 'bi-link-45deg',
    prueba: p => esPerfume(p) && sinAcento(p.categoria) === 'arabe' && !(p.inspiradoEn && p.inspiradoEn.nombre) },
];

/**
 * Lo que pasa los filtros.
 * @param {Array} perfumes
 * @param {object} f  Ver FILTROS_VACIOS.
 * @param {{archivados?:boolean}} [opciones]  Pestaña Archivados o Catálogo.
 */
export function filtrarPerfumes(perfumes, f = FILTROS_VACIOS, { archivados = false } = {}) {
  const q = String(f.q || '').toLowerCase().trim();
  const atajo = ATAJOS.find(a => a.id === f.atajo);
  return (perfumes || []).filter(p =>
    (archivados ? p.archivado === true : p.archivado !== true) &&
    // También por el original del dupe: buscar "Sauvage" encuentra sus dupes.
    (!q || matchSearch(q, `${p.nombre || ''} ${p.marca || ''} ${(p.inspiradoEn && p.inspiradoEn.nombre) || ''}`)) &&
    (!f.genero || p.genero === f.genero) &&
    (!f.categoria || p.categoria === f.categoria) &&
    (!f.marca || p.marca === f.marca) &&
    (!f.familia || p.familia === f.familia) &&
    (!f.tipo || p.tipo === f.tipo) &&
    (!atajo || atajo.prueba(p))
  );
}

/** Cuántos hay en cada atajo con los demás filtros puestos: { id: n }. */
export function contarAtajos(perfumes, f = FILTROS_VACIOS, opciones) {
  const base = filtrarPerfumes(perfumes, { ...f, atajo: '' }, opciones);
  return Object.fromEntries(ATAJOS.map(a => [a.id, base.filter(a.prueba).length]));
}

/** Cuántos filtros hay puestos (el orden no cuenta: no quita perfumes). */
export function cuantosActivos(f = FILTROS_VACIOS) {
  return ['q', 'genero', 'categoria', 'marca', 'familia', 'tipo', 'atajo']
    .filter(k => String(f[k] || '').trim()).length;
}

/** Copia ordenada. '' deja el orden manual (el de Firestore). */
export function ordenarPerfumes(lista, orden) {
  const r = [...(lista || [])];
  const nombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''));
  if (orden === 'clicks') r.sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || nombre(a, b));
  else if (orden === 'menos_vistos') r.sort((a, b) => (a.clicks || 0) - (b.clicks || 0) || nombre(a, b));
  else if (orden === 'recientes') r.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
  else if (orden === 'antiguos') r.sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0));
  else if (orden === 'az') r.sort(nombre);
  else if (orden === 'za') r.sort((a, b) => nombre(b, a));
  return r;
}

/**
 * Con una búsqueda escrita, primero lo que más coincide (nombre, luego marca,
 * luego el original de un dupe); el orden elegido solo desempata. Antes "le
 * beau" sacaba primero lo que estuviera arriba en el orden manual.
 */
export function ordenarPorBusqueda(lista, q) {
  if (!String(q || '').trim()) return [...(lista || [])];
  const puntos = new Map((lista || []).map(p => [p, puntajeBusqueda(q, [
    p.nombre, `${p.marca || ''} ${p.nombre || ''}`, (p.inspiradoEn && p.inspiradoEn.nombre) || '',
  ])]));
  return [...(lista || [])].sort((a, b) => puntos.get(b) - puntos.get(a));
}

/** Filtros guardados en la sesión; ante cualquier cosa rara, vacíos. */
export function restaurarFiltros(texto) {
  try {
    const guardado = JSON.parse(texto || '{}');
    if (!guardado || typeof guardado !== 'object') return { ...FILTROS_VACIOS };
    const r = { ...FILTROS_VACIOS };
    Object.keys(FILTROS_VACIOS).forEach(k => { if (typeof guardado[k] === 'string') r[k] = guardado[k]; });
    if (r.atajo && !ATAJOS.some(a => a.id === r.atajo)) r.atajo = '';
    return r;
  } catch {
    return { ...FILTROS_VACIOS };
  }
}
