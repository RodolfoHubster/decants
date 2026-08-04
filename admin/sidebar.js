import { auth, signOut } from '../assets/js/firebase-config.js';

export function renderSidebar(active) {
  const wrap = document.getElementById('sidebar-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">FS</div>
      <span>Fitoscents</span>
    </div>
    <ul class="sidebar-nav">
      <li><a href="./dashboard.html"  class="${active==='dashboard'  ?'active':''}" ><i class="bi bi-grid"></i> Dashboard</a></li>
      
      <li class="sidebar-divider"></li>
      <li class="sidebar-section-label"><i class="bi bi-box-seam"></i> Catálogo y Productos</li>
      <li><a href="./perfumes.html"   class="${active==='perfumes'   ?'active':''}" ><i class="bi bi-droplet"></i> Perfumes</a></li>
      <li><a href="./paquetes.html"   class="${active==='paquetes'   ?'active':''}" ><i class="bi bi-box2-heart"></i> Paquetes (Combos)</a></li>
      <li><a href="./accesorios.html" class="${active==='accesorios' ?'active':''}" ><i class="bi bi-bag-plus"></i> Accesorios Extras</a></li>
      <li><a href="./marcas.html"     class="${active==='marcas'     ?'active':''}" ><i class="bi bi-bookmark"></i> Marcas</a></li>
      <li><a href="./categorias.html" class="${active==='categorias' ?'active':''}" ><i class="bi bi-tag"></i> Categorias</a></li>
      <li><a href="./notas.html"      class="${active==='notas'      ?'active':''}" ><i class="bi bi-flower1"></i> Notas Olfativas</a></li>
      
      <li class="sidebar-divider"></li>
      <li class="sidebar-section-label"><i class="bi bi-cash-stack"></i> Ventas y Clientes</li>
      <li><a href="./clientes.html"   class="${active==='clientes'   ?'active':''}" ><i class="bi bi-people"></i> Directorio de Clientes</a></li>
      <li><a href="./ventas.html"     class="${active==='ventas'     ?'active':''}" ><i class="bi bi-shop"></i> Punto de Venta</a></li>
      <li><a href="./pedidos.html"    class="${active==='pedidos'    ?'active':''}" ><i class="bi bi-bag"></i> Pedidos Web</a></li>
      <li><a href="./consignaciones.html" class="${active==='consignaciones' ?'active':''}" ><i class="bi bi-geo-alt"></i> Puntos Externos</a></li>
      
      <li class="sidebar-divider"></li>
      <li class="sidebar-section-label"><i class="bi bi-graph-up-arrow"></i> Inteligencia de Negocio</li>
      <li><a href="./estadisticas.html" class="${active==='estadisticas' ?'active':''}" ><i class="bi bi-bar-chart-line"></i> Estadísticas</a></li>
      <li><a href="./costos.html"       class="${active==='costos'       ?'active':''}" ><i class="bi bi-calculator"></i> Costos e Insumos</a></li>
      
      <li class="sidebar-divider"></li>
      <li class="sidebar-section-label"><i class="bi bi-star-fill"></i> Botellas Completas</li>
      <li><a href="./perfumes-completos.html" class="${active==='perfumes-completos' ?'active':''}" ><i class="bi bi-bag-heart"></i> Catálogo Completos</a></li>
      <li><a href="./encargos.html"           class="${active==='encargos'           ?'active':''}" ><i class="bi bi-clock-history"></i> Encargos</a></li>
      
      <li class="sidebar-divider"></li>
      <li class="sidebar-section-label"><i class="bi bi-gear-fill"></i> Ajustes</li>
      <li><a href="./ajustes.html"    class="${active==='ajustes'    ?'active':''}" ><i class="bi bi-gear-fill"></i> Inteligencia Artificial</a></li>
      <li><a href="./novedades.html"  class="${active==='novedades'  ?'active':''}" ><i class="bi bi-stars"></i> Novedades</a></li>
      <li class="sidebar-divider"></li>
      <li>
        <label style="display:flex;align-items:center;gap:12px;padding:12px 20px;color:var(--text-muted);cursor:pointer;font-size:13.5px;transition:all 0.2s;">
          <i class="bi bi-wifi-off"></i>
          <span style="flex:1;">Modo Ahorro (Sin Imágenes)</span>
          <input type="checkbox" id="data-saver-toggle" onchange="window.toggleDataSaver(this)" style="width:18px;height:18px;accent-color:var(--accent);">
        </label>
      </li>
    </ul>
    <div class="sidebar-footer">
      <a href="../index.html" class="sidebar-link-index"><i class="bi bi-shop"></i> Ver tienda</a>
      <button class="btn-logout" id="btn-logout"><i class="bi bi-box-arrow-right"></i> Cerrar sesion</button>
    </div>
  </nav>
  <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>`;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth);
    window.location.replace('../index.html');
  });
}

window.toggleSidebar = () => {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('open');
};

window.closeSidebar = () => {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
};

// Initialize toggle state
document.addEventListener('DOMContentLoaded', () => {
  const chk = document.getElementById('data-saver-toggle');
  if (chk) chk.checked = localStorage.getItem('adminDataSaver') === '1';
});

window.toggleDataSaver = (chk) => {
  if (chk.checked) {
    localStorage.setItem('adminDataSaver', '1');
  } else {
    localStorage.removeItem('adminDataSaver');
  }
  // Reload page to apply new image settings immediately
  window.location.reload();
};

// ── POS (Canasta) UI Injection ──────────────────────────────────────────────
function injectCanastaUI() {
  if (document.getElementById('pos-drawer')) return; // Avoid duplicate injection

  const drawerHTML = `
  <div class="pos-overlay" id="pos-overlay" onclick="togglePosCart()"></div>
  <div class="pos-drawer" id="pos-drawer" style="background:var(--bg-dark); color:var(--text-primary);">
    <div style="border-bottom:1px solid var(--border);padding:20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <h4 style="font-size:18px;margin:0;font-weight:700;display:flex;align-items:center;gap:10px;"><i class="bi bi-bag"></i> Tu pedido</h4>
      <button class="btn-icon" style="background:var(--bg-card2);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);border:none;" onclick="togglePosCart()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div id="pos-items" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;"></div>
    <div style="padding:20px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:16px;flex-shrink:0;background:var(--bg-dark);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:14px;color:var(--text-muted);margin-bottom:4px;">Total estimado</div>
          <div style="font-size:11px;color:var(--text-faint);">* Precios sujetos a confirmación</div>
        </div>
        <span id="pos-total" style="color:var(--accent);font-size:20px;font-weight:800;">$0 MXN</span>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:14px;font-size:16px;font-weight:600;border-radius:12px;background:var(--accent);border-color:var(--accent);color:#000;" onclick="window.location.href='./ventas.html?openS=1'"><i class="bi bi-card-checklist"></i> Ir a registrar pedido</button>
    </div>
  </div>`;
  const div = document.createElement('div');
  div.innerHTML = drawerHTML;
  document.body.appendChild(div);

  window.togglePosCart = () => {
    document.getElementById('pos-drawer').classList.toggle('open');
    document.getElementById('pos-overlay').classList.toggle('open');
    window.renderPosCart();
  };

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    let actions = topbar.querySelector('div:last-child');
    if (!actions || actions === topbar.firstElementChild) {
      actions = document.createElement('div');
      actions.style.display = 'flex'; actions.style.gap = '8px';
      topbar.appendChild(actions);
    }
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline btn-sm icon-btn-mobile';
    btn.innerHTML = `<i class="bi bi-cart3"></i> <span>Canasta</span> <span id="pos-badge" class="badge badge-gold" style="margin-left:6px;border-radius:99px;padding:2px 8px;">0</span>`;
    btn.onclick = window.togglePosCart;
    actions.prepend(btn);
  }
  
  window.getPosCart = () => JSON.parse(localStorage.getItem('posCart')||'[]');
  window.savePosCart = (cart) => { localStorage.setItem('posCart', JSON.stringify(cart)); window.renderPosCart(); };
  
  window.nextPosClient = () => {
    let currentId = parseInt(localStorage.getItem('posClientId') || '1');
    const cart = window.getPosCart();
    
    // Prevent incrementing if the current client is empty
    const hasItems = cart.some(item => (item.cartClientId || 1) === currentId);
    if (!hasItems && cart.length > 0) {
      if(window.toast) window.toast('El cliente actual está vacío. Añade perfumes primero.', 'warning');
      return;
    }
    
    // Jump to max existing client + 1 (not current + 1)
    const maxCid = cart.reduce((max, item) => Math.max(max, item.cartClientId || 1), 0);
    const newId = Math.max(maxCid, currentId) + 1;
    localStorage.setItem('posClientId', newId);
    if(window.toast) window.toast(`Cliente ${newId} listo`, 'success');
    else if(window.showToast) window.showToast(`Cliente ${newId} listo`, 'success');
    window.renderPosCart();
  };

  window.setActivePosClient = (cid) => {
    localStorage.setItem('posClientId', cid);
    window.renderPosCart();
  };
  
  window.renamePosClient = (cid) => {
    const names = JSON.parse(localStorage.getItem('posClientNames')||'{}');
    const currentName = names[cid] || `Cliente ${cid}`;
    const newName = prompt('Nombre del cliente:', currentName);
    if (newName !== null && newName.trim() !== '') {
      names[cid] = newName.trim();
      localStorage.setItem('posClientNames', JSON.stringify(names));
      window.renderPosCart();
    }
  };

  window.addToPosCart = (item) => {
    const cart = window.getPosCart();
    if (cart.length === 0) localStorage.setItem('posClientId', '1');
    item.cartClientId = parseInt(localStorage.getItem('posClientId') || '1');
    cart.push(item);
    window.savePosCart(cart);
    if(window.toast) window.toast('Agregado a la canasta', 'success');
    else if(window.showToast) window.showToast('Agregado a la canasta', 'success');
  };

  window.removeFromPosCart = (idx) => {
    const cart = window.getPosCart();
    cart.splice(idx,1);
    if (cart.length === 0) localStorage.setItem('posClientId', '1');
    window.savePosCart(cart);
  };
  
  window.updatePosCartCant = (idx, delta) => {
    const cart = window.getPosCart();
    if(cart[idx]) {
      cart[idx].cant += delta;
      if(cart[idx].cant < 1) cart[idx].cant = 1;
      window.savePosCart(cart);
    }
  };

  window.clearPosCart = async () => {
    const res = await Swal.fire({
      title: '¿Limpiar canasta?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });
    if(res.isConfirmed) {
      localStorage.setItem('posClientId', '1');
      localStorage.removeItem('posClientNames');
      window.savePosCart([]);
    }
  };
  
  window.renderPosCart = () => {
    const cart = window.getPosCart();
    const badge = document.getElementById('pos-badge');
    if(badge) badge.textContent = cart.length;
    const container = document.getElementById('pos-items');
    if(!container) return;
    
    if(cart.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:60px 10px;text-align:center;color:var(--text-faint);"><i class="bi bi-bag-x" style="font-size:48px;opacity:0.5;margin-bottom:16px;display:block;"></i><p style="font-size:16px;color:var(--text-muted)">Tu canasta está vacía</p></div>`;
      document.getElementById('pos-total').textContent = '$0 MXN';
      return;
    }

    container.innerHTML = '';
    let total = 0;
    
    // Agrupar por cartClientId
    const groups = {};
    cart.forEach((item, idx) => {
      // Auto-reparar carrito corrupto
      item.cant = Number(item.cant) || 1;
      item.precio = Number(item.precio) || 0;
      
      total += item.precio * item.cant;
      const cid = item.cartClientId || 1;
      if (!groups[cid]) groups[cid] = { total: 0, count: 0, itemsHtml: '' };
      groups[cid].total += item.precio * item.cant;
      groups[cid].count += item.cant;
      
      groups[cid].itemsHtml += `
        <div style="display:flex;gap:12px;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;align-items:center;margin-bottom:8px;">
          <img src="${item.imagen || '../assets/img/placeholder.png'}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;background:var(--bg-card2);flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;color:var(--text-primary);line-height:1.2">${item.nombre}</div>
            <div style="font-size:12px;color:var(--text-muted);">${(item.ml === 'Resto' || item.ml === 'Completo') ? item.ml : item.ml + 'ml'} — <span style="font-weight:700;color:var(--text-primary);">$${item.precio}</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <button class="btn-icon" style="color:#ef4444;border:1px solid var(--border);border-radius:6px;background:none;width:30px;height:30px;display:flex;justify-content:center;align-items:center;" onclick="removeFromPosCart(${idx})"><i class="bi bi-trash" style="font-size:14px;"></i></button>
            <div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:var(--bg-card2);height:30px;">
              <button style="border:none;background:none;padding:0 8px;color:var(--text-muted);cursor:pointer;height:100%;font-size:14px;" onclick="updatePosCartCant(${idx}, -1)">-</button>
              <div style="font-size:13px;font-weight:600;min-width:16px;text-align:center;color:var(--text-primary);">${item.cant}</div>
              <button style="border:none;background:none;padding:0 8px;color:var(--text-muted);cursor:pointer;height:100%;font-size:14px;" onclick="updatePosCartCant(${idx}, 1)">+</button>
            </div>
          </div>
        </div>`;
    });
    
    // Asegurar que el cliente actual esté visible, incluso si está vacío
    const currentCid = parseInt(localStorage.getItem('posClientId') || '1');
    if (!groups[currentCid]) {
      groups[currentCid] = { total: 0, count: 0, itemsHtml: `<div style="font-size:12px;color:var(--text-faint);font-style:italic;text-align:center;padding:10px 0;">Agrega perfumes para este cliente...</div>` };
    }
    
    const names = JSON.parse(localStorage.getItem('posClientNames')||'{}');
    
    // Renderizar grupos
    Object.keys(groups).sort((a,b)=>a-b).forEach(cid => {
      const g = groups[cid];
      const isActive = parseInt(cid) === currentCid;
      const clientName = names[cid] || `Cliente ${cid}`;
      
      container.innerHTML += `
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px; border-radius:8px; cursor:${isActive ? 'default' : 'pointer'}; background:${isActive ? 'rgba(201,168,76,0.1)' : 'transparent'}; transition:all 0.2s;" ${!isActive ? `onclick="setActivePosClient(${cid})"` : ''} title="${!isActive ? 'Click para agregar a este cliente' : ''}">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary); cursor:pointer;" onclick="event.stopPropagation(); window.renamePosClient(${cid})" title="Click para renombrar">👤 ${clientName} <i class="bi bi-pencil-fill" style="font-size:10px;color:var(--text-muted);margin-left:4px;"></i> ${isActive ? '<span class="badge badge-gold" style="font-size:10px;margin-left:6px;border-radius:4px;padding:2px 6px;">Actual</span>' : ''} <span style="font-size:12px;color:var(--text-muted);font-weight:normal;margin-left:4px;">(${g.count} art.)</span></div>
            <div style="font-size:14px;font-weight:700;color:var(--gold);">$${g.total}</div>
          </div>
          ${g.itemsHtml}
        </div>
      `;
    });

    container.innerHTML += `
      <button class="btn btn-outline" style="width:100%;justify-content:center;border-style:dashed;color:var(--text-muted);border-color:var(--border);" onclick="nextPosClient()">
        <i class="bi bi-person-plus"></i> Siguiente Cliente (Separador)
      </button>
    `;
    
    document.getElementById('pos-total').textContent = `$${total} MXN`;
  };
  
  window.renderPosCart();
}

// Inyectar la UI asegurando que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectCanastaUI);
} else {
  injectCanastaUI();
}
