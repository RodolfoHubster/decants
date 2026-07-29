import { db, collection, getDocs, doc, updateDoc, writeBatch, getDoc, setDoc } from './firebase-config.js';
import { toast } from './toast.js';
import { renderSidebar } from '../../admin/sidebar.js';
import '../../admin/auth-guard.js';

renderSidebar('clientes');
if (window.innerWidth <= 768) {
  const menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.style.display = 'flex';
}

let clientesData = []; // Array of { nombre, ventas: [], encargos: [] }
window.blacklistCache = []; // To keep it globally available

async function loadData() {
  try {
    const [vs, os, blSnap] = await Promise.all([
      getDocs(collection(db, 'ventas')),
      getDocs(collection(db, 'ordenes_completos')),
      getDoc(doc(db, 'config', 'blacklist')).catch(() => null)
    ]);
    
    if (blSnap && blSnap.exists()) {
      window.blacklistCache = blSnap.data().names || [];
    } else {
      window.blacklistCache = [];
    }

    const ventas = [];
    vs.forEach(d => ventas.push({ id: d.id, ...d.data() }));
    
    const encargos = [];
    os.forEach(d => encargos.push({ id: d.id, ...d.data() }));

    // Agrupar por nombre normalizado
    const grupos = {};

    const addGroup = (name) => {
      if (!name) return null;
      const key = name.trim().toLowerCase();
      if (!key) return null;
      
      if (!grupos[key]) {
        grupos[key] = {
          nombreOriginal: name.trim(),
          ventas: [],
          encargos: []
        };
      }
      return grupos[key];
    };

    ventas.forEach(v => {
      const g = addGroup(v.cliente);
      if (g) g.ventas.push(v);
    });

    encargos.forEach(e => {
      const g = addGroup(e.cliente);
      if (g) g.encargos.push(e);
    });

    clientesData = Object.values(grupos).map(g => {
      // Sort items by date descending
      g.ventas.sort((a,b) => (b.creadoEn||0) - (a.creadoEn||0));
      g.encargos.sort((a,b) => (b.creadoEn?.seconds||0) - (a.creadoEn?.seconds||0));
      
      // Calculate totals
      let totalComprado = 0;
      let totalPendiente = 0;
      let pendingVentas = 0;
      let pendingEncargos = 0;
      
      g.ventas.forEach(v => {
        if (v.estado === 'cancelada') return;
        const total = (+v.precio||0) * (+v.cantidad||1);
        if (v.estado === 'pagada') totalComprado += total;
        if (v.estado === 'pendiente') {
          totalPendiente += total;
          pendingVentas++;
        }
      });
      
      g.encargos.forEach(e => {
        if (['pendiente','buscando','conseguido','avisado'].includes(e.estado)) {
          pendingEncargos++;
          totalPendiente += (+e.precio||0) - (+e.adelanto||0);
        } else if (e.estado === 'entregado') {
          totalComprado += (+e.precio||0);
        }
      });
      
      const isBanned = window.blacklistCache.map(n => n.toLowerCase()).includes(g.nombreOriginal.toLowerCase());
      
      return {
        ...g,
        totalComprado,
        totalPendiente,
        pendingVentas,
        pendingEncargos,
        isBanned
      };
    });

    clientesData.sort((a,b) => a.nombreOriginal.localeCompare(b.nombreOriginal));
    updateKPIs();
    renderClientes();
  } catch (e) {
    console.error(e);
    document.getElementById('clientes-container').innerHTML = '<div style="padding:40px;text-align:center;color:var(--danger)"><i class="bi bi-exclamation-triangle" style="font-size:32px"></i><p>Error cargando clientes</p></div>';
  }
}

function updateKPIs() {
  document.getElementById('k-clientes').textContent = clientesData.length;
  
  const encActivos = clientesData.reduce((sum, c) => sum + c.pendingEncargos, 0);
  document.getElementById('k-encargos').textContent = encActivos;
  
  const venPendientes = clientesData.reduce((sum, c) => sum + c.pendingVentas, 0);
  document.getElementById('k-pendientes').textContent = venPendientes;
}

