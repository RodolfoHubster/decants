/**
 * filtros-config.js  —  FUENTE ÚNICA DE VERDAD
 * ================================================
 * Para agregar una nueva familia olfativa o tipo:
 *   1. Agrega un objeto { valor, emoji, label } al arreglo correspondiente.
 *   2. Guarda el archivo.
 *   3. ¡Listo! Aparecerá automáticamente en admin y en la tienda pública.
 *
 * NO toques admin/perfumes.html ni index.html para esto.
 */

export const FAMILIAS = [
  { valor: 'Floral',     emoji: '🌸', label: 'Floral'     },
  { valor: 'Amaderado',  emoji: '🌲', label: 'Amaderado'  },
  { valor: 'Citrico',    emoji: '🍋', label: 'Cítrico'    },
  { valor: 'Oriental',   emoji: '🌙', label: 'Oriental'   },
  { valor: 'Fresco',     emoji: '🌊', label: 'Fresco'     },
  { valor: 'Gourmand',   emoji: '🍬', label: 'Gourmand'   },
  { valor: 'Especiado',  emoji: '🌶️', label: 'Especiado'  },
  { valor: 'Frutal',     emoji: '🍑', label: 'Frutal'     },
  { valor: 'Cuero',      emoji: '🦎', label: 'Cuero'      },
  { valor: 'Acuático',   emoji: '💧', label: 'Acuático'   },
  { valor: 'Fougere',    emoji: '🌿', label: 'Fougère'    },
  { valor: 'Chipre',     emoji: '🍂', label: 'Chipre'     },
  { valor: 'Aromatico',  emoji: '🌾', label: 'Aromático'  },
  { valor: 'Marino',     emoji: '🔱', label: 'Marino'     },
];

export const TIPOS = [
  { valor: 'Eau de Parfum',   emoji: '💜', label: 'Eau de Parfum'   },
  { valor: 'Eau de Toilette', emoji: '💙', label: 'Eau de Toilette' },
  { valor: 'Parfum',          emoji: '👑', label: 'Parfum'          },
  { valor: 'Cologne',         emoji: '💨', label: 'Cologne'         },
  { valor: 'Diseñador',       emoji: '🏷️', label: 'Diseñador'       },
  { valor: 'Nicho',           emoji: '💎', label: 'Nicho'           },
  { valor: 'Árabe',           emoji: '🌙', label: 'Árabe'           },
  { valor: 'Indie',           emoji: '🎨', label: 'Indie'           },
];

/**
 * buildSelectOptions(arreglo, valorSeleccionado)
 * Genera el HTML de <option> para un <select>.
 * @param {Array}  arr             - FAMILIAS o TIPOS
 * @param {string} [selected='']  - valor a pre-seleccionar
 * @param {string} [placeholder]  - texto del primer option vacío
 * @returns {string} HTML listo para innerHTML
 */
export function buildSelectOptions(arr, selected = '', placeholder = 'Sin especificar') {
  const first = `<option value="">${placeholder}</option>`;
  return first + arr
    .map(i => `<option value="${i.valor}"${i.valor === selected ? ' selected' : ''}>${i.label}</option>`)
    .join('');
}

/**
 * buildFilterCheckboxes(arreglo, dataGroup)
 * Genera el HTML de labels/checkboxes para el panel de filtros del catálogo.
 * @param {Array}  arr       - FAMILIAS o TIPOS
 * @param {string} dataGroup - 'familias' | 'tipos'
 * @returns {string} HTML listo para innerHTML
 */
export function buildFilterCheckboxes(arr, dataGroup) {
  return arr
    .map(i => `<label class="fcheck-label">
  <input type="checkbox" class="fcheck" data-group="${dataGroup}" value="${i.valor}" onchange="onFilterChange()">
  <span>${i.emoji} ${i.label}</span>
</label>`)
    .join('\n');
}
