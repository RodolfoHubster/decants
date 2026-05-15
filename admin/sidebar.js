import { auth, signOut, onAuthStateChanged } from '../assets/js/firebase-config.js';

const nav = [
  { id:'dashboard', label:'Dashboard',  icon:'bi-speedometer2',  href:'dashboard.html' },
  { id:'perfumes',  label:'Perfumes',   icon:'bi-droplet-fill',  href:'perfumes.html' },
  { id:'categorias',label:'Categorias', icon:'bi-tags-fill',     href:'categorias.html' },
  { id:'marcas',    label:'Marcas',     icon:'bi-award-fill',    href:'marcas.html' },
  { id:'ventas',    label:'Ventas',     icon:'bi-receipt',       href:'ventas.html' },
  { id:'pedidos',   label:'Pedidos',    icon:'bi-box-seam-fill', href:'pedidos.html' },
];

export function renderSidebar(active){
  const wrap = document.getElementById('sidebar-wrap');
  if(!wrap) return;
  const links = nav.map(n=>`
    <a href="${n.href}" class="nav-item ${n.id===active?'active':''}">
      <i class="bi ${n.icon}"></i> ${n.label}
    </a>`).join('');
  wrap.innerHTML=`
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-mark">FS</div>
        <div><div class="logo-text">Fitoscents</div><div class="logo-sub">Panel Admin</div></div>
      </div>
      <div class="nav-section">Menu</div>
      ${links}
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="avatar"><i class="bi bi-person"></i></div>
          <div><div class="user-name" id="user-email">Admin</div>
          <div class="user-role">Administrador</div></div>
          <button class="btn-icon" id="btn-logout" title="Salir" style="margin-left:auto">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </aside>`;
  onAuthStateChanged(auth, u=>{ if(u) document.getElementById('user-email').textContent=u.email.split('@')[0]; });
  document.getElementById('btn-logout').onclick = async()=>{ await signOut(auth); window.location.href='../login.html'; };
  window.toggleSidebar = ()=>document.getElementById('sidebar').classList.toggle('open');
}
