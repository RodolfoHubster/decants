import { db, collection, getDocs, doc, getDoc, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';

let ventas = [];
let ventasFiltradas = [];
let perfumes = [];
let costosOp = { botella: 0, etiqueta: 0, bolsa: 0 };
let chartTallasObj = null;
let chartTopObj = null;
let chartTendenciaObj = null;
let chartCanalesObj = null;
let chartMarcasObj = null;

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('estadisticas');
  onAuthStateChanged(auth, (user) => {
    if (user) window.loadData();
  });
});

window.loadData = async () => {
  const btn = document.getElementById('btn-actualizar-stats');
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
      const prevVal = marcaSel.value;
      marcaSel.innerHTML = '<option value="">Todas las marcas</option>' + 
        Array.from(marcasSet).sort().map(m => `<option value="${m}">${m}</option>`).join('');
      marcaSel.value = prevVal;
    }
    
    if (confSnap && confSnap.exists()) {
      costosOp = confSnap.data();
    }
    
    aplicarFiltroFecha();
  } catch(e) {
    console.error("Error loading stats:", e);
  } finally {
    if(btn) btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Actualizar';
  }
};

function aplicarFiltroFecha() {
  const periodo = document.getElementById('f-periodo-global')?.value || '30';
  const now = Date.now();
  let desde = 0;
  
  if (periodo === 'hoy') desde = new Date().setHours(0,0,0,0);
  else if (periodo === '7') desde = now - 7 * 86400000;
  else if (periodo === '30') desde = now - 30 * 86400000;
  else if (periodo === 'mes') {
    const d = new Date();
    desde = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  else if (periodo === 'anio') {
    const d = new Date();
    desde = new Date(d.getFullYear(), 0, 1).getTime();
  }
  
  if (desde > 0) {
    ventasFiltradas = ventas.filter(v => (v.creadoEn || 0) >= desde);
  } else {
    ventasFiltradas = [...ventas];
  }
  
  const label = document.getElementById('trend-label');
  if (label) {
    const pText = document.getElementById('f-periodo-global').options[document.getElementById('f-periodo-global').selectedIndex].text;
    label.textContent = `(${pText})`;
  }
  
  renderKPIs();
  renderCharts();
  renderProfitability();
  renderTopClientes();
  renderAlertasInventario();
}

function renderKPIs() {
  let ingresos = 0;
  let decants = 0;
  let ml = 0;
  let ventasUnicas = new Set();
  
  // We need to calculate costs. Since cost depends on lotes and perfumes, we can do a simplified calculation for the KPI or we can just sum from the `renderProfitability` logic.
  // Actually, the best way to get exact cost is to calculate it. For simplicity in the KPI, we calculate cost using the same logic:
  let costoTotalInversion = 0;
  const costoInsumoUnitario = (+costosOp.botella || 0) + (+costosOp.etiqueta || 0) + (+costosOp.bolsa || 0);
  
  ventasFiltradas.forEach(v => {
    const cant = +v.cantidad || 1;
    const precio = +v.precio || 0;
    
    ventasUnicas.add(v.id || Math.random()); // For ticket promedio
    
    if (v.talla !== 'Completo' && v.talla !== 'Otro') {
      let t = 0;
      if (v.paqueteItems && v.talla.startsWith('Paquete ')) {
        t = parseFloat(v.talla.replace('Paquete ', '')) || 0;
      } else {
        t = parseFloat(v.talla) || 0;
      }
      decants += cant;
      ml += (t * cant);
      
      // Calculate a rough cost for KPI. We know the cost of insumos:
      costoTotalInversion += (costoInsumoUnitario * cant);
      // For the liquid cost, we ideally need the exact lote cost. To keep it fast, we estimate it from the perfume's default cost if available.
      const p = perfumes.find(x => x.id === v.perfumeId);
      if (p) {
        // Average cost per ml from first lote or general
        let costoMl = 0;
        if (p.lotes && p.lotes.length > 0) {
          costoMl = (+p.lotes[0].costo || 0) / (+p.lotes[0].tamano || 1);
        } else if (p.costoBotella && p.tamanoBotella) {
          costoMl = (+p.costoBotella) / (+p.tamanoBotella);
        }
        costoTotalInversion += (costoMl * t * cant);
      }
    } else if (v.talla === 'Completo') {
      // For complete bottles, roughly cost is the bottle cost
      const p = perfumes.find(x => x.id === v.perfumeId);
      if (p) {
        costoTotalInversion += (+p.costoBotella || 0) * cant;
      }
    }
    
    ingresos += (precio * cant);
  });
  
  const gananciaNeta = ingresos - costoTotalInversion;
  const margen = ingresos > 0 ? (gananciaNeta / ingresos) * 100 : 0;
  const ticketPromedio = ventasUnicas.size > 0 ? ingresos / ventasUnicas.size : 0;
  
  document.getElementById('kpi-ingresos').textContent = ingresos.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  document.getElementById('kpi-ganancia').textContent = gananciaNeta.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  document.getElementById('kpi-costo').textContent = costoTotalInversion.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  document.getElementById('kpi-margen').textContent = margen.toFixed(1) + '%';
  document.getElementById('kpi-ticket').textContent = ticketPromedio.toLocaleString('es-MX', {style:'currency', currency:'MXN'});
  
  document.getElementById('kpi-decants').textContent = decants.toLocaleString();
  document.getElementById('kpi-ml').textContent = ml.toLocaleString() + ' ml';
}

function renderCharts() {
  const textColor = '#888';
  const gridColor = '#333';

  // 1. Tendencia de Ingresos
  const trendData = {};
  ventasFiltradas.forEach(v => {
    const d = new Date(v.creadoEn || 0);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!trendData[dateStr]) trendData[dateStr] = 0;
    trendData[dateStr] += (+v.precio || 0) * (+v.cantidad || 1);
  });
  
  const sortedDates = Object.keys(trendData).sort();
  const trendLabels = sortedDates.map(d => {
    const p = d.split('-');
    return `${p[2]}/${p[1]}`;
  });
  const trendValues = sortedDates.map(d => trendData[d]);

  const ctxTendencia = document.getElementById('chartTendencia');
  if (ctxTendencia) {
    if (chartTendenciaObj) chartTendenciaObj.destroy();
    chartTendenciaObj = new Chart(ctxTendencia, {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: 'Ingresos ($)',
          data: trendValues,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201, 168, 76, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#C9A84C'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: textColor }, grid: { color: gridColor } },
          x: { ticks: { color: textColor, maxTicksLimit: 10 }, grid: { display: false } }
        }
      }
    });
  }

  // 2. Canales de Venta
  const canalesCount = { 'online': 0, 'mercado': 0, 'otro': 0 };
  ventasFiltradas.forEach(v => {
    const c = v.canal || 'online';
    if (canalesCount[c] !== undefined) canalesCount[c] += (+v.precio || 0) * (+v.cantidad || 1);
  });

  const ctxCanales = document.getElementById('chartCanales');
  if (ctxCanales) {
    if (chartCanalesObj) chartCanalesObj.destroy();
    chartCanalesObj = new Chart(ctxCanales, {
      type: 'doughnut',
      data: {
        labels: ['Online / WA', 'Sobre Ruedas', 'Otro'],
        datasets: [{
          data: [canalesCount['online'], canalesCount['mercado'], canalesCount['otro']],
          backgroundColor: ['#4f98a3', '#C9A84C', '#a36c4f'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
      }
    });
  }

  // 3. Distribución de Tallas
  const tallasCount = { '2':0, '3':0, '5':0, '10':0 };
  ventasFiltradas.forEach(v => {
    if (v.talla === '2' || v.talla === '3' || v.talla === '5' || v.talla === '10') {
      tallasCount[v.talla] += (+v.cantidad || 1);
    }
  });
  
  const ctxTallas = document.getElementById('chartTallas');
  if (ctxTallas) {
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
        plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
      }
    });
  }

  // 4. Marcas Rentables (Ingresos por Marca)
  const marcasData = {};
  ventasFiltradas.forEach(v => {
    const m = v.perfumeMarca || 'Desconocida';
    if (!marcasData[m]) marcasData[m] = 0;
    marcasData[m] += (+v.precio || 0) * (+v.cantidad || 1);
  });
  const topMarcas = Object.entries(marcasData).sort((a,b) => b[1] - a[1]).slice(0, 5);

  const ctxMarcas = document.getElementById('chartMarcas');
  if (ctxMarcas) {
    if (chartMarcasObj) chartMarcasObj.destroy();
    chartMarcasObj = new Chart(ctxMarcas, {
      type: 'bar',
      data: {
        labels: topMarcas.map(x => x[0].substring(0, 10)),
        datasets: [{
          label: 'Ingresos ($)',
          data: topMarcas.map(x => x[1]),
          backgroundColor: '#C9A84C',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: textColor }, grid: { color: gridColor } },
          x: { ticks: { color: textColor }, grid: { display: false } }
        }
      }
    });
  }

  // Top Perfumes -> We don't have the canvas for it anymore, we'll skip it or re-add it. Wait, I didn't add it to HTML.
  // Actually, I removed chartTop from HTML and replaced it with Canales, Tallas, Marcas. That's fine! 
}

