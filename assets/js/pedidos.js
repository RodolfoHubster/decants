import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc }
  from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { toast } from './toast.js';
import '../../admin/auth-guard.js';

renderSidebar('pedidos');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

let pedidos = [], perfumes = [];
let itemCount = 0;

async function loadAll() {
  const [ped, ps] = await Promise.all([
    getDocs(collection(db, 'pedidos')),
    getDocs(collection(db, 'perfumes'))
  ]);
  perfumes = []; ps.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
  pedidos  = []; ped.forEach(d => pedidos.push({ id: d.id, ...d.data() }));
  pedidos.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
  updateKPIs();
  renderTable();
}

function updateKPIs() {
  [['nuevo','k-nuevo'],['preparando','k-prep'],['enviado','k-env'],['entregado','k-ent']].forEach(([estado, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.textContent = pedidos.filter(p => p.estado === estado).length;
  });
}

// ─── AUTO-VENTA al marcar entregado ──────────────────────────────────────────
async function generarVentasDesdePedido(pedido) {
  if (pedido.ventasGeneradas) return;

  const freshSnap = await getDoc(doc(db, 'pedidos', pedido.id));
  if (freshSnap.exists() && freshSnap.data().ventasGeneradas) return;

  const promises = (pedido.items || []).map(item => {
    if (!item.perfume || !item.talla) return null;
    const perfumeEncontrado = perfumes.find(p => p.nombre === item.perfume);
    return addDoc(collection(db, 'ventas'), {
      perfumeId:     perfumeEncontrado?.id || '',
      perfumeNombre: item.perfume,
      perfumeMarca:  perfumeEncontrado?.marca || '',
      talla:         item.talla,
      precio:        +item.precio || 0,
      cantidad:      +item.cantidad || 1,
      estado:        'pagada',
      cliente:       pedido.cliente || '',
      notas:         `Pedido ${pedido.folio || pedido.id.slice(0,6).toUpperCase()} - generado al entregar`,
      creadoEn:      Date.now(),
      origen:        'pedido',
      pedidoId:      pedido.id
    });
  }).filter(Boolean);
  await Promise.all(promises);
  // Marcar el pedido para no duplicar ventas
  await updateDoc(doc(db, 'pedidos', pedido.id), { ventasGeneradas: true });
}

window.renderTable = () => {
  const q  = document.getElementById('search').value.toLowerCase();
  const fe = document.getElementById('f-estado').value;
  const fil = pedidos.filter(p =>
    (!fe || p.estado === fe) &&
    (!q  || (p.cliente || '').toLowerCase().includes(q) || (p.folio || '').toLowerCase().includes(q))
  );
  document.getElementById('count-label').textContent = fil.length + ' pedidos';
  const tb = document.getElementById('tbody');
  if (!fil.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="bi bi-box"></i><h3>Sin pedidos</h3><p>Agrega el primer pedido.</p></div></td></tr>';
    return;
  }
  tb.innerHTML = fil.map(p => {
    const fecha   = p.creadoEn ? new Date(p.creadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '&#8212;';
    const items   = (p.items || []).map(i => `${i.perfume} ${i.talla}ml`).join(', ');
    const total   = (p.items || []).reduce((s, i) => s + (+i.precio || 0) * (+i.cantidad || 1), 0)
                      .toLocaleString('es-MX', {style:'currency', currency:'MXN'});
    const tracking = p.tracking
      ? `<a href="https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/Guia.aspx?n=${p.tracking}" target="_blank" style="font-size:11px;color:var(--accent)">${p.tracking}</a>`
      : '&#8212;';
    const ventasBadge = p.ventasGeneradas
      ? `<span title="Ventas generadas" style="color:var(--success,#437a22);font-size:13px"><i class="bi bi-check2-circle"></i></span>`
      : '';
    const pid = p.id;
    return `<tr>
      <td><code style="font-size:11px;color:var(--accent)">${p.folio || pid.slice(0,6).toUpperCase()}</code></td>
      <td style="color:var(--text-muted);font-size:13px">${fecha}</td>
      <td><strong>${p.cliente || '&#8212;'}</strong><br><span style="font-size:11px;color:var(--text-faint)">${p.telefono || ''}</span></td>
      <td><span class="items-list">${items || '&#8212;'}</span></td>
      <td><strong>${total}</strong>${ventasBadge}</td>
      <td>${tracking}</td>
      <td>
        <select class="form-control" style="min-width:120px;font-size:12px;padding:3px 6px"
          onchange="cambiarEstado('${pid}',this.value)">
          ${['nuevo','preparando','enviado','entregado','cancelado']
            .map(e => `<option value="${e}" ${p.estado===e?'selected':''}>${e.charAt(0).toUpperCase()+e.slice(1)}</option>`)
            .join('')}
        </select>
      </td>
      <td><div style="display:flex;gap:6px">
        <button class="btn-icon" onclick="verDetalle('${pid}')" title="Ver detalle"><i class="bi bi-eye"></i></button>
        <button class="btn-icon" onclick="editTracking('${pid}','${p.tracking||''}')" title="Agregar guia"><i class="bi bi-truck"></i></button>
        <button class="btn-icon" onclick="del('${pid}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`;
  }).join('');
};

// ─── TRACKING ────────────────────────────────────────────────────────────────
window.editTracking = (id, current) => {
  document.getElementById('tr-id').value  = id;
  document.getElementById('tr-num').value = current;
  document.getElementById('modal-tracking').classList.add('open');
};
window.closeTracking = () => document.getElementById('modal-tracking').classList.remove('open');
window.guardarTracking = async () => {
  const id  = document.getElementById('tr-id').value;
  const num = document.getElementById('tr-num').value.trim();
  const p   = pedidos.find(x => x.id === id);
  const historial = [...(p?.historial || []), { accion: `Guia de rastreo: ${num || '(eliminada)'}`, fecha: Date.now() }];
  await updateDoc(doc(db, 'pedidos', id), { tracking: num, historial });
  toast('Guia actualizada ✅', 'success');
  closeTracking();
  loadAll();
};

// ─── CAMBIAR ESTADO + auto-venta si entregado ─────────────────────────────────
window.cambiarEstado = async (id, estado) => {
  const p = pedidos.find(x => x.id === id);
  const histEntry  = { accion: `Estado -> ${estado}`, fecha: Date.now() };
  const historial  = [...(p?.historial || []), histEntry];
  await updateDoc(doc(db, 'pedidos', id), { estado, historial });
  if (p) p.estado = estado;
  // Si se marca entregado, generar ventas automaticamente
  if (estado === 'entregado' && p) {
    try {
      await generarVentasDesdePedido({ ...p, estado: 'entregado' });
      toast('Pedido entregado — ventas registradas automaticamente ✅', 'success');
    } catch (e) {
      toast('Estado actualizado pero error al generar ventas: ' + e.message, 'error');
    }
  } else {
    toast('Estado actualizado', 'info');
  }
  updateKPIs();
  loadAll();
};

window.addItem = () => {
  itemCount++;
  const idx      = itemCount;
  const perfOpts = perfumes.map(p =>
    `<option value="${p.nombre}" data-precios='${JSON.stringify(p.precios || {})}'>${p.nombre}</option>`
  ).join('');
  const div = document.createElement('div');
  div.id = 'item-' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 36px;gap:8px;margin-bottom:8px;align-items:end';
  div.innerHTML = `
    <div><label style="font-size:12px">Perfume</label>
      <select class="form-control" id="ip-${idx}" onchange="onItemPerf(${idx})">
        <option value="">Selecciona</option>${perfOpts}
      </select></div>
    <div><label style="font-size:12px">Talla ml</label>
      <select class="form-control" id="it-${idx}"><option value="">&#8212;</option></select></div>
    <div><label style="font-size:12px">Precio $</label>
      <input class="form-control" type="number" id="ipr-${idx}" placeholder="0" oninput="calcTotal()"></div>
    <div style="padding-bottom:1px">
      <button type="button" class="btn-icon" onclick="removeItem(${idx})" style="color:var(--danger);margin-top:20px">
        <i class="bi bi-x"></i></button></div>`;
  document.getElementById('items-container').appendChild(div);
};

window.onItemPerf = (idx) => {
  const sel     = document.getElementById('ip-' + idx);
  const opt     = sel.selectedOptions[0];
  const precios = opt ? JSON.parse(opt.dataset.precios || '{}') : {};
  const tallaSel = document.getElementById('it-' + idx);
  const prec     = document.getElementById('ipr-' + idx);
  const opts = Object.entries(precios).filter(([, v]) => +v > 0)
    .map(([k, v]) => `<option value="${k}" data-p="${v}">${k} ml</option>`).join('');
  tallaSel.innerHTML = '<option value="">&#8212;</option>' + opts;
  tallaSel.onchange  = () => {
    const o = tallaSel.selectedOptions[0];
    if (o && o.dataset.p) prec.value = o.dataset.p;
    calcTotal();
  };
};

window.removeItem = (idx) => {
  document.getElementById('item-' + idx)?.remove();
  calcTotal();
};

window.calcTotal = () => {
  let total = 0;
  document.querySelectorAll('[id^="ipr-"]').forEach(el => { total += +el.value || 0; });
  document.getElementById('lbl-total').textContent = total.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
};

window.openModal = () => {
  ['p-id','p-cliente','p-tel','p-dir','p-notas'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('p-estado').value = 'nuevo';
  document.getElementById('items-container').innerHTML = '';
  document.getElementById('lbl-total').textContent = '$0.00';
  itemCount = 0;
  document.getElementById('modal-title').textContent = 'Nuevo Pedido';
  document.getElementById('modal').classList.add('open');
  addItem();
};
window.closeModal = () => document.getElementById('modal').classList.remove('open');

window.save = async () => {
  const cliente = document.getElementById('p-cliente').value.trim();
  if (!cliente) { toast('El nombre del cliente es obligatorio', 'error'); return; }
  const itemEls = [...document.getElementById('items-container').children];
  const items   = itemEls.map(el => {
    const idx = el.id.replace('item-', '');
    return {
      perfume:  document.getElementById('ip-'  + idx)?.value || '',
      talla:    document.getElementById('it-'  + idx)?.value || '',
      precio:   +document.getElementById('ipr-' + idx)?.value || 0,
      cantidad: 1
    };
  }).filter(i => i.perfume && i.talla);
  if (!items.length) { toast('Agrega al menos un item con perfume y talla', 'error'); return; }
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
  try {
    const data = {
      cliente,
      telefono:  document.getElementById('p-tel').value.trim(),
      direccion: document.getElementById('p-dir').value.trim(),
      notas:     document.getElementById('p-notas').value.trim(),
      estado:    document.getElementById('p-estado').value,
      items,
      folio:    'FS-' + Date.now().toString(36).toUpperCase(),
      creadoEn: Date.now(),
      historial: [{ accion: 'Pedido creado', fecha: Date.now() }]
    };
    await addDoc(collection(db, 'pedidos'), data);
    toast('Pedido creado ✅', 'success');
    closeModal();
    loadAll();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-check2"></i> Guardar';
  }
};

window.verDetalle = (id) => {
  const p = pedidos.find(x => x.id === id);
  if (!p) return;
  const fecha = p.creadoEn
    ? new Date(p.creadoEn).toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
    : '&#8212;';
  const itemsHtml = (p.items || []).map(i => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span>${i.perfume} &#8212; <strong>${i.talla} ml</strong></span>
      <strong>${(+i.precio || 0).toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</strong>
    </div>`).join('');
  const total = (p.items || []).reduce((s, i) => s + (+i.precio || 0), 0)
    .toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  const histHtml = (p.historial || []).length
    ? `<div style="margin-top:16px">
         <div style="font-size:11px;font-weight:600;color:var(--text-faint);text-transform:uppercase;margin-bottom:8px">Historial</div>
         ${[...p.historial].reverse().map(h => `
           <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
             <span>${h.accion}</span>
             <span style="color:var(--text-faint)">${new Date(h.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
           </div>`).join('')}
       </div>`
    : '';
  const ventasBadgeDetalle = p.ventasGeneradas
    ? `<div style="margin-top:12px;padding:8px 12px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--success,#437a22)">
         <i class="bi bi-check2-circle"></i> Ventas registradas automaticamente en el modulo de ventas
       </div>`
    : '';
  document.getElementById('detalle-body').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;color:var(--text-faint);margin-bottom:2px">Folio</div>
      <code style="color:var(--accent);font-size:15px">${p.folio || p.id.slice(0,6).toUpperCase()}</code>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:11px;color:var(--text-faint)">Cliente</div><strong>${p.cliente || '&#8212;'}</strong></div>
      <div><div style="font-size:11px;color:var(--text-faint)">Telefono</div><span>${p.telefono || '&#8212;'}</span></div>
      <div><div style="font-size:11px;color:var(--text-faint)">Fecha</div><span style="font-size:13px">${fecha}</span></div>
      <div><div style="font-size:11px;color:var(--text-faint)">Estado</div><span class="badge-estado ${p.estado}">${p.estado}</span></div>
      ${p.tracking ? `<div><div style="font-size:11px;color:var(--text-faint)">Guia de rastreo</div><code style="color:var(--accent)">${p.tracking}</code></div>` : ''}
    </div>
    ${p.direccion ? `<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--text-faint)">Direccion</div><span>${p.direccion}</span></div>` : ''}
    <div style="margin-bottom:8px;font-size:12px;font-weight:600;color:var(--text-faint);text-transform:uppercase">Items</div>
    ${itemsHtml}
    <div style="display:flex;justify-content:flex-end;margin-top:12px;font-size:15px">
      <strong>Total: <span style="color:var(--accent)">${total}</span></strong>
    </div>
    ${p.notas ? `<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:8px;font-size:13px"><i class="bi bi-chat-left-text"></i> ${p.notas}</div>` : ''}
    ${ventasBadgeDetalle}
    ${histHtml}`;
  document.getElementById('modal-detalle').classList.add('open');
};
window.closeDetalle = () => document.getElementById('modal-detalle').classList.remove('open');

window.del = async (id) => {
  if (!confirm('¿Eliminar este pedido?')) return;
  await deleteDoc(doc(db, 'pedidos', id));
  toast('Pedido eliminado', 'info');
  loadAll();
};

loadAll();
