/**
 * ventas-sobreruedas.js
 * Panel "Registro del Día" — carga rápida de ventas físicas (sobre ruedas).
 * Permite crear N líneas de venta y guardarlas todas en Firestore de un solo click.
 *
 * Colección destino: `ventas`
 *  {
 *    fecha        : Timestamp
 *    perfume      : string
 *    talla        : string
 *    cantidad     : number
 *    precio       : number
 *    total        : number
 *    cliente      : string
 *    estado       : string  (pagada / pendiente / cancelada)
 *    nota         : string
 *    notaDia      : string
 *    canal        : "sobre_ruedas"
 *    creadoEn     : Timestamp
 *  }
 */

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
let perfumes = [];

/* ─── constantes ───────────────────────────────────────────────────────────── */
const ESTADO_OPTS = [
  { val:'pagada',    label:'Pagada',    icon:'✅', color:'#4ade80' },
  { val:'pendiente', label:'Pendiente', icon:'⏳', color:'#fbbf24' },
  { val:'cancelada', label:'Cancelada', icon:'❌', color:'#f87171' },
];

const TALLAS_DEFAULT = ['2ml','3ml','5ml','10ml','15ml','20ml','30ml','50ml','100ml'];

/* ─── HTML del modal ──────────────────────────────────────────────────────── */
const MODAL_HTML = /* html */`
<div id="sr-overlay" style="
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);
  z-index:2000;align-items:center;justify-content:center;padding:12px;
" onclick="SRcerrar(event)">
  <div id="sr-modal" style="
    background:#141210;border:1px solid rgba(201,168,76,.35);
    border-radius:18px;width:100%;max-width:960px;
    max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;
    font-family:'Poppins',sans-serif;
  " onclick="event.stopPropagation()">

    <!-- cabecera -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🛞</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:#ede9e1">Registro del Día — Sobre Ruedas</div>
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

    <!-- fecha + nota del día -->
    <div style="padding:12px 20px 8px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;
                display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <label style="font-size:13px;font-weight:600;color:#c9a84c;white-space:nowrap">Fecha del evento</label>
      <input type="date" id="sr-fecha"
        style="background:rgba(255,255,255,.05);border:1px solid rgba(201,168,76,.3);
               border-radius:9px;padding:7px 12px;color:#ede9e1;font-size:13px;
               font-family:'Poppins',sans-serif;outline:none;width:170px">
      <input type="text" id="sr-nota-dia" placeholder="Nota del día (ej. Mercado Centro, lluvia…) — opcional"
        style="flex:1;min-width:200px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
               border-radius:9px;padding:7px 12px;color:#ede9e1;font-size:13px;
               font-family:'Poppins',sans-serif;outline:none">
    </div>

    <!-- tabla -->
    <div style="flex:1;overflow-y:auto;padding:14px 20px;min-height:0">
      <table id="sr-tabla" style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="color:#c9a84c;font-size:11px;letter-spacing:.06em;text-transform:uppercase">
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:26%">Perfume *</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:13%">Talla *</th>
            <th style="padding:6px 8px;text-align:center;font-weight:600;width:7%">Cant.</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;width:9%">Precio *</th>
            <th style="padding:6px 8px;text-align:right;font-weight:600;width:8%">Total</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:10%">Cliente</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:12%">Estado</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600;width:10%">Nota</th>
            <th style="width:4%"></th>
          </tr>
        </thead>
        <tbody id="sr-body"></tbody>
        <tfoot>
          <tr>
            <td colspan="9" style="padding-top:10px">
              <button onclick="SRagregarLinea()"
                style="background:rgba(201,168,76,.12);border:1px dashed rgba(201,168,76,.4);
                       border-radius:9px;color:#c9a84c;font-size:13px;font-weight:600;
                       padding:8px 16px;cursor:pointer;width:100%;
                       display:flex;align-items:center;justify-content:center;gap:7px;
                       font-family:'Poppins',sans-serif">
                <i class="bi bi-plus-circle"></i> Agregar renglón
              </button>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- resumen -->
      <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px">
        <span id="sr-conteo" style="font-size:13px;color:#8a8880">0 ventas · Total:</span>
        <span id="sr-total-general" style="font-size:15px;font-weight:700;color:#c9a84c">$0</span>
      </div>
    </div>

    <!-- pie -->
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,.07);
                display:flex;gap:10px;flex-shrink:0;justify-content:flex-end">
      <button onclick="SRcerrarBtn()"
        style="height:44px;padding:0 24px;border-radius:11px;
               background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
               color:#8a8880;font-size:13px;font-weight:600;cursor:pointer;
               font-family:'Poppins',sans-serif">
        Cancelar
      </button>
      <button id="sr-btn-guardar" onclick="SRguardar()"
        style="height:44px;padding:0 28px;border-radius:11px;
               background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.5);
               color:#c9a84c;font-size:13px;font-weight:700;cursor:pointer;
               font-family:'Poppins',sans-serif;
               display:flex;align-items:center;gap:8px">
        <i class="bi bi-cloud-upload"></i> Guardar todo
      </button>
    </div>
  </div>
</div>
`;

