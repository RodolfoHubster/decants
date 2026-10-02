/**
 * alertas.js — Resumen del día y recordatorios del dashboard.
 *
 * El sistema no debe esperar a que el dueño se acuerde de entrar a cada sección:
 * aquí se decide qué hay pendiente y qué tan urgente es. Sin DOM, para testearlo.
 */

const DIA = 24 * 60 * 60 * 1000;
const CLOUDINARY = 'https://res.cloudinary.com/';

export const ENCARGO_ACTIVO = ['pendiente', 'buscando', 'conseguido', 'avisado'];
export const DIAS_ENCARGO_PARADO = 5;
export const DIAS_SIN_VENTAS = 4;
export const DIAS_PUNTO_EXTERNO = 7;
export const DIAS_VENTAS_RESTOCK = 60;

/** Milisegundos de un Timestamp de Firestore, número, string o Date. */
export function aMs(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function inicioDelDia(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function inicioDeSemana(ms) {
  const d = new Date(inicioDelDia(ms));
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

function inicioDeMes(ms, offset = 0) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();
}

const importe = v => (Number(v.precio) || 0) * (Number(v.cantidad) || 1);
const valida = v => v && v.estado !== 'cancelada';
const plural = (n, s, p = s + 's') => (n === 1 ? s : p);

/**
 * Cuánto se ha vendido hoy, esta semana, este mes y el mes pasado A LA MISMA
 * ALTURA (del 1 al día de hoy), para que la comparación sea justa.
 */
export function resumenVentas(ventas, ahora) {
  const hoy0 = inicioDelDia(ahora);
  const sem0 = inicioDeSemana(ahora);
  const mes0 = inicioDeMes(ahora);
  const mesP0 = inicioDeMes(ahora, -1);
  const mesPCorte = mesP0 + (ahora - mes0);

  const r = { hoy: 0, piezasHoy: 0, semana: 0, mes: 0, mesPasado: 0, ultimaVenta: 0 };
  (ventas || []).filter(valida).forEach(v => {
    const t = aMs(v.creadoEn);
    if (!t) return;
    const monto = importe(v);
    if (t > r.ultimaVenta) r.ultimaVenta = t;
    if (t >= hoy0) { r.hoy += monto; r.piezasHoy += Number(v.cantidad) || 1; }
    if (t >= sem0) r.semana += monto;
    if (t >= mes0) r.mes += monto;
    else if (t >= mesP0 && t < mesPCorte) r.mesPasado += monto;
  });
  r.cambioMes = r.mesPasado > 0 ? Math.round(((r.mes - r.mesPasado) / r.mesPasado) * 100) : null;
  return r;
}

/** Lo más vendido desde una fecha, por unidades. */
export function topVendidos(ventas, desde, n = 5) {
  const por = new Map();
  (ventas || []).filter(valida).forEach(v => {
    if (aMs(v.creadoEn) < desde) return;
    const k = v.perfumeNombre || 'Sin nombre';
    const g = por.get(k) || { nombre: k, unidades: 0, total: 0 };
    g.unidades += Number(v.cantidad) || 1;
    g.total += importe(v);
    por.set(k, g);
  });
  return [...por.values()].sort((a, b) => b.unidades - a.unidades || b.total - a.total).slice(0, n);
}

const activo = p => p && p.activo !== false && p.archivado !== true;
const tienePrecio = p => Object.values(p.precios || {}).some(x => Number(x) > 0);

/**
 * Lista de recordatorios, de más a menos urgente. Cada uno dice a dónde ir.
 */
export function pendientes(datos, ahora) {
  const { perfumes = [], ventas = [], encargos = [], pedidos = [], consignaciones = [] } = datos || {};
  const out = [];
  const add = (nivel, clave, titulo, detalle, href, items = []) =>
    out.push({ nivel, clave, titulo, detalle, href, items });

  // Ventas por cobrar: dinero que ya es tuyo y no ha entrado.
  const porCobrar = ventas.filter(v => v.estado === 'pendiente');
  if (porCobrar.length) {
    const total = porCobrar.reduce((s, v) => s + importe(v), 0);
    add('alta', 'cobrar',
      `${porCobrar.length} ${plural(porCobrar.length, 'venta')} por cobrar`,
      `$${total.toLocaleString('es-MX')} que todavía no entra.`, 'ventas.html',
      porCobrar.slice(0, 4).map(v => `${v.cliente || 'Sin nombre'} · ${v.perfumeNombre || ''}`));
  }

  const nuevos = pedidos.filter(p => p.estado === 'nuevo');
  if (nuevos.length) {
    add('alta', 'pedidos',
      `${nuevos.length} ${plural(nuevos.length, 'pedido')} web sin atender`,
      'Alguien te escribió desde la tienda.', 'pedidos.html');
  }

  const parados = encargos
    .filter(e => ENCARGO_ACTIVO.includes(e.estado))
    .map(e => ({ e, dias: Math.floor((ahora - aMs(e.actualizadoEn || e.creadoEn)) / DIA) }))
    .filter(x => x.dias >= DIAS_ENCARGO_PARADO)
    .sort((a, b) => b.dias - a.dias);
  if (parados.length) {
    add('alta', 'encargos',
      `${parados.length} ${plural(parados.length, 'encargo')} sin moverse`,
      `Llevan ${DIAS_ENCARGO_PARADO} días o más en el mismo estado.`, 'encargos.html',
      parados.slice(0, 4).map(({ e, dias }) =>
        `${e.cliente || 'Sin nombre'} · ${e.perfume || e.perfumeNombre || ''} · ${dias} días`));
  }

  // Restock: agotados que sí se vendían. Los que nunca se vendieron no urgen.
  const desde = ahora - DIAS_VENTAS_RESTOCK * DIA;
  const vendidosPorId = new Map();
  ventas.filter(valida).forEach(v => {
    if (aMs(v.creadoEn) < desde || !v.perfumeId) return;
    vendidosPorId.set(v.perfumeId, (vendidosPorId.get(v.perfumeId) || 0) + (Number(v.cantidad) || 1));
  });
  const restock = perfumes
    .filter(p => activo(p) && p.estadoStock === 'agotado' && vendidosPorId.get(p.id))
    .sort((a, b) => vendidosPorId.get(b.id) - vendidosPorId.get(a.id));
  if (restock.length) {
    add('alta', 'restock',
      `${restock.length} ${plural(restock.length, 'agotado')} que sí se venden`,
      `Se vendieron en los últimos ${DIAS_VENTAS_RESTOCK} días. Vale la pena reponerlos.`,
      'costos.html?botella=1',
      restock.slice(0, 5).map(p => `${p.nombre} · ${vendidosPorId.get(p.id)} vendidos`));
  }

  const vivos = perfumes.filter(activo);

  const sinPrecio = vivos.filter(p => !tienePrecio(p));
  if (sinPrecio.length) {
    add('alta', 'sin-precio',
      `${sinPrecio.length} ${plural(sinPrecio.length, 'perfume')} sin precio`,
      'Están visibles en la tienda pero nadie los puede comprar.', 'perfumes.html',
      sinPrecio.slice(0, 5).map(p => p.nombre));
  }

  const sinImagen = vivos.filter(p => !p.imagen);
  if (sinImagen.length) {
    add('media', 'sin-imagen',
      `${sinImagen.length} ${plural(sinImagen.length, 'perfume')} sin foto`,
      'Un perfume sin foto casi no se vende.', 'perfumes.html',
      sinImagen.slice(0, 5).map(p => p.nombre));
  }

  const externas = vivos.filter(p => p.imagen && !String(p.imagen).startsWith(CLOUDINARY));
  if (externas.length) {
    add('media', 'img-externa',
      `${externas.length} ${plural(externas.length, 'foto')} de otros sitios`,
      'Dependen de un servidor ajeno: a tus clientes les cargan lento o no les cargan. Súbelas de nuevo.',
      'perfumes.html', externas.slice(0, 5).map(p => p.nombre));
  }

  const abiertos = consignaciones
    .filter(c => c.estado !== 'Cerrado')
    .map(c => ({
      c,
      dias: Math.floor((ahora - aMs(c.creadoEn)) / DIA),
      quedan: (c.items || []).reduce(
        (s, i) => s + Math.max(0, (Number(i.cantidad) || 0) - (Number(i.vendidos) || 0)), 0)
    }))
    .filter(x => x.quedan > 0 && x.dias >= DIAS_PUNTO_EXTERNO);
  if (abiertos.length) {
    add('media', 'puntos', 'Pasa a revisar tus puntos externos',
      'Tienes decants dejados hace más de una semana. ¿Ya se vendieron?', 'consignaciones.html',
      abiertos.slice(0, 4).map(({ c, quedan, dias }) =>
        `${c.lugar || 'Sin nombre'} · ${quedan} sin vender · ${dias} días`));
  }

  const ultima = ventas.filter(valida).reduce((m, v) => Math.max(m, aMs(v.creadoEn)), 0);
  if (ultima) {
    const dias = Math.floor((ahora - ultima) / DIA);
    if (dias >= DIAS_SIN_VENTAS) {
      add('baja', 'sin-ventas', `${dias} días sin registrar ventas`,
        '¿Vendiste algo y no lo has apuntado?', 'ventas.html?openDia=1');
    }
  }

  const peso = { alta: 0, media: 1, baja: 2 };
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

/**
 * Perfumes en stock que no se han vendido en `dias`. Es dinero parado en el
 * estante: candidatos a promoción, a paquete o a dejar de recomprar.
 * Devuelve los más viejos primero (o los que nunca se han vendido).
 */
export function sinMovimiento(perfumes, ventas, ahora, dias = 30) {
  const ultimaPorId = new Map();
  (ventas || []).filter(valida).forEach(v => {
    const t = aMs(v.creadoEn);
    const ids = v.perfumeId ? [v.perfumeId] : [];
    (v.paqueteItems || []).forEach(i => i && i.id && ids.push(i.id));
    ids.forEach(id => { if (t > (ultimaPorId.get(id) || 0)) ultimaPorId.set(id, t); });
  });
  const corte = ahora - dias * DIA;
  return (perfumes || [])
    .filter(p => activo(p) && p.estadoStock !== 'agotado' && tienePrecio(p))
    .map(p => {
      const ultima = ultimaPorId.get(p.id) || 0;
      return { id: p.id, nombre: p.nombre, ultima, dias: ultima ? Math.floor((ahora - ultima) / DIA) : null };
    })
    .filter(x => x.ultima < corte)
    .sort((a, b) => a.ultima - b.ultima);
}
