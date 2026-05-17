import { db, collection, getDocs, query, where } from '../../assets/js/firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import '../../admin/auth-guard.js';

renderSidebar('dashboard');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

async function loadStats() {
  const [p, m, c, pv, v, ped] = await Promise.all([
    getDocs(collection(db, 'perfumes')),
    getDocs(collection(db, 'marcas')),
    getDocs(collection(db, 'categorias')),
    getDocs(query(collection(db, 'perfumes'), where('activo', '==', true))),
    getDocs(collection(db, 'ventas')),
    getDocs(collection(db, 'pedidos')),
  ]);

  document.getElementById('s-perf').textContent = p.size;
  document.getElementById('s-marc').textContent = m.size;
  document.getElementById('s-cat').textContent = c.size;
  document.getElementById('s-vis').textContent = pv.size;

  let totalVentas = 0, ventasPend = 0, ventasCount = 0;
  v.forEach(d => {
    const vd = d.data();
    if(vd.estado !== 'cancelada') {
      totalVentas += (+vd.precio||0) * (+vd.cantidad||1);
      ventasCount++;
    }
    if(vd.estado === 'pendiente') ventasPend++;
  });
  document.getElementById('s-ventas').textContent = ventasCount;
  document.getElementById('s-total').textContent = '$' + totalVentas.toLocaleString('es-MX',{minimumFractionDigits:0});
  document.getElementById('s-pend').textContent = ventasPend;

  let pedNuevos = 0;
  ped.forEach(d => { if(d.data().estado === 'nuevo') pedNuevos++; });
  document.getElementById('s-ped').textContent = pedNuevos;
}
loadStats();