function renderTopClientes() {
  const cData = {};
  ventasFiltradas.forEach(v => {
    const name = v.cliente ? v.cliente.trim() : 'Mostrador / Anónimo';
    if (!cData[name]) cData[name] = { count: 0, ingresos: 0 };
    cData[name].count++;
    cData[name].ingresos += (+v.precio || 0) * (+v.cantidad || 1);
  });
  
  const top = Object.entries(cData)
    .filter(x => x[0] !== 'Mostrador / Anónimo' && x[0] !== '')
    .sort((a,b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 5);
    
  const container = document.getElementById('top-clientes-list');
  if (!container) return;
  
  if (top.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-faint)">Sin datos en este periodo</div>';
    return;
  }
  
  container.innerHTML = top.map((x, i) => `
    <div class="list-item">
      <div>
        <div class="list-item-title">#${i+1} ${x[0]}</div>
        <div class="list-item-sub">${x[1].count} compras</div>
      </div>
      <div style="color:#C9A84C; font-weight:600">${x[1].ingresos.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</div>
    </div>
  `).join('');
}

function renderAlertasInventario() {
  const container = document.getElementById('alertas-inventario-list');
  if (!container) return;
  
  // Need to calculate total sold + total consigned (unsold)
  const pSoldsData = {};
  ventas.forEach(v => {
    if (!pSoldsData[v.perfumeId]) pSoldsData[v.perfumeId] = { ml: 0, byLote: {} };
    const pData = pSoldsData[v.perfumeId];
    const lid = v.loteId || 'lote-1';
    if (!pData.byLote[lid]) pData.byLote[lid] = { ml: 0, hasResto: false };
    
    if (['2','3','5','10'].includes(v.talla)) {
      const mlVendido = parseFloat(v.talla) * (+v.cantidad || 1);
      pData.ml += mlVendido;
      pData.byLote[lid].ml += mlVendido;
    } else if (v.talla === 'Resto') {
      pData.byLote[lid].hasResto = true;
    }
  });
  
  // Fetch consignaciones and add unsold decants to pSolds
  getDocs(collection(db, 'consignaciones')).then(cSnap => {
    cSnap.forEach(d => {
      const c = d.data();
      if (c.estado !== 'Cerrado') {
        c.items.forEach(item => {
          const unsolds = (item.cantidad || 0) - (item.vendidos || 0);
          if (unsolds > 0) {
            if (!pSoldsData[item.perfumeId]) pSoldsData[item.perfumeId] = { ml: 0, byLote: {} };
            const lid = item.loteId || 'lote-1';
            if (!pSoldsData[item.perfumeId].byLote[lid]) pSoldsData[item.perfumeId].byLote[lid] = { ml: 0, hasResto: false };
            
            const mlUnsold = parseFloat(item.talla) * unsolds;
            pSoldsData[item.perfumeId].ml += mlUnsold;
            pSoldsData[item.perfumeId].byLote[lid].ml += mlUnsold;
          }
        });
      }
    });
    
    _finishRenderAlertas(pSoldsData, container);
  }).catch(e => {
    console.error("Error loading consignaciones for alerts:", e);
    _finishRenderAlertas(pSoldsData, container); // Fallback to just ventas
  });
}

