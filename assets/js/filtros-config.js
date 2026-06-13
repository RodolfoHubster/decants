/**
 * filtros-config.js  —  helpers de render
 * =========================================
 * Las listas de Familias Olfativas y Tipos ya NO están hardcodeadas aquí.
 * Se gestionan desde admin/notas.html y se guardan en Firestore:
 *   colección  familias_olfativas  { nombre, emoji, orden }
 *   colección  tipos_perfume       { nombre, emoji, orden }
 *
 * Este archivo solo exporta helpers de render que reciben el arreglo
 * dinámico devuelto por Firestore.
 */

/**
 * buildSelectOptions(arr, valorSeleccionado, placeholder)
 * Genera HTML de <option> para un <select>.
 * @param {Array<{id,nombre,emoji}>} arr
 * @param {string} [selected='']
 * @param {string} [placeholder='Sin especificar']
 */
export function buildSelectOptions(arr, selected = '', placeholder = 'Sin especificar') {
  const first = `<option value="">${placeholder}</option>`;
  return first + arr
    .map(i => `<option value="${i.nombre}"${
      i.nombre === selected ? ' selected' : ''
    }>${i.emoji ? i.emoji + ' ' : ''}${i.nombre}</option>`)
    .join('');
}

/**
 * buildFilterCheckboxes(arr, dataGroup)
 * Genera HTML de checkboxes para el panel de filtros del catálogo público.
 * @param {Array<{id,nombre,emoji}>} arr
 * @param {string} dataGroup  'familias' | 'tipos'
 */
export function buildFilterCheckboxes(arr, dataGroup) {
  return arr
    .map(i => `<label class="fcheck-label">
  <input type="checkbox" class="fcheck" data-group="${dataGroup}" value="${i.nombre}" onchange="onFilterChange()">
  <span>${i.emoji ? i.emoji + ' ' : ''}${i.nombre}</span>
</label>`)
    .join('\n');
}
