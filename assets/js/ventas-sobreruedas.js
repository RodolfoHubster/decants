/**
 * ventas-sobreruedas.js
 * Panel "Registro del Día" — carga rápida de ventas físicas (sobre ruedas).
 * Permite crear N líneas de venta y guardarlas todas en Firestore de un solo click.
 *
 * Colección destino: `ventas`
 * Cada documento sigue la misma estructura que el modal de ventas normal:
 *  {
 *    fecha        : Timestamp (fecha del evento, no necesariamente hoy)
 *    perfume      : string
 *    talla        : string
 *    cantidad     : number
 *    precio       : number
 *    total        : number  (cantidad * precio)
 *    cliente      : "Venta física"
 *    estado       : "pagada"
 *    canal        : "sobre_ruedas"
 *    creadoEn     : Timestamp (momento real del registro)
 *  }
 */

import { db } from './firebase-config.js';
import {
collection, addDoc, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, collection, addDoc, Timestamp, serverTimestamp } from './firebase-config.js';
/* ─── helpers ─────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function showToast(msg, type = 'ok') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show' + (type === 'err' ? ' toast-err' : '');
  setTimeout(() => (t.className = ''), 3000);
}

/* ─── estado local ─────────────────────────────────────────────────────────── */
let perfumes = [];   // cache del catálogo para el datalist

/* ─── HTML del modal ──────────────────────────────────────────────────────── */
const MODAL_HTML = /* html */`
<div id="sr-overlay" style="
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);
  z-index:2000;align-items:center;justify-content:center;padding:12px;
" onclick="SRcerrar(event)">
  <div id="sr-modal" style="
    background:#141210;border:1px solid rgba(201,168,76,.35);
    border-radius:18px;width:100%;max-width:780px;
    max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;
    font-family:'Poppins',sans-serif;
  " onclick="event.stopPropagation()">

    <!-- cabecera -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🛞</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:#ede9e1">Registro del Día</div>
          <div style="font-size:11px;color:#8a8880">Ventas sobre ruedas — carga rápida</div>
        </div>
      </div>
      <button onclick="SRcerrarBtn()"
        style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
               border-radius:8px;width:34px;height:34px;color:#8a8880;
               font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <!-- fecha del evento -->
    <div style="padding:12px 20px 8px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;
                display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <label style="font-size:13px;font-weight:600;color:#c9a84c;white-space:nowrap">
        📅 Fecha del evento
      </label>
      <input type="date" id="sr-fecha"
        style="background:rgba(255,255,255,.05);border:1px solid rgba(201,168,76,.3);
               border-radius:9px;padding:7px 12px;color:#ede9e1;font-size:13px;
               font-family:'Poppins',sans-serif;outline:none;width:170px">
      <span style="font-size:12px;color:#46443f">Las ventas se registrarán con esta fecha.</span>
    </div>

    <!-- tabla de líneas -->
    <div style="flex:1;overflow-y:auto;padding:14px 20px;min-height:0">

      <!-- datalist para autocompletar perfumes -->
      <datalist id="sr-perfumes-list"></datalist>

      <table id="sr-tabla" style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="color:#c9a84c;font-size:11px;letter-spacing:.06em;text-transform:uppercase">
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:35%">Perfume</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:16%">Talla</th>
            <th style="padding:6px 8px;text-align:center;font-weight:600;width:10%">Cant.</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;width:14%">Precio c/u</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;width:14%">Total</th>
            <th style="width:7%"></th>
          </tr>
        </thead>
        <tbody id="sr-body"></tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="padding-top:10px">
              <button onclick="SRagregarLinea()"
                style="background:rgba(201,168,76,.12);border:1px dashed rgba(201,168,76,.4);
                       border-radius:9px;color:#c9a84c;font-size:13px;font-weight:600;
                       padding:8px 16px;cursor:pointer;width:100%;
                       display:flex;align-items:center;justify-content:center;gap:7px;
                       font-family:'Poppins',sans-serif;transition:background .15s">
                <i class="bi bi-plus-lg"></i> Agregar línea
              </button>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- resumen -->
      <div id="sr-resumen" style="
        margin-top:16px;background:rgba(201,168,76,.07);
        border:1px solid rgba(201,168,76,.2);border-radius:12px;
        padding:12px 16px;display:flex;justify-content:space-between;
        align-items:center;flex-wrap:wrap;gap:8px
      ">
        <span style="font-size:13px;color:#8a8880">
          <span id="sr-num-lineas">0</span> artículo(s)
        </span>
        <span style="font-size:15px;font-weight:700;color:#c9a84c">
          Total: <span id="sr-total-general">$0</span> MXN
        </span>
      </div>
    </div>

    <!-- pie -->
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,.07);
                display:flex;gap:10px;flex-shrink:0;flex-wrap:wrap">
      <button onclick="SRcerrarBtn()"
        style="flex:1;min-width:120px;height:44px;border-radius:11px;
               background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
               color:#8a8880;font-size:13px;font-weight:600;cursor:pointer;
               font-family:'Poppins',sans-serif;transition:background .15s">
        Cancelar
      </button>
      <button id="sr-btn-guardar" onclick="SRguardar()"
        style="flex:3;min-width:180px;height:44px;border-radius:11px;
               background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.5);
               color:#c9a84c;font-size:13px;font-weight:700;cursor:pointer;
               font-family:'Poppins',sans-serif;transition:background .15s;
               display:flex;align-items:center;justify-content:center;gap:8px">
        <i class="bi bi-cloud-upload"></i> Guardar todo en Firestore
      </button>
    </div>
  </div>
</div>
`;