/* ─── fila nueva ──────────────────────────────────────────────────────────── */
function nuevaFila() {
  const tr = document.createElement('tr');
  tr.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.05)';

  /* ── 1. PERFUME ── */
  const tdPerfume = document.createElement('td');
  tdPerfume.style.cssText = 'padding:4px 6px;position:relative';
  tdPerfume.innerHTML = `
    <input name="perfume" placeholder="— Perfume —" autocomplete="off"
      style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
             border-radius:8px;padding:7px 9px;color:#ede9e1;font-size:13px;
             font-family:'Poppins',sans-serif;outline:none;min-width:0">
    <input type="hidden" name="perfumeId" value="">
    <input type="hidden" name="perfumeNombre" value="">
    <input type="hidden" name="perfumeMarca" value="">
    <div class="sr-drop" style="display:none;position:absolute;top:calc(100% + 2px);left:6px;right:6px;
         background:#1a1814;border:1px solid rgba(201,168,76,.35);border-radius:10px;
         z-index:3000;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.7)"></div>`;

  const perfInput = tdPerfume.querySelector('input');
  const perfDrop  = tdPerfume.querySelector('.sr-drop');

  function renderPerfDrop(q) {
    const list = perfumes.filter(p =>
      (p.nombre + ' ' + p.marca).toLowerCase().includes((q || '').toLowerCase())
    ).slice(0, 40);
    perfDrop.innerHTML = list.length
      ? list.map(p => `
          <div class="sr-di" data-id="${p.id || ''}" data-nombre="${p.nombre}" data-marca="${p.marca}"
               style="padding:9px 14px;cursor:pointer;border-radius:8px;transition:background .1s">
            <div style="font-size:13px;font-weight:600;color:#ede9e1">${p.nombre}</div>
            <div style="font-size:11px;color:#8a8880">${p.marca}</div>
          </div>`).join('')
      : `<div style="padding:12px 14px;color:#555;font-size:13px">Sin resultados</div>`;
    perfDrop.querySelectorAll('.sr-di').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(75,194,202,.15)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        perfInput.value = el.dataset.nombre + ' · ' + el.dataset.marca;
        tr.querySelector('[name=perfumeId]').value = el.dataset.id || 'custom';
        tr.querySelector('[name=perfumeNombre]').value = el.dataset.nombre;
        tr.querySelector('[name=perfumeMarca]').value = el.dataset.marca;
        perfDrop.style.display = 'none';
        const perf = perfumes.find(p => p.id === el.dataset.id);
        if (perf?.precios || (perf?.ml && perf?.precio)) {
          const ops = perf?.precios ? Object.entries(perf.precios)
            .filter(([, v]) => Number(v) > 0)
            .map(([k, v]) => ({ talla: k, precio: Number(v) })) : [{ talla: perf.ml, precio: Number(perf.precio) }];
          if (ops.length) renderTallaDrop(ops);
        }
        SRrecalcTotal();
      });
    });
  }

  perfInput.addEventListener('focus', () => { renderPerfDrop(perfInput.value); perfDrop.style.display = 'block'; });
  perfInput.addEventListener('input', () => { renderPerfDrop(perfInput.value); perfDrop.style.display = 'block'; });
  perfInput.addEventListener('blur',  () => setTimeout(() => { perfDrop.style.display = 'none'; }, 160));

  /* ── 2. TALLA ── */
  const tdTalla = document.createElement('td');
  tdTalla.style.cssText = 'padding:4px 6px;position:relative';
  tdTalla.innerHTML = `
    <button type="button" class="sr-talla-btn"
      style="width:100%;min-width:90px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
             border-radius:8px;padding:7px 9px;color:#8a8880;font-size:13px;
             font-family:'Poppins',sans-serif;cursor:pointer;
             display:flex;align-items:center;justify-content:space-between;gap:4px">
      <span class="sr-talla-label">— Talla —</span>
      <i class="bi bi-chevron-down" style="font-size:10px;flex-shrink:0"></i>
    </button>
    <input type="hidden" name="talla" value="">
    <div class="sr-drop sr-talla-drop" style="display:none;position:absolute;top:calc(100% + 2px);left:6px;
         background:#1a1814;border:1px solid rgba(201,168,76,.35);border-radius:10px;
         z-index:3000;min-width:120px;box-shadow:0 8px 24px rgba(0,0,0,.7)"></div>`;

  const tallaBtn   = tdTalla.querySelector('.sr-talla-btn');
  const tallaLabel = tdTalla.querySelector('.sr-talla-label');
  const tallaInput = tdTalla.querySelector('[name=talla]');
  const tallaDrop  = tdTalla.querySelector('.sr-talla-drop');

  function renderTallaDrop(opciones) {
    tallaDrop.innerHTML = opciones.map(op => {
      const t = typeof op === 'string' ? op : op.talla;
      const p = typeof op === 'object' && op.precio ? op.precio : null;
      return `<div class="sr-di" data-talla="${t}" data-precio="${p ?? ''}"
                   style="padding:9px 14px;cursor:pointer;border-radius:8px;transition:background .1s;
                          display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:13px;font-weight:600;color:#ede9e1">${t}</span>
                ${p ? `<span style="font-size:12px;color:#c9a84c;font-weight:600">$${p}</span>` : ''}
              </div>`;
    }).join('') || `<div style="padding:12px 14px;color:#555;font-size:13px">Sin tallas</div>`;

    tallaDrop.querySelectorAll('.sr-di').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(75,194,202,.15)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        tallaInput.value = el.dataset.talla;
        tallaLabel.textContent = el.dataset.talla;
        tallaLabel.style.color = '#ede9e1';
        if (el.dataset.precio) {
          const pi = tr.querySelector('[name=precio]');
          if (pi) pi.value = el.dataset.precio;
        }
        tallaDrop.style.display = 'none';
        SRrecalcFila(tr);
      });
    });
  }

  tallaBtn.addEventListener('click', () => {
    if (tallaDrop.style.display === 'none') {
      if (!tallaDrop.children.length) renderTallaDrop(TALLAS_DEFAULT);
      tallaDrop.style.display = 'block';
    } else {
      tallaDrop.style.display = 'none';
    }
  });

  /* ── 3. CANTIDAD ── */
  const tdQty = document.createElement('td');
  tdQty.style.cssText = 'padding:4px 6px';
  tdQty.innerHTML = `<input type="number" name="cantidad" value="1" min="1"
    oninput="SRrecalcFila(this.closest('tr'))"
    style="width:54px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
           border-radius:8px;padding:7px 6px;color:#ede9e1;font-size:13px;text-align:center;
           font-family:'Poppins',sans-serif;outline:none">`;

  /* ── 4. PRECIO ── */
  const tdPrecio = document.createElement('td');
  tdPrecio.style.cssText = 'padding:4px 6px';
  tdPrecio.innerHTML = `<input type="number" name="precio" placeholder="$" min="0" step="1"
    oninput="SRrecalcFila(this.closest('tr'))"
    style="width:80px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
           border-radius:8px;padding:7px 6px;color:#ede9e1;font-size:13px;text-align:right;
           font-family:'Poppins',sans-serif;outline:none">`;

  /* ── 5. TOTAL ── */
  const tdTotal = document.createElement('td');
  tdTotal.className = 'sr-total-fila';
  tdTotal.style.cssText = 'padding:4px 8px;text-align:right;font-weight:700;color:#c9a84c;white-space:nowrap;font-size:13px';
  tdTotal.textContent = '—';

  /* ── 6. CLIENTE ── */
  const tdCliente = document.createElement('td');
  tdCliente.style.cssText = 'padding:4px 6px';
  tdCliente.innerHTML = `<input type="text" name="cliente" placeholder="Cliente"
    style="width:90px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
           border-radius:8px;padding:7px 8px;color:#ede9e1;font-size:13px;
           font-family:'Poppins',sans-serif;outline:none">`;

  /* ── 7. ESTADO ── */
  const tdEstado = document.createElement('td');
  tdEstado.style.cssText = 'padding:4px 6px;position:relative';
  tdEstado.innerHTML = `
    <button type="button" class="sr-estado-btn"
      style="background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);
             border-radius:8px;padding:6px 10px;color:#4ade80;font-size:12px;font-weight:600;
             font-family:'Poppins',sans-serif;cursor:pointer;white-space:nowrap;
             display:flex;align-items:center;gap:5px">
      <span class="sr-estado-label">Pagada ✅</span>
      <i class="bi bi-chevron-down" style="font-size:9px"></i>
    </button>
    <input type="hidden" name="estado" value="pagada">
    <div class="sr-drop sr-estado-drop" style="display:none;position:absolute;top:calc(100% + 2px);left:6px;
         background:#1a1814;border:1px solid rgba(201,168,76,.35);border-radius:10px;
         z-index:3000;min-width:130px;box-shadow:0 8px 24px rgba(0,0,0,.7)"></div>`;

  const estadoBtn   = tdEstado.querySelector('.sr-estado-btn');
  const estadoLabel = tdEstado.querySelector('.sr-estado-label');
  const estadoInput = tdEstado.querySelector('[name=estado]');
  const estadoDrop  = tdEstado.querySelector('.sr-estado-drop');

  estadoDrop.innerHTML = ESTADO_OPTS.map(o =>
    `<div class="sr-di" data-val="${o.val}"
          style="padding:9px 14px;cursor:pointer;border-radius:8px;transition:background .1s;
                 font-size:13px;font-weight:600;color:${o.color}">
       ${o.icon} ${o.label}
     </div>`
  ).join('');

  estadoDrop.querySelectorAll('.sr-di').forEach(el => {
    el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,.07)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const op = ESTADO_OPTS.find(o => o.val === el.dataset.val);
      estadoInput.value          = op.val;
      estadoLabel.textContent    = op.label + ' ' + op.icon;
      estadoBtn.style.color       = op.color;
      estadoBtn.style.background  = op.color + '1a';
      estadoBtn.style.borderColor = op.color + '55';
      estadoDrop.style.display = 'none';
    });
  });

  estadoBtn.addEventListener('click', () => {
    estadoDrop.style.display = estadoDrop.style.display === 'none' ? 'block' : 'none';
  });

  /* ── 8. NOTA ── */
  const tdNota = document.createElement('td');
  tdNota.style.cssText = 'padding:4px 6px';
  tdNota.innerHTML = `<input type="text" name="nota" placeholder="Nota"
    style="width:80px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
           border-radius:8px;padding:7px 8px;color:#ede9e1;font-size:13px;
           font-family:'Poppins',sans-serif;outline:none">`;

  /* ── 9. BORRAR ── */
  const tdBorrar = document.createElement('td');
  tdBorrar.style.cssText = 'padding:4px 4px;text-align:center';
  tdBorrar.innerHTML = `
    <button onclick="this.closest('tr').remove();SRrecalcTotal()" title="Eliminar"
      style="background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.2);
             border-radius:7px;width:30px;height:30px;color:#f87171;cursor:pointer;
             font-size:14px;display:flex;align-items:center;justify-content:center">
      <i class="bi bi-trash3"></i>
    </button>`;

  tr.append(tdPerfume, tdTalla, tdQty, tdPrecio, tdTotal, tdCliente, tdEstado, tdNota, tdBorrar);
  return tr;
}

