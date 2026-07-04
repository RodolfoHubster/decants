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
  document.getElementById('s-cat').textContent  = c.size;
  document.getElementById('s-vis').textContent  = pv.size;

  // ── Perfumes sin precio (activos pero todos los precios en 0) ─────────────
  let sinPrecio = 0;
  p.forEach(d => {
    const pd = d.data();
    if (pd.activo === false) return;
    const precios = pd.precios || {};
    const tieneAlguno = Object.values(precios).some(val => +val > 0);
    if (!tieneAlguno) sinPrecio++;
  });
  const alerta = document.getElementById('s-sin-precio');
  if (alerta) {
    alerta.textContent = sinPrecio;
    const card = alerta.closest('.stat-card');
    if (card) card.style.borderColor = sinPrecio > 0 ? 'var(--danger)' : '';
  }

  let totalVentas = 0, ventasPend = 0, ventasCount = 0;
  const ventasDecants = {};
  const ventasCompletos = {};

  v.forEach(d => {
    const vd = d.data();
    if (vd.estado !== 'cancelada') {
      totalVentas += (+vd.precio||0) * (+vd.cantidad||1);
      ventasCount++;
      const nombre = vd.perfumeNombre || 'Sin nombre';
      
      const isCompleto = vd.talla === 'Completo';
      const targetObj = isCompleto ? ventasCompletos : ventasDecants;

      if (!targetObj[nombre]) targetObj[nombre] = { unidades: 0, total: 0 };
      targetObj[nombre].unidades += (+vd.cantidad||1);
      targetObj[nombre].total += (+vd.precio||0)*(+vd.cantidad||1);
    }
    if (vd.estado === 'pendiente') ventasPend++;
  });
  
  document.getElementById('s-ventas').textContent = ventasCount;
  document.getElementById('s-total').textContent = '$' + totalVentas.toLocaleString('es-MX',{minimumFractionDigits:0});
  document.getElementById('s-pend').textContent = ventasPend;

  let pedNuevos = 0;
  ped.forEach(d => { if(d.data().estado === 'nuevo') pedNuevos++; });
  document.getElementById('s-ped').textContent = pedNuevos;

  // ── Top 5 Helper ────────────────────────────────────────────────────────
  const renderTop5 = (dataObj, elId) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const sorted = Object.entries(dataObj)
      .sort((a,b) => b[1].unidades - a[1].unidades)
      .slice(0,5);
    if (!sorted.length) {
      el.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-faint);padding:16px">Sin ventas aún</td></tr>';
    } else {
      el.innerHTML = sorted.map(([nombre, data], i) => `
        <tr>
          <td><span style="font-weight:600;color:var(--accent)">#${i+1}</span></td>
          <td><strong>${nombre}</strong></td>
          <td style="text-align:right">
            <span style="font-size:13px;color:var(--text-muted)">${data.unidades} uds</span>
            <span style="margin-left:8px;font-weight:600">${data.total.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</span>
          </td>
        </tr>`).join('');
    }
  };

  renderTop5(ventasDecants, 'top5-decants-body');
  renderTop5(ventasCompletos, 'top5-completos-body');
}
loadStats();