/* ─── celda editable ──────────────────────────────────────────────────────── */
function tdInput(type, name, placeholder, value = '', extraStyle = '', extraAttrs = '') {
  return `<td style="padding:4px 6px">
    <input type="${type}" name="${name}" placeholder="${placeholder}"
      value="${value}" autocomplete="off"
      ${name === 'perfume' ? 'list="sr-perfumes-list"' : ''}
      ${extraAttrs}
      oninput="SRrecalcFila(this.closest('tr'))"
      style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
             border-radius:8px;padding:7px 9px;color:#ede9e1;font-size:13px;
             font-family:'Poppins',sans-serif;outline:none;${extraStyle}">
  </td>`;
}

/* ─── fila nueva ──────────────────────────────────────────────────────────── */
function nuevaFila(idx) {
  const tr = document.createElement('tr');
  tr.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.05)';
  tr.innerHTML =
    tdInput('text',   'perfume',  'Nombre del perfume',  '', 'min-width:0') +
    tdInput('text',   'talla',    'ej. 5ml',             '', 'width:80px') +
    tdInput('number', 'cantidad', '1', '1',     'width:54px;text-align:center', 'min="1"') +
    tdInput('number', 'precio',   '0', '',      'width:90px;text-align:right',  'min="0" step="1"') +
    `<td style="padding:4px 8px;text-align:right;font-weight:700;color:#c9a84c;
                white-space:nowrap;font-size:13px" class="sr-total-fila">$0</td>
     <td style="padding:4px 4px;text-align:center">
       <button onclick="this.closest('tr').remove();SRrecalcTotal()"
         title="Eliminar línea"
         style="background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.2);
                border-radius:7px;width:30px;height:30px;color:#f87171;cursor:pointer;
                font-size:14px;display:flex;align-items:center;justify-content:center">
         <i class="bi bi-trash3"></i>
       </button>
     </td>`;
  return tr;
}

/* ─── recalc ──────────────────────────────────────────────────────────────── */
function SRrecalcFila(tr) {
  const qty   = parseFloat(tr.querySelector('[name=cantidad]')?.value) || 0;
  const price = parseFloat(tr.querySelector('[name=precio]')?.value)   || 0;
  const tot   = qty * price;
  const cell  = tr.querySelector('.sr-total-fila');
  if (cell) cell.textContent = '$' + tot.toLocaleString('es-MX');
  SRrecalcTotal();
}
window.SRrecalcFila = SRrecalcFila;

function SRrecalcTotal() {
  const body  = $('sr-body');
  if (!body) return;
  const rows  = body.querySelectorAll('tr');
  let total = 0, count = 0;
  rows.forEach(tr => {
    const qty   = parseFloat(tr.querySelector('[name=cantidad]')?.value) || 0;
    const price = parseFloat(tr.querySelector('[name=precio]')?.value)   || 0;
    total += qty * price;
    if (qty > 0) count += qty;
  });
  const numEl = $('sr-num-lineas');
  const totEl = $('sr-total-general');
  if (numEl) numEl.textContent = count;
  if (totEl) totEl.textContent = '$' + total.toLocaleString('es-MX');
}
window.SRrecalcTotal = SRrecalcTotal;

/* ─── agregar línea pública ───────────────────────────────────────────────── */
window.SRagregarLinea = function () {
  const body = $('sr-body');
  if (!body) return;
  body.appendChild(nuevaFila(body.children.length));
  // enfocar el primer campo de la nueva fila
  body.lastElementChild?.querySelector('[name=perfume]')?.focus();
};

