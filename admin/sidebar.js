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
      <li><a href="./perfumes.html"   class="${active==='perfumes'   ?'active':''}" ><i class="bi bi-droplet"></i> Perfumes</a></li>
      <li><a href="./marcas.html"     class="${active==='marcas'     ?'active':''}" ><i class="bi bi-bookmark"></i> Marcas</a></li>
      <li><a href="./categorias.html" class="${active==='categorias' ?'active':''}" ><i class="bi bi-tag"></i> Categorias</a></li>
      <li><a href="./notas.html"      class="${active==='notas'      ?'active':''}" ><i class="bi bi-flower1"></i> Notas Olfativas</a></li>
      <li><a href="./pedidos.html"    class="${active==='pedidos'    ?'active':''}" ><i class="bi bi-bag"></i> Pedidos</a></li>
      <li><a href="./ventas.html"     class="${active==='ventas'     ?'active':''}" ><i class="bi bi-cash-stack"></i> Ventas</a></li>
      <li><a href="./novedades.html"  class="${active==='novedades'  ?'active':''}" ><i class="bi bi-stars"></i> Novedades</a></li>
      <li class="sidebar-divider"></li>
      <li class="sidebar-section-label">Botellas Completas</li>
      <li><a href="./perfumes-completos.html" class="${active==='perfumes-completos' ?'active':''}" ><i class="bi bi-bag-heart"></i> Catálogo Completos</a></li>
      <li><a href="./encargos.html"           class="${active==='encargos'           ?'active':''}" ><i class="bi bi-clock-history"></i> Encargos</a></li>
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

// ── POS (Canasta) UI Injection ──────────────────────────────────────────────
function injectCanastaUI() {
  if (document.getElementById('pos-drawer')) return; // Avoid duplicate injection

  const drawerHTML = `
  <div class="pos-overlay" id="pos-overlay" onclick="togglePosCart()"></div>
  <div class="pos-drawer" id="pos-drawer" style="background:var(--bg); color:var(--text);">
    <div style="border-bottom:1px solid var(--border);padding:20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <h4 style="font-size:18px;margin:0;font-weight:700;display:flex;align-items:center;gap:10px;"><i class="bi bi-bag"></i> Tu pedido</h4>
      <button class="btn-icon" style="background:var(--card2);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--muted);border:none;" onclick="togglePosCart()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div id="pos-items" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;"></div>
    <div style="padding:20px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:16px;flex-shrink:0;background:var(--bg);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:4px;">Total estimado</div>
          <div style="font-size:11px;color:var(--faint);">* Precios sujetos a confirmación</div>
        </div>
        <span id="pos-total" style="color:var(--gold);font-size:20px;font-weight:800;">$0 MXN</span>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:14px;font-size:16px;font-weight:600;border-radius:12px;background:var(--gold);border-color:var(--gold);color:#000;" onclick="window.location.href='./ventas.html?openS=1'"><i class="bi bi-card-checklist"></i> Ir a registrar pedido</button>
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
    btn.className = 'btn btn-outline btn-sm';
    btn.innerHTML = `<i class="bi bi-cart3"></i> Canasta <span id="pos-badge" class="badge badge-gold" style="margin-left:6px;border-radius:99px;padding:2px 8px;">0</span>`;
    btn.onclick = window.togglePosCart;
    actions.prepend(btn);
  }
  
  window.getPosCart = () => JSON.parse(localStorage.getItem('posCart')||'[]');
  window.savePosCart = (cart) => { localStorage.setItem('posCart', JSON.stringify(cart)); window.renderPosCart(); };
  
  window.addToPosCart = (item) => {
    const cart = window.getPosCart();
    cart.push(item);
    window.savePosCart(cart);
    if(window.showToast) window.showToast('Agregado a la canasta', 'success');
  };
  
  window.removeFromPosCart = (idx) => {
    const cart = window.getPosCart();
    cart.splice(idx,1);
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

  window.clearPosCart = () => {
    if(confirm('¿Seguro que deseas limpiar la canasta?')) {
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
      container.innerHTML = `<div class="empty-state" style="padding:60px 10px;text-align:center;color:var(--faint);"><i class="bi bi-bag-x" style="font-size:48px;opacity:0.5;margin-bottom:16px;display:block;"></i><p style="font-size:16px;color:var(--muted)">Tu canasta está vacía</p></div>`;
      document.getElementById('pos-total').textContent = '$0 MXN';
      return;
    }

    container.innerHTML = '';
    let total = 0;
    cart.forEach((item, idx) => {
      total += Number(item.precio) * Number(item.cant);
      container.innerHTML += `
        <div style="display:flex;gap:16px;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:12px;align-items:center;">
          <img src="${item.imagen || '../assets/img/placeholder.png'}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;background:var(--card2);flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${item.marca || 'Marca'}</div>
            <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;color:var(--text);line-height:1.2">${item.nombre}</div>
            <div style="font-size:13px;color:var(--muted);">${item.ml}ml — <span style="font-weight:700;color:var(--text);">$${item.precio}</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
            <button class="btn-icon" style="color:#ef4444;border:1px solid var(--border);border-radius:8px;background:none;width:36px;height:36px;display:flex;justify-content:center;align-items:center;transition:all 0.2s;" onclick="removeFromPosCart(${idx})"><i class="bi bi-trash"></i></button>
            <div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--card2);height:36px;">
              <button style="border:none;background:none;padding:0 12px;color:var(--muted);cursor:pointer;height:100%;font-size:16px;" onclick="updatePosCartCant(${idx}, -1)">-</button>
              <div style="font-size:14px;font-weight:600;min-width:20px;text-align:center;color:var(--text);">${item.cant}</div>
              <button style="border:none;background:none;padding:0 12px;color:var(--muted);cursor:pointer;height:100%;font-size:16px;" onclick="updatePosCartCant(${idx}, 1)">+</button>
            </div>
          </div>
        </div>`;
    });
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