window.toggleClient = (index) => {
  const body = document.getElementById(`cbody-${index}`);
  const icon = document.getElementById(`cicon-${index}`);
  if (body.classList.contains('open')) {
    body.classList.remove('open');
    icon.classList.remove('bi-chevron-up');
    icon.classList.add('bi-chevron-down');
  } else {
    body.classList.add('open');
    icon.classList.remove('bi-chevron-down');
    icon.classList.add('bi-chevron-up');
  }
};

window.renderClientes = () => {
  const container = document.getElementById('clientes-container');
  const q = document.getElementById('search').value.toLowerCase().trim();
  const fEstado = document.getElementById('f-estado').value;
  const fOrden = document.getElementById('f-orden').value;
  
  let filtered = clientesData.filter(c => {
    if (q && !c.nombreOriginal.toLowerCase().includes(q)) return false;
    
    if (fEstado === 'deuda' && c.totalPendiente === 0) return false;
    if (fEstado === 'encargos' && c.pendingEncargos === 0) return false;
    if (fEstado === 'al-corriente' && (c.totalPendiente > 0 || c.pendingEncargos > 0)) return false;
    
    return true;
  });
  
  if (fOrden === 'gasto') {
    filtered.sort((a,b) => b.totalComprado - a.totalComprado);
  } else if (fOrden === 'deuda') {
    filtered.sort((a,b) => b.totalPendiente - a.totalPendiente);
  } else {
    filtered.sort((a,b) => a.nombreOriginal.localeCompare(b.nombreOriginal));
  }
  
  if (!filtered.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><p>No se encontraron clientes.</p></div>';
    return;
  }
  
  container.innerHTML = filtered.map((c, idx) => {
    // Generate timeline combining ventas and encargos
    let timeline = [];
    
    c.ventas.forEach(v => {
      timeline.push({
        id: v.id,
        type: 'venta',
        dateTs: v.creadoEn || 0,
        dateStr: v.creadoEn ? new Date(v.creadoEn).toLocaleDateString('es-MX') : '—',
        title: v.perfumeNombre || 'Combo',
        desc: `${v.cantidad||1}x ${v.talla||'—'}ml`,
        price: ((+v.precio||0)*(+v.cantidad||1)),
        status: v.estado || 'pendiente'
      });
    });
    
    c.encargos.forEach(e => {
      timeline.push({
        id: e.id,
        type: 'encargo',
        dateTs: e.creadoEn?.seconds ? e.creadoEn.seconds * 1000 : 0,
        dateStr: e.creadoEn?.seconds ? new Date(e.creadoEn.seconds * 1000).toLocaleDateString('es-MX') : '—',
        title: `Encargo: ${e.perfume} ${e.marca}`,
        desc: e.notas || '',
        price: (+e.precio||0) - (+e.adelanto||0),
        status: e.estado || 'pendiente'
      });
    });
    
    timeline.sort((a,b) => b.dateTs - a.dateTs);
    
    const timelineHtml = timeline.length ? timeline.map(item => `
      <li class="timeline-item">
        <div class="tl-icon ${item.type}">
          <i class="bi ${item.type === 'venta' ? 'bi-bag' : 'bi-box-seam'}"></i>
        </div>
        <div class="tl-content">
          <div class="tl-header">
            <span class="tl-title">${item.title}</span>
            <span class="tl-date">${item.dateStr}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
            <p class="tl-desc">${item.desc}</p>
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="tl-price">$${item.price.toLocaleString('es-MX')}</span>
              <span class="tl-status ${item.status}">${item.status}</span>
              <button class="btn-tl-action" onclick="changeStatus('${item.id}', '${item.type}', '${item.status}')"><i class="bi bi-arrow-left-right"></i> Estado</button>
            </div>
          </div>
        </div>
      </li>
    `).join('') : '<p style="color:var(--text-muted);font-size:13px;">No hay historial</p>';

    let statsHtml = [];
    if (c.totalPendiente > 0) {
      statsHtml.push(`<div class="client-stat warning"><i class="bi bi-exclamation-circle"></i> Debe $${c.totalPendiente.toLocaleString('es-MX')}</div>`);
    } else {
      statsHtml.push(`<div class="client-stat success"><i class="bi bi-check-circle"></i> Al corriente</div>`);
    }
    
    if (c.pendingEncargos > 0) {
      statsHtml.push(`<div class="client-stat"><i class="bi bi-box-seam"></i> ${c.pendingEncargos} encargo(s)</div>`);
    }
    
    return `
      <div class="client-card ${c.isBanned ? 'banned' : ''}">
        <div class="client-header" onclick="toggleClient(${idx})">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <h3 class="client-name">
              <i class="bi bi-person-circle"></i> ${c.nombreOriginal} 
              <button class="btn-edit-client" onclick="event.stopPropagation(); renameClient('${c.nombreOriginal.replace(/'/g, "\\'")}')" title="Renombrar cliente"><i class="bi bi-pencil"></i></button>
              <button class="btn-ban-client" onclick="event.stopPropagation(); toggleBan('${c.nombreOriginal.replace(/'/g, "\\'")}')" title="${c.isBanned ? 'Desbloquear cliente' : 'Añadir a Lista Negra'}"><i class="bi bi-slash-circle"></i></button>
              ${c.isBanned ? '<span class="badge-banned"><i class="bi bi-exclamation-triangle-fill"></i> LISTA NEGRA</span>' : ''}
            </h3>
            <div class="client-summary">
              ${statsHtml.join('')}
              <div class="client-stat" style="color:var(--text-faint)">Histórico: $${c.totalComprado.toLocaleString('es-MX')}</div>
            </div>
          </div>
          <i class="bi bi-chevron-down" id="cicon-${idx}" style="color:var(--text-muted);"></i>
        </div>
        <div class="client-body" id="cbody-${idx}">
          <ul class="timeline">
            ${timelineHtml}
          </ul>
        </div>
      </div>
    `;
  }).join('');
};