function _finishRenderAlertas(pSoldsData, container) {
  const alerts = [];
  perfumes.forEach(p => {
    if (p.archivado || p.activo === false) return; // Skip archived/hidden
    const data = pSoldsData[p.id] || { ml: 0, byLote: {} };
    
    let totalCap = 0;
    let sold = 0;
    
    if (p.lotes && p.lotes.length > 0) {
      p.lotes.forEach(l => {
         const lCap = +l.tamano || 0;
         totalCap += lCap;
         
         const lSoldData = data.byLote[l.id] || { ml: 0, hasResto: false };
         let lSold = lSoldData.ml;
         if (lSoldData.hasResto) lSold = lCap;
         
         sold += lSold;
      });
    } else {
      totalCap = +p.tamanoBotella || 0;
      sold = data.ml;
      if (data.byLote['lote-1']?.hasResto) sold = totalCap;
    }
    
    let pct = 0;
    if (totalCap > 0) {
      pct = (sold / totalCap) * 100;
    }
    
    if (pct >= 85 || p.estadoStock === 'por_acabarse' || p.estadoStock === 'agotado') {
      let sortVal = pct;
      if (p.estadoStock === 'agotado') sortVal = Math.max(100, pct);
      else if (p.estadoStock === 'por_acabarse') sortVal = Math.max(85, pct);
      alerts.push({ p, pct: sortVal, realPct: pct, sold, totalCap, estado: p.estadoStock });
    }
  });
  
  alerts.sort((a,b) => b.pct - a.pct);
  
  if (alerts.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-faint)"><i class="bi bi-check-circle" style="color:#22c55e;font-size:24px"></i><br>Todo en orden</div>';
    return;
  }
  
  container.innerHTML = alerts.map(x => {
    let isAgotado = x.pct >= 100 || x.estado === 'agotado';
    let isWarning = !isAgotado && (x.pct >= 85 || x.estado === 'por_acabarse');
    
    let text = isAgotado ? 'Agotado' : (x.estado === 'por_acabarse' && x.realPct < 85 ? 'Manual' : x.realPct.toFixed(0) + '%');
    
    let badgeClass = isAgotado ? 'badge-loss' : 'badge-profit';
    let badgeStyle = isAgotado ? '' : 'background:rgba(217,119,6,0.15); color:#d97706';
    
    let soldText = x.totalCap > 0 ? `${x.sold}ml de ${x.totalCap}ml vendidos` : `${x.sold}ml vendidos`;
    
    return `
    <div class="list-item" style="cursor:pointer" onclick="window.location.href='perfumes.html'">
      <div>
        <div class="list-item-title">${x.p.nombre}</div>
        <div class="list-item-sub">${soldText}</div>
      </div>
      <div style="text-align:right">
        <span class="badge ${badgeClass}" style="${badgeStyle}">
          ${text}
        </span>
      </div>
    </div>
  `;}).join('');
}