/* ─── abrir / cerrar ──────────────────────────────────────────────────────── */
window.SRabrir = function () {
  const overlay = $('sr-overlay');
  if (!overlay) return;

  // fecha default = hoy
  const fechaInput = $('sr-fecha');
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split('T')[0];
  }

  // asegurar al menos 1 línea
  const body = $('sr-body');
  if (body && body.children.length === 0) SRagregarLinea();

  overlay.style.display = 'flex';
  setTimeout(() => overlay.style.opacity = '1', 10);
};

window.SRcerrarBtn = function () {
  const overlay = $('sr-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.style.display = 'none'; }, 200);
};

window.SRcerrar = function (e) {
  if (e.target === $('sr-overlay')) SRcerrarBtn();
};

/* ─── guardar todo ────────────────────────────────────────────────────────── */
window.SRguardar = async function () {
  const fechaVal = $('sr-fecha')?.value;
  if (!fechaVal) { showToast('⚠️ Elige la fecha del evento', 'err'); return; }

  const [y, m, d] = fechaVal.split('-').map(Number);
  // Timestamp al inicio del día (mediodía local para evitar offset)
  const fechaTS = Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));

  const rows = $('sr-body')?.querySelectorAll('tr') ?? [];
  if (!rows.length) { showToast('⚠️ Agrega al menos una venta', 'err'); return; }

  const lineas = [];
  let errores = 0;
  rows.forEach((tr, i) => {
    const perfume  = tr.querySelector('[name=perfume]')?.value.trim();
    const talla    = tr.querySelector('[name=talla]')?.value.trim();
    const cantidad = parseFloat(tr.querySelector('[name=cantidad]')?.value) || 0;
    const precio   = parseFloat(tr.querySelector('[name=precio]')?.value)   || 0;

    if (!perfume || cantidad <= 0 || precio <= 0) { errores++; return; }
    lineas.push({ perfume, talla: talla || '—', cantidad, precio, total: cantidad * precio });
  });

  if (errores > 0 && lineas.length === 0) {
    showToast(`⚠️ Completa los campos (perfume, cantidad, precio)`, 'err');
    return;
  }
  if (lineas.length === 0) {
    showToast('⚠️ No hay líneas válidas para guardar', 'err');
    return;
  }

  const btn = $('sr-btn-guardar');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…'; }

  try {
    const col = collection(db, 'ventas');
    const ahora = serverTimestamp();

    const promesas = lineas.map(l =>
      addDoc(col, {
        fecha    : fechaTS,
        perfume  : l.perfume,
        talla    : l.talla,
        cantidad : l.cantidad,
        precio   : l.precio,
        total    : l.total,
        cliente  : 'Venta física',
        estado   : 'pagada',
        canal    : 'sobre_ruedas',
        creadoEn : ahora,
      })
    );
    await Promise.all(promesas);

    const msg = errores > 0
      ? `✅ ${lineas.length} venta(s) guardadas (${errores} línea(s) incompletas omitidas)`
      : `✅ ${lineas.length} venta(s) guardadas correctamente`;
    showToast(msg);

    // limpiar tabla
    if ($('sr-body')) $('sr-body').innerHTML = '';
    SRagregarLinea();
    SRrecalcTotal();
    SRcerrarBtn();

    // refrescar tabla de ventas si está visible
    if (typeof window.cargarVentas === 'function') window.cargarVentas();

  } catch (err) {
    console.error('[SR] error guardando:', err);
    showToast('❌ Error al guardar: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Guardar todo en Firestore'; }
  }
};

/* ─── llenar datalist con catálogo ───────────────────────────────────────── */
function llenarDatalist(items) {
  const dl = $('sr-perfumes-list');
  if (!dl) return;
  dl.innerHTML = items.map(p => `<option value="${p.nombre} — ${p.marca}">`).join('');
}

/* ─── init ────────────────────────────────────────────────────────────────── */
export function initSobreRuedas(catalogoPerfumes = []) {
  perfumes = catalogoPerfumes;

  // inyectar modal si no existe
  if (!$('sr-overlay')) {
    document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  }

  // llenar datalist
  llenarDatalist(perfumes);

  // escuchar si el catálogo se actualiza después
  window.addEventListener('catalogo-listo', e => {
    if (e.detail?.perfumes) llenarDatalist(e.detail.perfumes);
  });
}