loadData();

window.renameClient = async (oldName) => {
  const { value: newName } = await Swal.fire({
    title: 'Renombrar Cliente',
    input: 'text',
    inputLabel: `Nuevo nombre para "${oldName}"`,
    inputValue: oldName,
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || value.trim() === '') return 'El nombre no puede estar vacío';
    }
  });

  if (newName && newName.trim() !== oldName) {
    try {
      const batch = writeBatch(db);
      
      const cData = clientesData.find(c => c.nombreOriginal === oldName);
      if(!cData) return;
      
      cData.ventas.forEach(v => {
        batch.update(doc(db, 'ventas', v.id), { cliente: newName.trim() });
      });
      
      cData.encargos.forEach(e => {
        batch.update(doc(db, 'ordenes_completos', e.id), { cliente: newName.trim() });
      });
      
      await batch.commit();
      toast('Cliente renombrado exitosamente');
      loadData();
    } catch (e) {
      console.error(e);
      toast('Error al renombrar', 'error');
    }
  }
};

window.changeStatus = async (id, type, currentStatus) => {
  const getOptions = (tipo) => {
      if (tipo === 'venta') {
        return [
        { id: 'pagada', icon: '<i class="bi bi-check-circle-fill"></i>', label: 'Pagada', color: '#22c55e' },
        { id: 'pendiente', icon: '<i class="bi bi-hourglass-split"></i>', label: 'Pendiente', color: '#f59e0b' },
        { id: 'cancelada', icon: '<i class="bi bi-x-circle-fill"></i>', label: 'Cancelada', color: '#ef4444' },
        { id: 'quedo_mal', icon: '<i class="bi bi-hand-thumbs-down-fill"></i>', label: 'Quedó Mal', color: '#7f1d1d' }
        ];
      } else {
        return [
        { id: 'conseguido', icon: '<i class="bi bi-check-circle-fill"></i>', label: 'Conseguido', color: '#22c55e' },
        { id: 'entregado', icon: '<i class="bi bi-box-seam"></i>', label: 'Entregado', color: '#8b5cf6' },
        { id: 'avisado', icon: '<i class="bi bi-telephone"></i>', label: 'Avisado', color: '#3b82f6' },
        { id: 'buscando', icon: '<i class="bi bi-search"></i>', label: 'Buscando', color: '#f59e0b' },
        { id: 'pendiente', icon: '<i class="bi bi-hourglass-split"></i>', label: 'Pendiente', color: '#64748b' },
        { id: 'cancelada', icon: '<i class="bi bi-x-circle-fill"></i>', label: 'Cancelada', color: '#ef4444' },
        { id: 'quedo_mal', icon: '<i class="bi bi-hand-thumbs-down-fill"></i>', label: 'Quedó Mal', color: '#7f1d1d' }
        ];
      }
  };
  const options = getOptions(type);

  const html = `
    <style>
      .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
      .status-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text); cursor: pointer; transition: 0.2s; }
      .status-btn:hover { background: rgba(255,255,255,0.05); }
      .status-btn.active { border-color: currentColor; background: rgba(255,255,255,0.1); box-shadow: 0 0 10px currentColor; }
      .status-icon { font-size: 24px; margin-bottom: 4px; }
      .status-label { font-size: 13px; font-weight: 600; color: var(--text); }
    </style>
    <div class="status-grid">
      ${options.map(o => `
        <div class="status-btn ${currentStatus === o.id ? 'active' : ''}" style="border-color: ${o.color}" onclick="window.tempSelectedStatus='${o.id}'; Swal.clickConfirm();">
          <div class="status-icon">${o.icon}</div>
          <div class="status-label">${o.label}</div>
        </div>
      `).join('')}
    </div>
  `;

  window.tempSelectedStatus = null;
  const res = await Swal.fire({
    title: 'Cambiar Estado',
    html: html,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'swal-wide' }
  });
  
  const newStatus = window.tempSelectedStatus;
  
  if (res.isConfirmed && newStatus && newStatus !== currentStatus) {
    try {
      const collectionName = type === 'venta' ? 'ventas' : 'ordenes_completos';
      await updateDoc(doc(db, collectionName, id), { estado: newStatus });
      toast('Estado actualizado');
      loadData();
    } catch (e) {
      console.error(e);
      toast('Error al cambiar estado', 'error');
    }
  }
};