/* ─── recalc ──────────────────────────────────────────────────────────────── */
function SRrecalcFila(tr) {
  const qty   = parseFloat(tr.querySelector('[name=cantidad]')?.value) || 0;
  const price = parseFloat(tr.querySelector('[name=precio]')?.value)   || 0;
  const tot   = qty * price;
  const cell  = tr.querySelector('.sr-total-fila');
  if (cell) cell.textContent = tot > 0 ? '$' + tot.toLocaleString('es-MX') : '—';
  SRrecalcTotal();
}
window.SRrecalcFila = SRrecalcFila;

function SRrecalcTotal() {
  const body = $('sr-body');
  if (!body) return;
  let total = 0, ventas = 0;
  body.querySelectorAll('tr').forEach(tr => {
    const qty   = parseFloat(tr.querySelector('[name=cantidad]')?.value) || 0;
    const price = parseFloat(tr.querySelector('[name=precio]')?.value)   || 0;
    total  += qty * price;
    if (qty > 0 && price > 0) ventas += qty;
  });
  const conteoEl = $('sr-conteo');
  const totEl    = $('sr-total-general');
  if (conteoEl) conteoEl.textContent = `${ventas} venta${ventas !== 1 ? 's' : ''} · Total:`;
  if (totEl)    totEl.textContent    = '$' + total.toLocaleString('es-MX');
}
window.SRrecalcTotal = SRrecalcTotal;