window.currentPageStats = 1;
const pageSizeStats = 20;

window.renderTable = () => renderProfitability();

function renderProfitability() {
  const tbody = document.getElementById('profit-tbody');
  const q = (document.getElementById('f-search')?.value || '').toLowerCase();
  const qMarca = (document.getElementById('f-marca')?.value || '');
  
  const costoInsumoUnitario = (+costosOp.botella || 0) + (+costosOp.etiqueta || 0) + (+costosOp.bolsa || 0);
  
  let results = [];
  
  perfumes.forEach(p => {
    if (q && !p.nombre.toLowerCase().includes(q) && !(p.marca||'').toLowerCase().includes(q)) return;
    if (qMarca && p.marca !== qMarca) return;
    
    const lotes = p.lotes && p.lotes.length > 0 ? p.lotes : [];
    if (lotes.length === 0 && p.costoBotella && p.tamanoBotella) {
      lotes.push({ id: 'lote-1', fecha: p.creadoEn || Date.now(), costo: +p.costoBotella, tamano: +p.tamanoBotella });
    }
    if (lotes.length === 0) return; 
    
    const hist = ventasFiltradas.filter(v => v.perfumeId === p.id);
    
    ventasFiltradas.forEach(v => {
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
      let restoVendido = false;
      const distribucion = { '2':0, '3':0, '5':0, '10':0 };
      
      loteHist.forEach(v => {
        // Ignorar "Completo" y "Otro" en estas métricas
        if (['2','3','5','10'].includes(v.talla)) {
          const c = +v.cantidad || 1;
          distribucion[v.talla] += c;
          totalMlVendidos += (parseInt(v.talla) * c);
          totalDecantsVendidos += c;
          ingresoReal += (+v.precio || 0) * c;
        } else if (v.talla === 'Resto') {
          const c = +v.cantidad || 1;
          ingresoReal += (+v.precio || 0) * c;
          restoVendido = true;
        }
      });
      
      const costoBotella = parseFloat(l.costo) || 0;
      const tamanoBotella = parseFloat(l.tamano) || 100;
      
      if (restoVendido) totalMlVendidos = tamanoBotella; // Force 100% progress
      
      const progresoPorcentaje = tamanoBotella > 0 ? Math.min(100, Math.round((totalMlVendidos / tamanoBotella) * 100)) : 0;
      
      const costoInsumosReal = totalDecantsVendidos * costoInsumoUnitario;
      const costoInversionReal = costoBotella + costoInsumosReal;
      const gananciaReal = ingresoReal - costoInversionReal;
      
      let totalDecantsProyectados = 0;
      let ingresoTotalProyectado = 0;
      let costoTotalInsumos = costoInsumosReal;
      let gananciaNetaFinal = gananciaReal;
      
      if (!restoVendido && totalMlVendidos < tamanoBotella) {
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
        costoTotalInsumos = totalDecantsProyectados * costoInsumoUnitario;
        gananciaNetaFinal = ingresoTotalProyectado - (costoBotella + costoTotalInsumos);
      }
      
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
  
  ventasFiltradas.forEach(v => {
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
