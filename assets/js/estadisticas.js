import { db, collection, getDocs, doc, getDoc, updateDoc, auth, onAuthStateChanged } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import { esClienteTemporal, claveCliente } from './clientes-util.js';
import { topVendidos, sinMovimiento, aMs } from './alertas.js';
import { contextoRentabilidad, resumenGanancia, clientesAtendidos, rentabilidadPorBotella, consumoDePerfume } from './rentabilidad.js';
import { sumarVisitas } from './visitas.js';

let ventas = [];
let ventasFiltradas = [];
let perfumes = [];
let costosOp = { botella: 0, etiqueta: 0, bolsa: 0 };
let accesorios = [];
let visitasPorDia = {};
let ctxRent = null;
let chartTallasObj = null;
let chartTopObj = null;
let chartTendenciaObj = null;
let chartCanalesObj = null;
let chartMarcasObj = null;
let chartMetodosObj = null;

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar('estadisticas');
  onAuthStateChanged(auth, (user) => {
    if (user) window.loadData();
  });
});

window.loadData = async () => {
  const btn = document.getElementById('btn-actualizar-stats');
  if(btn) btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
  
  try {
    const [vs, ps, confSnap, accSnap, visSnap] = await Promise.all([
      getDocs(collection(db, 'ventas')),
      getDocs(collection(db, 'perfumes')),
      getDoc(doc(db, 'config', 'costosOperativos')).catch(() => null),
      getDocs(collection(db, 'accesorios')).catch(() => null),
      getDocs(collection(db, 'visitas')).catch(() => null)
    ]);
    accesorios = [];
    if (accSnap) accSnap.forEach(d => accesorios.push({ id: d.id, ...d.data() }));
    visitasPorDia = {};
    if (visSnap) visSnap.forEach(d => { visitasPorDia[d.id] = d.data(); });
    
    ventas = []; vs.forEach(d => {
      const data = d.data();
      // creadoEn siempre en ms: las ventas del modal viejo traen Timestamp y
      // caían en un "NaN/NaN" de la tendencia.
      if (data.estado !== 'cancelada') ventas.push({ id: d.id, ...data, creadoEn: aMs(data.creadoEn) || data.creadoEn });
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
    ctxRent = contextoRentabilidad({ perfumes, accesorios, costosOp, ventas });
    
    aplicarFiltroFecha();
  } catch(e) {
    console.error("Error loading stats:", e);
  } finally {
    if(btn) btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
  }
};

let periodoDesde = 0;

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
  
  periodoDesde = desde;
  if (desde > 0) {
    ventasFiltradas = ventas.filter(v => aMs(v.creadoEn) >= desde);
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
  renderDecisiones();
}

// Cambiar de periodo no necesita volver a leer Firestore: los datos ya están.
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.periodo');
  if (!chip) return;
  document.querySelectorAll('.periodo').forEach(b => b.classList.toggle('on', b === chip));
  const sel = document.getElementById('f-periodo-global');
  if (sel) sel.value = chip.dataset.p;
  if (ventas.length || perfumes.length) aplicarFiltroFecha();
});

