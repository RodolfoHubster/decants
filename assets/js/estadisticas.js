import { db, collection, getDocs, doc, getDoc, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';

let ventas = [];
let perfumes = [];
let costosOp = { botella: 0, etiqueta: 0, bolsa: 0 };
let chartTallasObj = null;
let chartTopObj = null;

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('estadisticas');
  onAuthStateChanged(auth, (user) => {
    if (user) window.loadData();
  });
});

window.loadData = async () => {
  const btn = document.querySelector('.btn-outline');
  if(btn) btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Cargando...';
  
  try {
    const [vs, ps, confSnap] = await Promise.all([
      getDocs(collection(db, 'ventas')),
      getDocs(collection(db, 'perfumes')),
      getDoc(doc(db, 'config', 'costosOperativos')).catch(() => null)
    ]);
    
    ventas = []; vs.forEach(d => {
      const data = d.data();
      if (data.estado !== 'cancelada') ventas.push({ id: d.id, ...data });
    });
    perfumes = []; ps.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
    
    if (confSnap && confSnap.exists()) {
      costosOp = confSnap.data();
    }
    
    renderKPIs();
    renderCharts();
    renderProfitability();
  } catch(e) {
    console.error("Error loading stats:", e);
  } finally {
    if(btn) btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Actualizar';
  }
};

function renderKPIs() {
  let ingresos = 0;
  let decants = 0;
  let ml = 0;
  
  ventas.forEach(v => {
    const cant = +v.cantidad || 1;
    const precio = +v.precio || 0;
    
    if (v.talla !== 'Completo' && v.talla !== 'Otro') {
      const t = parseFloat(v.talla) || 0;
      decants += cant;
      ml += (t * cant);
    }
    ingresos += (precio * cant);
  });
  
  document.getElementById('kpi-ingresos').textContent = ingresos.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  document.getElementById('kpi-decants').textContent = decants.toLocaleString();
  document.getElementById('kpi-ml').textContent = ml.toLocaleString() + ' ml';
}