window.toggleBan = async (clientName) => {
  const isBanned = window.blacklistCache.map(n => n.toLowerCase()).includes(clientName.toLowerCase());
  
  const text = isBanned 
    ? `¿Estás seguro de que deseas desbloquear a <b>${clientName}</b>?`
    : `¿Estás seguro de que deseas añadir a <b>${clientName}</b> a la lista negra?<br><br><small>El sistema bloqueará cualquier intento de nueva venta o encargo para este cliente.</small>`;
    
  const res = await Swal.fire({
    title: isBanned ? '<i class="bi bi-unlock"></i> Desbloquear Cliente' : '<i class="bi bi-slash-circle"></i> Bloquear Cliente',
    html: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: isBanned ? '#22c55e' : '#ef4444',
    confirmButtonText: isBanned ? 'Sí, desbloquear' : 'Sí, bloquear',
    cancelButtonText: 'Cancelar'
  });
  
  if (res.isConfirmed) {
    try {
      let newBlacklist = [...window.blacklistCache];
      
      if (isBanned) {
        newBlacklist = newBlacklist.filter(n => n.toLowerCase() !== clientName.toLowerCase());
      } else {
        newBlacklist.push(clientName);
      }
      
      await setDoc(doc(db, 'config', 'blacklist'), { names: newBlacklist }, { merge: true });
      window.blacklistCache = newBlacklist;
      
      toast(isBanned ? 'Cliente desbloqueado' : 'Cliente bloqueado correctamente', 'success');
      loadData();
    } catch (e) {
      console.error(e);
      toast('Error al actualizar lista negra', 'error');
    }
  }
};
