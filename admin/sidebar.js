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
      <li><a href="./dashboard.html" class="${active==='dashboard'?'active':''}" ><i class="bi bi-grid"></i> Dashboard</a></li>
      <li><a href="./perfumes.html"  class="${active==='perfumes'?'active':'' }" ><i class="bi bi-droplet"></i> Perfumes</a></li>
      <li><a href="./marcas.html"    class="${active==='marcas'?'active':''   }" ><i class="bi bi-bookmark"></i> Marcas</a></li>
      <li><a href="./categorias.html" class="${active==='categorias'?'active':''}"><i class="bi bi-tag"></i> Categorias</a></li>
      <li><a href="./pedidos.html"   class="${active==='pedidos'?'active':''  }" ><i class="bi bi-bag"></i> Pedidos</a></li>
      <li><a href="./ventas.html"    class="${active==='ventas'?'active':''   }" ><i class="bi bi-cash-stack"></i> Ventas</a></li>
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
  sb.classList.toggle('open');
  if (ov) ov.classList.toggle('open');
};

window.closeSidebar = () => {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
};
