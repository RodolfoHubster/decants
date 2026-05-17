import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc }
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
  pedidos = []; ped.forEach(d => pedidos.push({ id: d.id, ...d.data() }));
  pedidos.sort((a,b) => (b.creadoEn||0) - (a.creadoEn||0));
  updateKPIs();
  renderTable();
}

function updateKPIs() {
  ['nuevo','preparando','enviado','entregado'].forEach(e => {
    const el = document.getElementById('k-' + (e==='nuevo'?'nuevo':e==='preparando'?'prep':e==='enviado'?'env':'ent'));
    if(el) el.textContent = pedidos.filter(p=>p.estado===e).length;
  });
}

window.renderTable = () => {
  const q = document.getElementById('search').value.toLowerCase();
  const fe = document.getElementById('f-estado').value;
  const fil = pedidos.filter(p =>
    (!fe || p.estado === fe) &&
    (!q || (p.cliente||'').toLowerCase().includes(q) || (p.folio||'').toLowerCase().includes(q))
  );
  document.getElementById('count-label').textContent = fil.length + ' pedidos';
  const tb = document.getElementById('tbody');
  if (!fil.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-box"></i><h3>Sin pedidos</h3><p>Agrega el primer pedido.</p></div></td></tr>';
    return;
  }
  tb.innerHTML = fil.map(p => {
    const fecha = p.creadoEn ? new Date(p.creadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const items = (p.items||[]).map(i=>`${i.perfume} ${i.talla}ml`).join(', ');
    const total = (p.items||[]).reduce((s,i)=>s+(+i.precio||0)*(+i.cantidad||1),0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    return `<tr>
      <td><code style="font-size:11px;color:var(--accent)">${p.folio||p.id.slice(0,6).toUpperCase()}</code></td>
      <td style="color:var(--text-muted);font-size:13px">${fecha}</td>
      <td><strong>${p.cliente||'—'}</strong><br><span style="font-size:11px;color:var(--text-faint)">${p.telefono||''}</span></td>
      <td><span class="items-list">${items||'—'}</span></td>
      <td><strong>${total}</strong></td>
      <td>
        <select class="form-control" style="min-width:120px;font-size:12px;padding:3px 6px" onchange="cambiarEstado('${p.id}',this.value)">
          ${['nuevo','preparando','enviado','entregado','cancelado'].map(e=>`<option value="${e}" ${p.estado===e?'selected':''}>${e.charAt(0).toUpperCase()+e.slice(1)}</option>`).join('')}
        </select>
      </td>
      <td><div style="display:flex;gap:6px">
        <button class="btn-icon" onclick="verDetalle('${p.id}')" title="Ver detalle"><i class="bi bi-eye"></i></button>
        <button class="btn-icon" onclick="del('${p.id}')" title="Eliminar"><i class="bi bi-trash" style="color:var(--danger)"></i></button>
      </div></td>
    </tr>`;
  }).join('');
};

window.addItem = () => {
  itemCount++;
  const idx = itemCount;
  const perfOpts = perfumes.map(p=>`<option value="${p.nombre}" data-precios='${JSON.stringify(p.precios||{})}'>${p.nombre}</option>`).join('');
  const div = document.createElement('div');
  div.id = 'item-' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 36px;gap:8px;margin-bottom:8px;align-items:end';
  div.innerHTML = `
    <div><label style="font-size:12px">Perfume</label>
      <select class="form-control" id="ip-${idx}" onchange="onItemPerf(${idx})">
        <option value="">Selecciona</option>${perfOpts}
      </select></div>
    <div><label style="font-size:12px">Talla ml</label>
      <select class="form-control" id="it-${idx}"><option value="">—</option></select></div>
    <div><label style="font-size:12px">Precio $</label>
      <input class="form-control" type="number" id="ipr-${idx}" placeholder="0" oninput="calcTotal()"></div>
    <div style="padding-bottom:1px"><button type="button" class="btn-icon" onclick="removeItem(${idx})" style="color:var(--danger);margin-top:20px"><i class="bi bi-x"></i></button></div>`;
  document.getElementById('items-container').appendChild(div);
};

window.onItemPerf = (idx) => {
  const sel = document.getElementById('ip-' + idx);
  const opt = sel.selectedOptions[0];
  const precios = opt ? JSON.parse(opt.dataset.precios||'{}') : {};
  const tallaSel = document.getElementById('it-' + idx);
  const prec = document.getElementById('ipr-' + idx);
  const opts = Object.entries(precios).filter(([,v])=>+v>0)
    .map(([k,v])=>`<option value="${k}" data-p="${v}">${k} ml</option>`).join('');
  tallaSel.innerHTML = '<option value="">—</option>' + opts;
  tallaSel.onchange = () => { const o=tallaSel.selectedOptions[0]; if(o&&o.dataset.p) prec.value=o.dataset.p; calcTotal(); };
};

window.removeItem = (idx) => {
  document.getElementById('item-'+idx)?.remove();
  calcTotal();
};

window.calcTotal = () => {
  let total = 0;
  document.querySelectorAll('[id^="ipr-"]').forEach(el => { total += +el.value||0; });
  document.getElementById('lbl-total').textContent = total.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
};

window.openModal = () => {
  ['p-id','p-cliente','p-tel','p-dir','p-notas'].forEach(id => document.getElementById(id).value='');
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
  const items = itemEls.map(el => {
    const idx = el.id.replace('item-','');
    return {
      perfume: document.getElementById('ip-'+idx)?.value||'',
      talla: document.getElementById('it-'+idx)?.value||'',
      precio: +document.getElementById('ipr-'+idx)?.value||0,
      cantidad: 1
    };
  }).filter(i => i.perfume && i.talla);
  if (!items.length) { toast('Agrega al menos un item con perfume y talla', 'error'); return; }
  const btn = document.getElementById('btn-save');
  btn.disabled=true; btn.innerHTML='<i class="bi bi-hourglass-split"></i> Guardando...';
  try {
    const data = {
      cliente,
      telefono: document.getElementById('p-tel').value.trim(),
      direccion: document.getElementById('p-dir').value.trim(),
      notas: document.getElementById('p-notas').value.trim(),
      estado: document.getElementById('p-estado').value,
      items,
      folio: 'FS-' + Date.now().toString(36).toUpperCase(),
      creadoEn: Date.now()
    };
    await addDoc(collection(db,'pedidos'), data);
    toast('Pedido creado ✅', 'success');
    closeModal();
    loadAll();
  } catch(e) { toast('Error: '+e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='<i class="bi bi-check2"></i> Guardar'; }
};

window.cambiarEstado = async (id, estado) => {
  await updateDoc(doc(db,'pedidos',id),{estado});
  const p = pedidos.find(x=>x.id===id);
  if(p) p.estado = estado;
  updateKPIs();
  toast('Estado actualizado','info');
};

window.verDetalle = (id) => {
  const p = pedidos.find(x=>x.id===id);
  if(!p) return;
  const fecha = p.creadoEn ? new Date(p.creadoEn).toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : '—';
  const itemsHtml = (p.items||[]).map(i=>`
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span>${i.perfume} — <strong>${i.talla} ml</strong></span>
      <strong>${(+i.precio||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</strong>
    </div>`).join('');
  const total = (p.items||[]).reduce((s,i)=>s+(+i.precio||0),0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
  document.getElementById('detalle-body').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;color:var(--text-faint);margin-bottom:2px">Folio</div>
      <code style="color:var(--accent);font-size:15px">${p.folio||p.id.slice(0,6).toUpperCase()}</code>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:11px;color:var(--text-faint)">Cliente</div><strong>${p.cliente||'—'}</strong></div>
      <div><div style="font-size:11px;color:var(--text-faint)">Teléfono</div><span>${p.telefono||'—'}</span></div>
      <div><div style="font-size:11px;color:var(--text-faint)">Fecha</div><span style="font-size:13px">${fecha}</span></div>
      <div><div style="font-size:11px;color:var(--text-faint)">Estado</div><span class="badge-estado ${p.estado}">${p.estado}</span></div>
    </div>
    ${p.direccion?`<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--text-faint)">Dirección</div><span>${p.direccion}</span></div>`:''}
    <div style="margin-bottom:8px;font-size:12px;font-weight:600;color:var(--text-faint);text-transform:uppercase">Items</div>
    ${itemsHtml}
    <div style="display:flex;justify-content:flex-end;margin-top:12px;font-size:15px">
      <strong>Total: <span style="color:var(--accent)">${total}</span></strong>
    </div>
    ${p.notas?`<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:8px;font-size:13px"><i class="bi bi-chat-left-text"></i> ${p.notas}</div>`:''}`;
  document.getElementById('modal-detalle').classList.add('open');
};
window.closeDetalle = () => document.getElementById('modal-detalle').classList.remove('open');

window.del = async (id) => {
  if (!confirm('¿Eliminar este pedido?')) return;
  await deleteDoc(doc(db,'pedidos',id));
  toast('Pedido eliminado','info');
  loadAll();
};

loadAll();