const mxn = n => (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderDecisiones() {
  const top = topVendidos(ventasFiltradas, 0, 6).sort((a, b) => b.total - a.total);
  const elTop = document.getElementById('dec-top');
  if (elTop) {
    elTop.innerHTML = top.length
      ? top.map(t => `
          <div class="dec-item">
            <strong>${escHtml(t.nombre)}</strong>
            <span>${t.unidades} pzs · <em>${mxn(t.total)}</em></span>
          </div>`).join('')
      : '<div class="dec-vacio">Sin ventas en este periodo.</div>';
  }

  const quietos = sinMovimiento(perfumes, ventas, Date.now(), 30);
  const elQ = document.getElementById('dec-quietos');
  if (elQ) {
    elQ.innerHTML = quietos.length
      ? quietos.slice(0, 8).map(q => `
          <div class="dec-item">
            <strong>${escHtml(q.nombre)}</strong>
            <span>${q.dias === null ? 'nunca se ha vendido' : `hace ${q.dias} días`}</span>
          </div>`).join('') +
        (quietos.length > 8 ? `<div class="dec-vacio">y ${quietos.length - 8} más</div>` : '')
      : '<div class="dec-vacio">Todo lo que tienes se está moviendo.</div>';
  }
}

function renderKPIs() {
  // El costo de cada venta sale de SU botella (rentabilidad.js): si un perfume
  // se compró a $350 y luego a $400, cada venta usa el que le toca. Antes las
  // botellas completas contaban costo $0 y los accesorios como decants de 1 ml.
  const r = resumenGanancia(ventasFiltradas, ctxRent || contextoRentabilidad({ perfumes, accesorios, costosOp, ventas }));
  const clientes = clientesAtendidos(ventasFiltradas);
  const ticketPromedio = clientes > 0 ? r.ingresos / clientes : 0;
  const pesos = n => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const poner = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  poner('kpi-ingresos', pesos(r.ingresos));
  poner('kpi-ganancia', pesos(r.ganancia));
  poner('kpi-costo', pesos(r.costo + r.comisiones));
  poner('kpi-margen', r.margen.toFixed(1) + '%');
  poner('kpi-ticket', pesos(ticketPromedio));
  poner('kpi-clientes', clientes.toLocaleString());
  poner('kpi-decants', r.decants.toLocaleString());
  poner('kpi-ml', r.ml.toLocaleString() + ' ml');

  const notas = [];
  if (r.comisiones > 0) notas.push(`Ya descuenta ${mxn(r.comisiones)} de comisiones`);
  if (r.sinCosto > 0) notas.push(`${r.sinCosto} venta${r.sinCosto > 1 ? 's' : ''} sin costo registrado`);
  poner('kpi-ganancia-nota', notas.join(' · '));

  const acc = r.porTipo.accesorio;
  poner('kpi-acc', pesos(acc ? acc.ingresos : 0));
  poner('kpi-acc-nota', acc ? `${acc.unidades} pza${acc.unidades > 1 ? 's' : ''} · ganancia ${mxn(acc.ganancia)}` : 'Aparte de los decants');

  const vis = sumarVisitas(visitasPorDia, periodoDesde);
  poner('kpi-visitas', Object.keys(visitasPorDia).length ? vis.personas.toLocaleString() : '—');
  poner('kpi-visitas-nota', Object.keys(visitasPorDia).length
    ? `${vis.porDia.toFixed(1)} al día · sin contarte a ti`
    : 'Empieza a contar desde que se publique este cambio');
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
  const canalesCount = { 'online': 0, 'mercado': 0, 'otro': 0, 'consignacion': 0 };
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
        labels: ['Online / WA', 'Sobre Ruedas', 'Otro', 'Punto externo'],
        datasets: [{
          data: [canalesCount['online'], canalesCount['mercado'], canalesCount['otro'], canalesCount['consignacion']],
          backgroundColor: ['#4f98a3', '#C9A84C', '#a36c4f', '#a78bfa'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
      }
    });
  }

  // 2b. Métodos de Pago
  const metodosCount = { 'efectivo': 0, 'transferencia': 0, 'tarjeta': 0, 'otro': 0 };
  ventasFiltradas.forEach(v => {
    const m = v.metodoPago || 'efectivo';
    if (metodosCount[m] !== undefined) metodosCount[m] += (+v.precio || 0) * (+v.cantidad || 1);
  });

  const ctxMetodos = document.getElementById('chartMetodos');
  if (ctxMetodos) {
    if (chartMetodosObj) chartMetodosObj.destroy();
    chartMetodosObj = new Chart(ctxMetodos, {
      type: 'doughnut',
      data: {
        labels: ['Efectivo 💵', 'Transfer. 🏦', 'Tarjeta 💳', 'Otro'],
        datasets: [{
          data: [metodosCount['efectivo'], metodosCount['transferencia'], metodosCount['tarjeta'], metodosCount['otro']],
          backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#6b7280'],
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
    // Los clientes de Sobre Ruedas son de paso: se registran como "Cliente 8",
    // "Cliente 12"… y esa numeración se reinicia cada jornada. Agruparlos por
    // nombre fusionaba a personas distintas en un "mejor cliente" inexistente.
    if (esClienteTemporal(v)) return;
    // Las ventas de puntos externos llevan el nombre del lugar, no de una persona.
    if (v.canal === 'consignacion') return;

    const key = claveCliente(v);
    if (!key) return;

    if (!cData[key]) cData[key] = { nombre: (v.cliente || '').trim(), count: 0, ingresos: 0, items: [] };
    const cant = +v.cantidad || 1;
    cData[key].count += cant;
    cData[key].ingresos += (+v.precio || 0) * cant;
    let itemName = v.perfumeNombre || '';
    if (itemName) {
      if (v.talla) itemName += ` ${v.talla}${v.talla.includes('ml') || v.talla === 'Completo' || v.talla === 'Resto' || v.talla === 'Otro' ? '' : 'ml'}`;
      if (+v.cantidad > 1) itemName += ` (x${v.cantidad})`;
      cData[key].items.push(itemName);
    }
  });

  const top = Object.entries(cData)
    .sort((a,b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 5);

  const container = document.getElementById('top-clientes-list');
  if (!container) return;
  
  if (top.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-faint)">Sin clientes registrados en este periodo</div>';
    return;
  }

  container.innerHTML = top.map((x, i) => {
    // Unique list of up to 5 items to show
    const uniqueItems = [...new Set(x[1].items)];
    const itemsStr = uniqueItems.slice(0, 4).join(', ') + (uniqueItems.length > 4 ? ', ...' : '');

    return `
    <div class="list-item">
      <div>
        <div class="list-item-title">#${i+1} ${x[1].nombre}</div>
        <div class="list-item-sub" style="margin-bottom:2px;">${x[1].count} artículo${x[1].count > 1 ? 's' : ''}</div>
        ${itemsStr ? `<div style="font-size:10px; color:var(--text-faint); max-width: 250px; white-space: normal;">🛒 ${itemsStr}</div>` : ''}
      </div>
      <div style="color:#C9A84C; font-weight:600">${x[1].ingresos.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</div>
    </div>
  `}).join('');
}

function renderAlertasInventario() {
  const container = document.getElementById('alertas-inventario-list');
  if (!container) return;
  
  // Lo dejado en puntos externos ya salió de la botella aunque no se haya vendido.
  getDocs(collection(db, 'consignaciones')).then(cSnap => {
    const consignados = [];
    cSnap.forEach(d => {
      const c = d.data();
      if (c.estado === 'Cerrado') return;
      (c.items || []).forEach(item => {
        const sinVender = (item.cantidad || 0) - (item.vendidos || 0);
        if (sinVender > 0) consignados.push({ perfumeId: item.perfumeId, talla: item.talla, cantidad: sinVender, loteId: item.loteId });
      });
    });
    _finishRenderAlertas(consignados, container);
  }).catch(e => {
    console.error("Error loading consignaciones for alerts:", e);
    _finishRenderAlertas([], container);
  });
}

function _finishRenderAlertas(consignados, container) {
  const alerts = [];
  perfumes.forEach(p => {
    if (p.archivado) return; // Skip archived, but show hidden (activo===false) since they still need restock
    const consumo = consumoDePerfume(p, ventas, consignados);
    const totalCap = consumo.capacidad;
    const sold = Math.round(consumo.usado);
    const pct = consumo.pct;
    
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
  const vista = document.getElementById('f-vista')?.value || 'stock';

  let results = [];
  
  perfumes.forEach(p => {
    if (q && !p.nombre.toLowerCase().includes(q) && !(p.marca||'').toLowerCase().includes(q)) return;
    // Lo agotado y lo archivado ya no se puede vender: no estorba por defecto.
    const agotado = p.estadoStock === 'agotado' || p.activo === false || p.archivado === true;
    if (vista === 'stock' && agotado) return;
    if (vista === 'agotados' && !agotado) return;
    
    const lotes = p.lotes && p.lotes.length > 0 ? p.lotes : [];
    if (lotes.length === 0 && p.costoBotella && p.tamanoBotella) {
      lotes.push({ id: 'lote-1', fecha: p.creadoEn || Date.now(), costo: +p.costoBotella, tamano: +p.tamanoBotella });
    }
    if (lotes.length === 0) return; 
    
    const hist = ventas.filter(v => 
      (v.perfumeId === p.id || (!v.perfumeId && (v.perfumeNombre||'').trim().toLowerCase() === p.nombre.trim().toLowerCase())) 
      && v.estado !== 'cancelada'
    );
    
    ventas.forEach(v => {
      if (v.estado === 'cancelada') return;
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
    
    // Cada botella con su costo; el renglón del perfume suma todas (antes
    // mostraba solo la activa y no cuadraba con las de abajo).
    const rent = rentabilidadPorBotella({ ...p, lotes }, hist, costosOp);
    const loteResults = rent.botellas.map(b => ({
      id: b.id,
      nombre: `Botella #${b.idx + 1} (${new Date(b.fecha).toLocaleDateString('es-MX')})`,
      progresoTexto: `${Math.round(b.usado)} / ${b.tamano}ml`,
      progresoPorcentaje: b.progreso,
      costoInversionReal: b.costoReal,
      ingresoReal: b.ingreso,
      gananciaReal: b.gananciaReal,
      gananciaNetaFinal: b.proyeccion,
      tamanoBotella: b.tamano,
      mlVendidosVentas: b.mlVentas,
      restoVendido: b.restoVendido,
      enUso: rent.enUso && rent.enUso.id === b.id && rent.botellas.length > 1
    }));
    const enUso = rent.enUso;

    results.push({
      pid: p.id,
      nombre: p.nombre,
      marca: p.marca || '',
      agotado,
      progreso: enUso ? enUso.progreso : 0,
      progresoTexto: enUso ? `${rent.botellas.length > 1 ? 'En uso: ' : ''}${Math.round(enUso.usado)} / ${enUso.tamano}ml` : '',
      sumGanancia: rent.total.gananciaReal,
      sumIngreso: rent.total.ingreso,
      sumCostoBotella: rent.total.costoReal,
      sumCostoInsumos: rent.total.proyeccion,
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
    if (vista === 'todos' && ingreso > 0.5) {
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
    if (sortVal === 'progress-desc') return (b.progreso || 0) - (a.progreso || 0);
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
    const msg = vista === 'stock' ? 'No hay botellas en stock con costo registrado.' : 'No hay resultados.';
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-faint)">${msg}</td></tr>`;
    renderStatsPagination(0, 1);
    return;
  }
  
  tbody.innerHTML = paginated.map(r => {
    const isProfit = r.sumGanancia >= 0;
    const hasLotes = r.lotes.length > 0;
    
    let html = `
      <tr data-fila="perfume" style="cursor:${hasLotes?'pointer':'default'}" onclick="window.toggleLotes('${r.pid}')">
        <td>
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            ${hasLotes ? `<i class="bi bi-chevron-right" id="icon-${r.pid}" style="transition:0.2s"></i>` : ''}
            <span style="min-width:0">
              <strong>${r.nombre}</strong>${r.agotado ? '<span class="tag-agotado">AGOTADO</span>' : ''}
              <span style="display:block;font-size:11px;color:var(--text-faint)">${r.marca}${r.lotes.length > 1 ? ` · ${r.lotes.length} botellas` : ''}</span>
            </span>
          </div>
        </td>
        <td data-label="Usado">
          ${r.progresoTexto ? `<span style="font-size:12px;color:var(--text-muted)">${r.progresoTexto} · ${r.progreso}%
            <span class="prog-mini"><span style="width:${r.progreso}%;${r.progreso >= 90 ? 'background:#ef4444' : ''}"></span></span></span>` : '—'}
        </td>
        <td class="text-right" data-label="Invertido">${r.sumCostoBotella.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right" data-label="Vendido" style="color:var(--text-faint)">${r.sumIngreso.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td>
        <td class="text-right" data-label="Ganancia">
          <span class="${isProfit ? 'badge-profit' : 'badge-loss'}">
            ${r.sumGanancia.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
          </span>
        </td>
        <td class="text-right" data-label="Al terminarla" style="color:var(--text-faint)">
          ${r.sumCostoInsumos.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
        </td>
      </tr>
    `;
    
    if (hasLotes) {
      r.lotes.forEach(l => {
        const isLProfit = l.gananciaReal >= 0;
        const colorProgreso = l.progresoPorcentaje >= 100 ? '#ef4444' : 'var(--accent)';
        html += `
          <tr data-fila="lote" class="lotes-row-${r.pid}" style="display:none; background:var(--bg-card2)">
            <td style="padding-left:35px; border-left:3px solid var(--accent)">↳ ${l.nombre}${l.enUso ? ' <span style="font-size:10.5px;color:var(--accent)">· en uso</span>' : ''}</td>
            <td>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                <span>${l.progresoTexto}</span>
                ${!l.restoVendido ? `<button onclick="event.stopPropagation(); window.abrirModalAjuste('${r.pid}', '${l.id}', ${l.tamanoBotella}, ${l.mlVendidosVentas})" style="background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:var(--accent);border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><i class='bi bi-pencil-fill'></i> Ajustar</button>` : ''}
              </div>
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
      r.style.display = '';  // que decida el CSS: fila en escritorio, bloque en móvil
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

// ==========================================
// CRUD: Ajuste Manual de Líquido
// ==========================================
let ajusteActual = null;

window.abrirModalAjuste = (pid, lid, tamano, mlVendidos) => {
  ajusteActual = { pid, lid, tamano, mlVendidos };
  
  const m = document.getElementById('modal-ajuste');
  if (!m) return;
  
  document.getElementById('ajuste-capacidad').textContent = tamano + ' ml';
  document.getElementById('ajuste-vendido').textContent = mlVendidos + ' ml';
  
  // Buscar si ya tiene un ajuste guardado
  const p = perfumes.find(x => x.id === pid);
  let mlAjuste = 0;
  if (p && p.lotes) {
    const l = p.lotes.find(x => x.id === lid);
    if (l && l.mlAjuste) mlAjuste = parseFloat(l.mlAjuste) || 0;
  }
  
  const restanteCalculado = tamano - mlVendidos - mlAjuste;
  document.getElementById('ajuste-calculado').textContent = Math.max(0, restanteCalculado) + ' ml';
  
  const inReal = document.getElementById('ajuste-real-ml');
  inReal.value = Math.max(0, restanteCalculado);
  
  const preview = document.getElementById('ajuste-preview');
  preview.innerHTML = '';
  
  inReal.oninput = () => {
    const val = parseFloat(inReal.value);
    if (isNaN(val) || val < 0 || val > tamano) {
      preview.innerHTML = '<span style="color:#ef4444">Valor inválido</span>';
      return;
    }
    const consumidoTotal = tamano - val;
    const nuevoAjuste = consumidoTotal - mlVendidos;
    
    if (nuevoAjuste > 0) {
      preview.innerHTML = `Se registrará una merma/pérdida de <strong>${nuevoAjuste} ml</strong>.`;
    } else if (nuevoAjuste < 0) {
      preview.innerHTML = `Se recuperarán <strong>${Math.abs(nuevoAjuste)} ml</strong> al inventario.`;
    } else {
      preview.innerHTML = 'Sin cambios.';
    }
  };
  
  m.classList.add('open');
};

window.guardarAjusteLiquido = async () => {
  if (!ajusteActual) return;
  
  const inReal = document.getElementById('ajuste-real-ml');
  const val = parseFloat(inReal.value);
  if (isNaN(val) || val < 0 || val > ajusteActual.tamano) {
    alert("Por favor ingresa un nivel de mililitros válido (entre 0 y la capacidad de la botella).");
    return;
  }
  
  const consumidoTotal = ajusteActual.tamano - val;
  const nuevoAjuste = consumidoTotal - ajusteActual.mlVendidos;
  
  const btn = document.getElementById('btn-guardar-ajuste');
  const oldText = btn.innerHTML;
  btn.innerHTML = 'Guardando...';
  btn.disabled = true;
  
  try {
    const pRef = doc(db, 'perfumes', ajusteActual.pid);
    const pSnap = await getDoc(pRef);
    if (!pSnap.exists()) throw new Error("Perfume no encontrado");
    
    const pData = pSnap.data();
    const lotes = pData.lotes || [];
    const loteIndex = lotes.findIndex(x => x.id === ajusteActual.lid);
    
    if (loteIndex === -1) {
      // Si no existe el array de lotes, es una botella migrada, la inicializamos
      lotes.push({
        id: 'lote-1',
        fecha: pData.creadoEn || Date.now(),
        costo: pData.costoBotella,
        tamano: pData.tamanoBotella,
        mlAjuste: nuevoAjuste
      });
    } else {
      lotes[loteIndex].mlAjuste = nuevoAjuste;
    }
    
    await updateDoc(pRef, { lotes });
    
    // Update local variable so we don't have to fetch everything again
    const localP = perfumes.find(x => x.id === ajusteActual.pid);
    if (localP) localP.lotes = lotes;
    
    // Auto-update estadoStock based on the new ajuste level
    if (localP) {
      // Recalculate total sold for this perfume
      let totalCap = 0;
      let totalSold = 0;
      (localP.lotes || []).forEach(l => {
        const lCap = +l.tamano || 0;
        totalCap += lCap;
        // Gather sold ml from ventas
        let lSold = 0;
        ventas.forEach(v => {
          if (v.paqueteItems && Array.isArray(v.paqueteItems)) {
            const t = parseFloat(String(v.talla).replace('Paquete ', '')) || 0;
            v.paqueteItems.forEach(pi => {
              if (pi.id === localP.id && (pi.loteId || 'lote-1') === l.id) {
                lSold += t * (+v.cantidad || 1);
              }
            });
          } else if (v.perfumeId === localP.id && (v.loteId || 'lote-1') === l.id) {
            if (v.talla === 'Resto') { lSold = lCap; }
            else if (v.talla !== 'Completo' && v.talla !== 'Otro') {
              const t = parseFloat(v.talla);
              if (!isNaN(t) && t > 0) lSold += t * (+v.cantidad || 1);
            }
          }
        });
        lSold += parseFloat(l.mlAjuste) || 0;
        totalSold += lSold;
      });
      
      const pct = totalCap > 0 ? (totalSold / totalCap) * 100 : 0;
      let newEstado = 'normal';
      if (pct >= 100) newEstado = 'agotado';
      else if (pct >= 85) newEstado = 'por_acabarse';
      
      if (localP.estadoStock !== newEstado) {
        localP.estadoStock = newEstado;
        await updateDoc(pRef, { estadoStock: newEstado });
      }
    }
    
    document.getElementById('modal-ajuste').classList.remove('open');
    
    // Recalcular todo
    window.renderTable();
    if (typeof renderAlertasInventario === 'function') {
      renderAlertasInventario();
    }
    
  } catch(e) {
    console.error(e);
    alert("Hubo un error al guardar el ajuste.");
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
};