function renderCharts() {
  // 1. Distribución de Tallas
  const tallasCount = { '2':0, '3':0, '5':0, '10':0 };
  ventas.forEach(v => {
    if (v.talla === '2' || v.talla === '3' || v.talla === '5' || v.talla === '10') {
      tallasCount[v.talla] += (+v.cantidad || 1);
    }
  });
  
  const ctxTallas = document.getElementById('chartTallas');
  if (chartTallasObj) chartTallasObj.destroy();
  chartTallasObj = new Chart(ctxTallas, {
    type: 'doughnut',
    data: {
      labels: ['2ml', '3ml', '5ml', '10ml'],
      datasets: [{
        data: [tallasCount['2'], tallasCount['3'], tallasCount['5'], tallasCount['10']],
        backgroundColor: ['#a36c4f', '#7a4fa3', '#4f98a3', '#C9A84C'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ccc' } }
      }
    }
  });

  // 2. Top Perfumes
  const pCount = {};
  ventas.forEach(v => {
    if (!v.perfumeId || v.perfumeId === 'custom') return;
    if (!pCount[v.perfumeId]) pCount[v.perfumeId] = { nombre: v.perfumeNombre || 'Desconocido', count: 0 };
    pCount[v.perfumeId].count += (+v.cantidad || 1);
  });
  
  const topList = Object.values(pCount).sort((a,b) => b.count - a.count).slice(0, 5);
  
  const ctxTop = document.getElementById('chartTop');
  if (chartTopObj) chartTopObj.destroy();
  chartTopObj = new Chart(ctxTop, {
    type: 'bar',
    data: {
      labels: topList.map(x => x.nombre.substring(0, 15) + (x.nombre.length > 15 ? '...' : '')),
      datasets: [{
        label: 'Decants Vendidos',
        data: topList.map(x => x.count),
        backgroundColor: '#4f98a3',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { ticks: { color: '#888' }, grid: { color: '#333' } },
        x: { ticks: { color: '#888' }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderProfitability() {
  const tbody = document.getElementById('profit-tbody');
  
  // Costo base por preparar un decant
  const costoInsumoUnitario = (+costosOp.botella || 0) + (+costosOp.etiqueta || 0) + (+costosOp.bolsa || 0);
  
  const results = [];
  
  perfumes.forEach(p => {
    if (!p.costoBotella || !p.tamanoBotella) return;
    const costoBotella = parseFloat(p.costoBotella);
    const tamanoBotella = parseFloat(p.tamanoBotella); // ml total
    if (isNaN(costoBotella) || isNaN(tamanoBotella) || tamanoBotella <= 0) return;
    
    // Obtener historial real de ventas para ESTE perfume
    const hist = ventas.filter(v => v.perfumeId === p.id);
    let totalMlVendidos = 0;
    const distribucion = { '2':0, '3':0, '5':0, '10':0 };
    
    hist.forEach(v => {
      const c = +v.cantidad || 1;
      if (['2','3','5','10'].includes(v.talla)) {
        distribucion[v.talla] += c;
        totalMlVendidos += (parseInt(v.talla) * c);
      }
    });
    
    let distStr = 'Sin ventas aún (Usa dist. global)';
    let dist = { ...distribucion };
    let totalDecantsProyectados = 0;
    let ingresoTotalProyectado = 0;
    
    if (totalMlVendidos > 0) {
      // Usar distribución real de este perfume
      const t = dist['2'] + dist['3'] + dist['5'] + dist['10'];
      distStr = `2ml: ${Math.round(dist['2']/t*100)}%, 3ml: ${Math.round(dist['3']/t*100)}%, 5ml: ${Math.round(dist['5']/t*100)}%, 10ml: ${Math.round(dist['10']/t*100)}%`;
      
      // Proyectar para el tamaño completo de la botella
      // Cuántos decants de cada tamaño saldrían de `tamanoBotella` ml usando esta proporción?
      // Factor = tamanoBotella / totalMlVendidos
      const factor = tamanoBotella / totalMlVendidos;
      
      ['2','3','5','10'].forEach(talla => {
        const cant = dist[talla] * factor;
        totalDecantsProyectados += cant;
        ingresoTotalProyectado += cant * (+p.precios[talla] || 0);
      });
      
    } else {
      // Si no tiene ventas, simular una distribución plana 25% para todos los tamaños
      const distSim = { '2': 0.25, '3': 0.25, '5': 0.25, '10': 0.25 };
      const avgMlPerDecant = (2*0.25) + (3*0.25) + (5*0.25) + (10*0.25); // 5 ml
      totalDecantsProyectados = tamanoBotella / avgMlPerDecant;
      
      ingresoTotalProyectado = totalDecantsProyectados * (
        (0.25 * (+p.precios['2'] || 0)) +
        (0.25 * (+p.precios['3'] || 0)) +
        (0.25 * (+p.precios['5'] || 0)) +
        (0.25 * (+p.precios['10'] || 0))
      );
    }
    
    const costoTotalInsumos = totalDecantsProyectados * costoInsumoUnitario;
    const gastoTotal = costoBotella + costoTotalInsumos;
    const gananciaNeta = ingresoTotalProyectado - gastoTotal;
    
    results.push({
      nombre: p.nombre,
      distStr,
      costoBotella,
      costoTotalInsumos,
      ingresoTotalProyectado,
      gananciaNeta
    });
  });
  
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-faint)">No hay perfumes con Costo y Tamaño de Botella configurados. Configúralos en el editor de perfumes.</td></tr>';
    return;
  }
  
  results.sort((a,b) => b.gananciaNeta - a.gananciaNeta);
  
  tbody.innerHTML = results.map(r => {
    const isProfit = r.gananciaNeta >= 0;
    return `
      <tr>
        <td><strong>${r.nombre}</strong></td>
        <td><span style="font-size:12px;color:var(--text-muted)">${r.distStr}</span></td>
        <td class="text-right">${r.costoBotella.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right" style="color:var(--text-faint)">${r.costoTotalInsumos.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right">${r.ingresoTotalProyectado.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right">
          <span class="${isProfit ? 'badge-profit' : 'badge-loss'}">
            ${r.gananciaNeta.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}
