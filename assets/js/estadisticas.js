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
    
    let marcasSet = new Set();
    perfumes = []; ps.forEach(d => {
      const p = { id: d.id, ...d.data() };
      perfumes.push(p);
      if (p.marca) marcasSet.add(p.marca);
    });
    
    const marcaSel = document.getElementById('f-marca');
    if (marcaSel) {
      marcaSel.innerHTML = '<option value="">Todas las marcas</option>' + 
        Array.from(marcasSet).sort().map(m => `<option value="${m}">${m}</option>`).join('');
    }
    
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

window.currentPageStats = 1;
const pageSizeStats = 20;

window.renderTable = () => renderProfitability();

function renderProfitability() {
  const tbody = document.getElementById('profit-tbody');
  const q = (document.getElementById('f-search')?.value || '').toLowerCase();
  const qMarca = (document.getElementById('f-marca')?.value || '');
  
  // Costo base por preparar un decant
  const costoInsumoUnitario = (+costosOp.botella || 0) + (+costosOp.etiqueta || 0) + (+costosOp.bolsa || 0);
  
  let results = [];
  
  perfumes.forEach(p => {
    // Filtrar
    if (q && !p.nombre.toLowerCase().includes(q) && !(p.marca||'').toLowerCase().includes(q)) return;
    if (qMarca && p.marca !== qMarca) return;
    
    // Si no tiene lotes, generar uno temporal basado en legacy (por si no se migró aún)
    const lotes = p.lotes && p.lotes.length > 0 ? p.lotes : [];
    if (lotes.length === 0 && p.costoBotella && p.tamanoBotella) {
      lotes.push({ id: 'lote-1', fecha: p.creadoEn || Date.now(), costo: +p.costoBotella, tamano: +p.tamanoBotella });
    }
    if (lotes.length === 0) return; // Si de plano no tiene inventario, ignorar
    
    // Historial global del perfume (ventas directas)
    const hist = ventas.filter(v => v.perfumeId === p.id);
    
    // Inyectar ventas de paquetes que contengan este perfume
    ventas.forEach(v => {
      if (v.paqueteItems && Array.isArray(v.paqueteItems)) {
        const subItem = v.paqueteItems.find(i => i.id === p.id);
        if (subItem) {
          let ml = 0;
          if (v.talla.startsWith('Paquete ')) ml = parseInt(v.talla.replace('Paquete ', ''));
          else ml = parseInt(v.talla);
          
          if (!isNaN(ml) && ml > 0) {
            const vClone = { ...v, talla: String(ml), loteId: subItem.loteId || 'lote-1' };
            vClone.precio = (+v.precio || 0) / v.paqueteItems.length;
            hist.push(vClone);
          }
        }
      }
    });
    
    let sumGanancia = 0;
    let sumIngreso = 0;
    let sumCostoBotella = 0;
    let sumCostoInsumos = 0;
    let loteResults = [];
    
    lotes.forEach((l, idx) => {
      // Filtrar historial específico para este lote
      // Si la venta no tiene loteId, asumimos que es del lote-1 (o el primero de la lista)
      const isFirst = idx === 0;
      const loteHist = hist.filter(v => v.loteId === l.id || (isFirst && !v.loteId));
      
      let totalMlVendidos = 0;
      let totalDecantsVendidos = 0;
      let ingresoReal = 0;
      const distribucion = { '2':0, '3':0, '5':0, '10':0 };
      
      loteHist.forEach(v => {
        // Ignorar "Completo" y "Otro" en estas métricas
        if (['2','3','5','10'].includes(v.talla)) {
          const c = +v.cantidad || 1;
          distribucion[v.talla] += c;
          totalMlVendidos += (parseInt(v.talla) * c);
          totalDecantsVendidos += c;
          ingresoReal += (+v.precio || 0) * c;
        }
      });
      
      const costoBotella = parseFloat(l.costo) || 0;
      const tamanoBotella = parseFloat(l.tamano) || 100;
      const progresoPorcentaje = tamanoBotella > 0 ? Math.min(100, Math.round((totalMlVendidos / tamanoBotella) * 100)) : 0;
      
      const costoInsumosReal = totalDecantsVendidos * costoInsumoUnitario;
      const costoInversionReal = costoBotella + costoInsumosReal;
      const gananciaReal = ingresoReal - costoInversionReal;
      
      let totalDecantsProyectados = 0;
      let ingresoTotalProyectado = 0;
      
      if (totalMlVendidos > 0) {
        const factor = tamanoBotella / totalMlVendidos;
        ['2','3','5','10'].forEach(talla => {
          const cant = distribucion[talla] * factor;
          totalDecantsProyectados += cant;
          ingresoTotalProyectado += cant * (+p.precios[talla] || 0);
        });
      } else {
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
      const gananciaNetaFinal = ingresoTotalProyectado - (costoBotella + costoTotalInsumos);
      
      sumGanancia += gananciaReal; // Ordenar y totalizar usando la ganancia REAL
      sumIngreso += ingresoReal;
      sumCostoBotella += costoInversionReal;
      sumCostoInsumos += gananciaNetaFinal; // Usamos esto para la proyección final
      
      loteResults.push({
        id: l.id,
        nombre: `Botella #${idx+1} (${new Date(l.fecha).toLocaleDateString('es-MX')})`,
        progresoTexto: `${totalMlVendidos} / ${tamanoBotella}ml`,
        progresoPorcentaje,
        costoInversionReal,
        ingresoReal,
        gananciaReal,
        gananciaNetaFinal
      });
    });
    
    results.push({
      pid: p.id,
      nombre: p.nombre,
      marca: p.marca || '',
      sumGanancia,
      sumIngreso,
      sumCostoBotella,
      sumCostoInsumos,
      lotes: loteResults
    });
  });
  
  // -- Lógica para Perfumes Eliminados / Huérfanos --
  const activePerfumeIds = new Set(perfumes.map(p => p.id));
  let orphans = {};
  
  ventas.forEach(v => {
    if (v.paqueteItems && Array.isArray(v.paqueteItems)) {
      v.paqueteItems.forEach(subItem => {
        if (!activePerfumeIds.has(subItem.id)) {
          const name = subItem.nombre || v.perfumeNombre || 'Desconocido';
          if (!orphans[name]) orphans[name] = 0;
          orphans[name] += ((+v.precio || 0) / v.paqueteItems.length) * (+v.cantidad || 1);
        }
      });
    } else {
      if (['2','3','5','10'].includes(v.talla) && !activePerfumeIds.has(v.perfumeId)) {
        const name = v.perfumeNombre || 'Desconocido';
        if (!orphans[name]) orphans[name] = 0;
        orphans[name] += (+v.precio || 0) * (+v.cantidad || 1);
      }
    }
  });

  for (const [nombre, ingreso] of Object.entries(orphans)) {
    if (ingreso > 0.5) {
      results.push({
        pid: 'eliminado-' + nombre.replace(/\s+/g, '-'),
        nombre: '🗑️ ' + nombre,
        marca: 'Perfume Eliminado',
        sumGanancia: ingreso,
        sumIngreso: ingreso,
        sumCostoBotella: 0,
        sumCostoInsumos: ingreso,
        lotes: [{
          id: 'lote-eliminados',
          nombre: 'Historial',
          progresoTexto: '---',
          progresoPorcentaje: 0,
          costoInversionReal: 0,
          ingresoReal: ingreso,
          gananciaReal: ingreso,
          gananciaNetaFinal: ingreso
        }]
      });
    }
  }
  
  const sortVal = document.getElementById('f-sort')?.value || 'margin-desc';
  results.sort((a,b) => {
    if (sortVal === 'margin-desc') return b.sumGanancia - a.sumGanancia;
    if (sortVal === 'margin-asc') return a.sumGanancia - b.sumGanancia;
    if (sortVal === 'revenue-desc') return b.sumIngreso - a.sumIngreso;
    return b.sumGanancia - a.sumGanancia;
  });
  
  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / pageSizeStats) || 1;
  if(window.currentPageStats > totalPages) window.currentPageStats = totalPages;
  const start = (window.currentPageStats - 1) * pageSizeStats;
  const end = Math.min(start + pageSizeStats, totalItems);
  const paginated = results.slice(start, end);
  
  const pInfo = document.getElementById('pagination-info');
  if (pInfo) pInfo.textContent = totalItems === 0 ? 'Mostrando 0 - 0 de 0' : `Mostrando ${start+1} - ${end} de ${totalItems}`;
  
  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-faint)">No hay resultados.</td></tr>';
    renderStatsPagination(0, 1);
    return;
  }
  
  tbody.innerHTML = paginated.map(r => {
    const isProfit = r.sumGanancia >= 0;
    const hasLotes = r.lotes.length > 0;
    
    let html = `
      <tr style="cursor:${hasLotes?'pointer':'default'}" onclick="window.toggleLotes('${r.pid}')">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            ${hasLotes ? `<i class="bi bi-chevron-right" id="icon-${r.pid}" style="transition:0.2s"></i>` : ''}
            <strong>${r.nombre}</strong> <span style="font-size:11px;color:var(--text-faint)">${r.marca}</span>
          </div>
        </td>
        <td><span style="font-size:12px;color:var(--text-muted)">${r.lotes.length} botella(s)</span></td>
        <td class="text-right">${r.sumCostoBotella.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right" style="color:var(--text-faint)">${r.sumIngreso.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right">
          <span class="${isProfit ? 'badge-profit' : 'badge-loss'}">
            ${r.sumGanancia.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
          </span>
        </td>
        <td class="text-right" style="color:var(--text-faint)">
          ${r.sumCostoInsumos.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
        </td>
      </tr>
    `;
    
    if (hasLotes) {
      r.lotes.forEach(l => {
        const isLProfit = l.gananciaReal >= 0;
        const colorProgreso = l.progresoPorcentaje >= 100 ? '#ef4444' : 'var(--accent)';
        html += `
          <tr class="lotes-row-${r.pid}" style="display:none; background:var(--bg-card2)">
            <td style="padding-left:35px; border-left:3px solid var(--accent)">↳ ${l.nombre}</td>
            <td>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">${l.progresoTexto}</div>
              <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;width:100%;max-width:120px;overflow:hidden">
                <div style="height:100%;width:${l.progresoPorcentaje}%;background:${colorProgreso}"></div>
              </div>
            </td>
            <td class="text-right">${l.costoInversionReal.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
            <td class="text-right" style="color:var(--text-faint)">${l.ingresoReal.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
            <td class="text-right">
              <span class="${isLProfit ? 'badge-profit' : 'badge-loss'}" style="font-size:11px">
                ${l.gananciaReal.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
              </span>
            </td>
            <td class="text-right" style="color:var(--text-faint)">${l.gananciaNetaFinal.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
          </tr>
        `;
      });
    }
    
    return html;
  }).join('');
  
  renderStatsPagination(totalItems, totalPages);
}

window.toggleLotes = (pid) => {
  const rows = document.querySelectorAll(`.lotes-row-${pid}`);
  const icon = document.getElementById(`icon-${pid}`);
  let isHidden = true;
  rows.forEach(r => {
    if (r.style.display === 'none') {
      r.style.display = 'table-row';
      isHidden = false;
    } else {
      r.style.display = 'none';
    }
  });
  if (icon) icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
};

function renderStatsPagination(totalItems, totalPages) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  
  let html = '';
  html += `<button class="btn btn-outline btn-sm" ${window.currentPageStats===1?'disabled':''} onclick="window.currentPageStats--; window.renderTable()">Anterior</button>`;
  html += `<span style="font-size:13px; padding:0 10px; line-height:30px;">Página ${window.currentPageStats} de ${totalPages}</span>`;
  html += `<button class="btn btn-outline btn-sm" ${window.currentPageStats===totalPages?'disabled':''} onclick="window.currentPageStats++; window.renderTable()">Siguiente</button>`;
  
  container.innerHTML = html;
}
