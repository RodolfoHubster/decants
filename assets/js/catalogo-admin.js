/**
 * catalogo-admin.js — Página "Catálogo PDF" del panel: lee perfumes, config de
 * la tienda y marcas, y genera el catálogo completo o las hojas de novedades
 * (catalogo-pdf.js) en digital o para imprenta.
 */
import { db, collection, getDocs, getDoc, doc } from './firebase-config.js';
import { renderSidebar } from '../../admin/sidebar.js';
import '../../admin/auth-guard.js';
import { toast } from './toast.js';
import { armarCatalogo, fechaLarga } from './catalogo-paginas.js';
import { generarCatalogo } from './catalogo-pdf.js?v=1';

renderSidebar('catalogo-pdf');
if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';

const $ = id => document.getElementById(id);
const DIA = 864e5;
// Fecha del último catálogo completo para imprenta: de ahí parten las novedades.
const CLAVE_ULTIMO = 'catalogoPdf.ultimoImpreso';

let perfumes = [];
let tienda = { disable2ml: false, proExtra: 0 };
const logosExtra = {};
let urlActual = null;
let ocupado = false;

const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } };
const aFecha = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const desdeInput = () => {
  const v = $('nov-desde').value;
  return v ? new Date(`${v}T00:00:00`).getTime() : Date.now() - 30 * DIA;
};

function pintarResumen() {
  const c = armarCatalogo(perfumes, tienda);
  const cifras = [[c.conteo.mujer, 'Mujer'], [c.conteo.hombre, 'Hombre'], [c.conteo.unisex, 'Unisex'], [c.paginas.length, 'Hojas']];
  $('cat-cifras').innerHTML = cifras.map(([n, t]) => `<div class="cat-cifra"><b>${n}</b><span>${t}</span></div>`).join('');
  const fuera = [];
  if (c.fuera.agotado) fuera.push(`${c.fuera.agotado} agotado${c.fuera.agotado === 1 ? '' : 's'}`);
  if (c.fuera.sinPrecio) fuera.push(`${c.fuera.sinPrecio} sin precio`);
  if (c.fuera.sinGenero) fuera.push(`${c.fuera.sinGenero} sin género (Dama, Caballero o Unisex)`);
  $('cat-fuera').textContent = fuera.length ? `No salen: ${fuera.join(', ')}.` : '';
}

function pintarNovedades() {
  const n = armarCatalogo(perfumes, { ...tienda, tipo: 'novedades', desde: desdeInput() }).conteo.total;
  $('nov-resumen').textContent = n ? `${n} perfume${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'}` : 'Ningún perfume nuevo desde esa fecha';
  document.querySelectorAll('[data-generar="novedades"]').forEach(b => { b.disabled = ocupado || !n; });
}

function pintarUltimo() {
  const ms = Number(leer(CLAVE_ULTIMO)) || 0;
  $('cat-ultimo').textContent = ms
    ? `Tu último catálogo para imprenta lo generaste el ${fechaLarga(ms)}: por eso las novedades empiezan ahí.`
    : 'Cuando generes el catálogo para imprenta, las novedades empezarán a contar desde ese día.';
}

function estado(msg, avance = null) {
  $('cat-estado').textContent = msg;
  const barra = $('cat-barra');
  barra.hidden = avance === null;
  if (avance !== null) barra.firstElementChild.style.width = `${Math.round(avance * 100)}%`;
}

function bloquear(si) {
  ocupado = si;
  document.querySelectorAll('[data-generar]').forEach(b => { b.disabled = si; });
  if (!si) pintarNovedades();
}

async function generar(tipo, modo) {
  if (ocupado) return;
  bloquear(true);
  $('cat-aviso').textContent = '';
  estado('Preparando…', 0);
  try {
    const r = await generarCatalogo(perfumes, {
      ...tienda, tipo, modo, desde: desdeInput(), logosExtra,
      progreso: (msg, hechas, total) => estado(total ? `${msg} ${hechas} de ${total}` : msg, total ? hechas / total : 1),
    });
    if (urlActual) URL.revokeObjectURL(urlActual);
    urlActual = URL.createObjectURL(r.blob);
    const mb = (r.blob.size / 1048576).toFixed(1);
    const desc = $('cat-descargar');
    desc.href = urlActual;
    desc.download = r.nombre;
    desc.innerHTML = `<i class="bi bi-download"></i> Descargar (${r.paginas} hojas · ${mb} MB)`;
    $('cat-abrir').href = urlActual;
    $('cat-listo').hidden = false;
    $('cat-vista').innerHTML = `<iframe class="cat-pdf" src="${urlActual}" title="Vista previa del catálogo"></iframe>`;
    if (r.sinFoto.length) $('cat-aviso').textContent = `Sin foto en el panel: ${r.sinFoto.join(', ')}. Súbela en Perfumes para que salga.`;
    const que = tipo === 'novedades' ? 'Hojas de novedades' : 'Catálogo completo';
    estado(`Listo: ${que} ${modo === 'imprenta' ? 'para imprenta' : 'digital'}, ${r.paginas} hojas.`);
    if (tipo === 'completo' && modo === 'imprenta') {
      guardar(CLAVE_ULTIMO, String(Date.now()));
      pintarUltimo();
    }
  } catch (e) {
    estado(`No se pudo armar el PDF: ${e.message}`);
    toast(`No se pudo armar el PDF: ${e.message}`, 'error');
  } finally {
    bloquear(false);
  }
}

document.querySelectorAll('[data-generar]').forEach(b => b.addEventListener('click', () => generar(b.dataset.generar, b.dataset.modo)));
$('nov-desde').addEventListener('change', pintarNovedades);

async function cargar() {
  try {
    const [ps, conf, ms] = await Promise.all([
      getDocs(collection(db, 'perfumes')),
      getDoc(doc(db, 'config', 'tienda')).catch(() => null),
      getDocs(collection(db, 'marcas')).catch(() => null),
    ]);
    perfumes = [];
    ps.forEach(d => perfumes.push({ id: d.id, ...d.data() }));
    const t = conf && conf.exists() ? conf.data() : {};
    tienda = { disable2ml: !!t.disable2ml, proExtra: Number(t.reforzadaVenta) || 0 };
    // Si alguna marca trae su propio logo (campo `logo` con URL), manda sobre el guardado.
    if (ms) ms.forEach(d => { const m = d.data(); if (m.logo && m.nombre) logosExtra[m.nombre] = m.logo; });

    const ultimo = Number(leer(CLAVE_ULTIMO)) || 0;
    $('nov-desde').value = aFecha(ultimo || Date.now() - 30 * DIA);
    pintarResumen();
    pintarUltimo();
    bloquear(false);
  } catch (e) {
    estado(`No se pudieron leer los perfumes: ${e.message}`);
  }
}

cargar();