/* ─── agregar línea ───────────────────────────────────────────────────────── */
window.SRagregarLinea = function () {
  const body = $('sr-body');
  if (!body) return;
  body.appendChild(nuevaFila());
  body.lastElementChild?.querySelector('input[name=perfume]')?.focus();
};

/* ─── abrir / cerrar ──────────────────────────────────────────────────────── */
window.SRabrir = function () {
  const overlay = $('sr-overlay');
  if (!overlay) return;
  const fechaInput = $('sr-fecha');
  if (fechaInput && !fechaInput.value)
    fechaInput.value = new Date().toISOString().split('T')[0];
  const body = $('sr-body');
  if (body && body.children.length === 0) SRagregarLinea();
  overlay.style.display = 'flex';
  setTimeout(() => (overlay.style.opacity = '1'), 10);
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
  const fechaTS = Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
  const notaDia = $('sr-nota-dia')?.value.trim() || '';

  const rows = $('sr-body')?.querySelectorAll('tr') ?? [];
  if (!rows.length) { showToast('⚠️ Agrega al menos una venta', 'err'); return; }

  const lineas = [];
  let omitidas = 0;

  rows.forEach(tr => {
    const perfInputText = tr.querySelector('[name=perfume]')?.value.trim();
    const perfumeId     = tr.querySelector('[name=perfumeId]')?.value || 'custom';
    const perfumeNombre = tr.querySelector('[name=perfumeNombre]')?.value || perfInputText;
    const perfumeMarca  = tr.querySelector('[name=perfumeMarca]')?.value || '';
    const talla    = tr.querySelector('[name=talla]')?.value.trim();
    const cantidad = parseFloat(tr.querySelector('[name=cantidad]')?.value) || 0;
    const precio   = parseFloat(tr.querySelector('[name=precio]')?.value)   || 0;
    const cliente  = tr.querySelector('[name=cliente]')?.value.trim() || 'Venta física';
    const estado   = tr.querySelector('[name=estado]')?.value || 'pagada';
    const notas    = tr.querySelector('[name=nota]')?.value.trim() || '';

    if (!perfInputText || cantidad <= 0 || precio <= 0) { omitidas++; return; }
    lineas.push({ perfumeId, perfumeNombre, perfumeMarca, talla: talla || '—', cantidad, precio, total: cantidad * precio, cliente, estado, notas });
  });

  if (lineas.length === 0) {
    showToast('⚠️ Completa al menos una línea (perfume, cantidad, precio)', 'err');
    return;
  }

  const btn = $('sr-btn-guardar');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando…'; }

  try {
    const col   = collection(db, 'ventas');
    const ahora = serverTimestamp();

    await Promise.all(lineas.map(l =>
      addDoc(col, {
        fecha    : fechaTS,
        perfumeId: l.perfumeId,
        perfumeNombre: l.perfumeNombre,
        perfumeMarca: l.perfumeMarca,
        talla    : l.talla,
        cantidad : l.cantidad,
        precio   : l.precio,
        total    : l.total,
        cliente  : l.cliente,
        estado   : l.estado,
        notas    : l.notas,
        notaDia  : notaDia,
        canal    : 'sobre_ruedas',
        creadoEn : Date.now(),
      })
    ));

    const msg = omitidas > 0
      ? `✅ ${lineas.length} venta(s) guardadas (${omitidas} línea(s) incompletas omitidas)`
      : `✅ ${lineas.length} venta(s) guardadas correctamente`;
    showToast(msg);

    if ($('sr-body')) $('sr-body').innerHTML = '';
    if ($('sr-nota-dia')) $('sr-nota-dia').value = '';
    SRrecalcTotal();
    SRcerrarBtn();

  } catch (err) {
    console.error(err);
    showToast('❌ Error al guardar: ' + err.message, 'err');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Guardar todo';
    }
  }
};

/* ─── init ────────────────────────────────────────────────────────────────── */
export function initVentasSobreRuedas(perfumesCache) {
  perfumes = perfumesCache || [];
  if (!$('sr-overlay')) {
    document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  }
}

// Global click listener to close dropdowns without leaking memory per row
document.addEventListener('click', e => {
  document.querySelectorAll('.sr-drop').forEach(drop => {
    if (drop.style.display !== 'none' && !drop.parentElement.contains(e.target)) {
      drop.style.display = 'none';
    }
  });
});
