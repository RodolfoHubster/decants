/**
 * lienzo-perfume.js — La imagen de un perfume para mandarla cuando alguien
 * pregunta por él: foto, nombre, original del que es dupe, notas, precios y tu
 * logo. 1080×1350 (4:5: WhatsApp e Instagram la muestran completa).
 *
 * Se dibuja en un canvas en el navegador; los datos salen de
 * compartir-perfume.js (puro, con tests). Desde la ventana se comparte (celular),
 * se copia (para pegarla en WhatsApp Web) o se guarda.
 */
import { datosTarjeta, partirLineas } from './compartir-perfume.js?v=2';
import { imgCompartir, imgOPlaceholder } from './cloudinary.js?v=2';
import { toast } from './toast.js';

const W = 1080, H = 1350, M = 76;
const ANCHO = W - 2 * M;
const C = {
  fondoArriba: '#211e1f', fondoAbajo: '#0f0e0e',
  oro: '#c9a84c', oroClaro: '#e2c47e', texto: '#f3eee6', suave: '#a9a397',
  marco: 'rgba(201,168,76,.32)', panel: 'rgba(255,255,255,.04)',
};
const SERIF = '"Playfair Display", Georgia, serif';
const SANS = 'Poppins, "Segoe UI", system-ui, sans-serif';
const LOGO = new URL('../img/LogoOficial2.jpeg', import.meta.url).href;

const espera = ms => new Promise(r => setTimeout(r, ms));

async function cargarFuentes() {
  if (!document.fonts || !document.fonts.load) return;
  const caras = [`600 58px ${SERIF}`, `italic 500 30px ${SERIF}`, `400 24px ${SANS}`,
    `500 24px ${SANS}`, `600 24px ${SANS}`, `700 48px ${SANS}`];
  // Sin internet o sin la fuente, se dibuja con la de respaldo en vez de quedarse esperando.
  await Promise.race([Promise.all(caras.map(f => document.fonts.load(f).catch(() => null))), espera(2500)]);
}

function cargarImagen(src) {
  return new Promise(res => {
    if (!src) { res(null); return; }
    const img = new Image();
    // Sin esto el canvas queda "manchado" y ya no se puede exportar.
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/**
 * El logo trae su fondo negro: se recorta la palabra (con la espiral) y el
 * fondo se vuelve transparente según qué tan claro es cada pixel.
 */
let logoListo = null;
export function logoSinFondo() {
  logoListo = logoListo || cargarImagen(LOGO).then(img => {
    if (!img) return null;
    const k = img.naturalWidth / 570;
    const [x, y, w, h] = [60, 105, 448, 286].map(v => Math.round(v * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    cx.drawImage(img, x, y, w, h, 0, 0, w, h);
    const datos = cx.getImageData(0, 0, w, h);
    const px = datos.data, FONDO = 29;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
      const a = Math.max(0, Math.min(1, (lum - 36) / 110));
      // Quita el negro mezclado en los bordes para que no quede un halo oscuro.
      if (a > 0.02) for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, Math.max(0, (px[i + c] - FONDO * (1 - a)) / a));
      px[i + 3] = Math.round(a * 255);
    }
    cx.putImageData(datos, 0, 0);
    return cv;
  });
  return logoListo;
}

function caminoRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fuente(ctx, f, espacio = 0) {
  ctx.font = f;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${espacio}px`;
}

function fondo(ctx, centroFoto) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.fondoArriba);
  g.addColorStop(1, C.fondoAbajo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const [cx, cy] = centroFoto;
  const brillo = ctx.createRadialGradient(cx, cy, 40, cx, cy, 620);
  brillo.addColorStop(0, 'rgba(201,168,76,.16)');
  brillo.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.marco;
  ctx.lineWidth = 2;
  caminoRedondo(ctx, 30, 30, W - 60, H - 60, 26);
  ctx.stroke();
}

function dibujarFoto(ctx, img, x, y, s) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  caminoRedondo(ctx, x, y, s, s, 30);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  if (img) {
    ctx.save();
    caminoRedondo(ctx, x, y, s, s, 30);
    ctx.clip();
    // "contain": la de Cloudinary ya viene cuadrada; las de otros sitios no, y
    // los huecos se rellenan con la misma foto difuminada en vez de blanco.
    const ratio = img.naturalWidth / img.naturalHeight;
    if (Math.abs(ratio - 1) > 0.02 && 'filter' in ctx) {
      const kc = Math.max(s / img.naturalWidth, s / img.naturalHeight);
      const wc = img.naturalWidth * kc, hc = img.naturalHeight * kc;
      ctx.filter = 'blur(26px) brightness(.75)';
      ctx.drawImage(img, x + (s - wc) / 2 - 30, y + (s - hc) / 2 - 30, wc + 60, hc + 60);
      ctx.filter = 'none';
    }
    const k = Math.min(s / img.naturalWidth, s / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, x + (s - w) / 2, y + (s - h) / 2, w, h);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(201,168,76,.45)';
  ctx.lineWidth = 2;
  caminoRedondo(ctx, x, y, s, s, 30);
  ctx.stroke();
}

/** Marca, nombre, "inspirado en" y rasgos, centrados a lo alto de la foto. */
function columnaDerecha(ctx, d, x, top, ancho, alto) {
  const bloques = [];
  const medirCon = f => { fuente(ctx, f); return s => ctx.measureText(s).width; };

  if (d.marca) bloques.push({ f: `600 22px ${SANS}`, esp: 5, color: C.oro, lineas: [d.marca.toUpperCase()], lh: 32, gap: 0 });

  // Nombres largos bajan de tamaño antes de cortarse (máximo 3 renglones).
  const tam = [58, 50, 42].find(t => partirLineas(d.nombre, medirCon(`600 ${t}px ${SERIF}`), ancho).length <= 3) || 42;
  const nombre = partirLineas(d.nombre, medirCon(`600 ${tam}px ${SERIF}`), ancho, 3);
  bloques.push({ f: `600 ${tam}px ${SERIF}`, color: C.texto, lineas: nombre, lh: Math.round(tam * 1.14), gap: 12 });

  if (d.inspirado) {
    bloques.push({ f: `600 17px ${SANS}`, esp: 3, color: C.oro, lineas: ['INSPIRADO EN'], lh: 26, gap: 26 });
    bloques.push({ f: `400 25px ${SANS}`, color: C.texto, lineas: partirLineas(d.inspirado, medirCon(`400 25px ${SANS}`), ancho, 2), lh: 34, gap: 4 });
  }
  const altoDe = bs => bs.reduce((t, b) => t + b.gap + b.lineas.length * b.lh, 0);

  const rasgos = d.rasgos.slice(0, 4);
  if (rasgos.length && altoDe(bloques) + 26 + rasgos.length * 34 <= alto) {
    bloques.push({ f: `400 22px ${SANS}`, color: C.suave, lineas: rasgos, lh: 34, gap: 26, punto: true });
  }

  let y = top + Math.max(0, (alto - altoDe(bloques)) / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const b of bloques) {
    y += b.gap;
    fuente(ctx, b.f, b.esp || 0);
    for (const l of b.lineas) {
      if (b.punto) {
        ctx.fillStyle = C.oro;
        ctx.beginPath();
        ctx.arc(x + 5, y + b.lh / 2 - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.fillText(l, x + 22, y);
      } else {
        ctx.fillStyle = b.color;
        ctx.fillText(l, x, y);
      }
      y += b.lh;
    }
  }
  fuente(ctx, `400 20px ${SANS}`, 0);
}

/** Frase, pirámide, precios y PRO, centrados entre la foto y el pie. */
function seccionMedia(ctx, d, desde, hasta) {
  const medirCon = f => { fuente(ctx, f); return s => ctx.measureText(s).width; };
  const GAP = 30;
  const piramide = d.piramide.slice(0, 3);
  const altoPiramide = piramide.length ? 40 + piramide.length * 50 : 0;
  const conAhorro = d.tallas.some(t => t.ahorro > 0);
  const altoPrecios = d.tallas.length ? (conAhorro ? 146 : 118) : 0;
  const altoPro = d.pro ? 34 : 0;

  const fijo = [altoPiramide, altoPrecios, altoPro].filter(Boolean);
  const disponible = hasta - desde;
  const fFrase = `italic 500 30px ${SERIF}`;
  // La frase se acorta (o se quita) si no cabe todo.
  let frase = [];
  for (let max = piramide.length ? 2 : 4; max >= 1; max--) {
    frase = partirLineas(d.frase, medirCon(fFrase), ANCHO - 40, max);
    const total = frase.length * 42 + fijo.reduce((a, b) => a + b, 0) + GAP * (fijo.length + (frase.length ? 1 : 0) - 1);
    if (total <= disponible) break;
    frase = [];
  }
  const bloques = [frase.length ? frase.length * 42 : 0, altoPiramide, altoPrecios, altoPro].filter(Boolean);
  const total = bloques.reduce((a, b) => a + b, 0) + GAP * Math.max(0, bloques.length - 1);
  let y = desde + Math.max(0, (disponible - total) / 2);

  ctx.textBaseline = 'top';
  if (frase.length) {
    fuente(ctx, fFrase);
    ctx.fillStyle = C.suave;
    ctx.textAlign = 'center';
    for (const l of frase) { ctx.fillText(l, W / 2, y); y += 42; }
    y += GAP;
  }

  if (piramide.length) {
    ctx.fillStyle = C.panel;
    caminoRedondo(ctx, M, y, ANCHO, altoPiramide, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const colNotas = M + 28 + 158;
    const anchoNotas = W - M - 28 - colNotas;
    let yy = y + 24;
    for (const t of piramide) {
      ctx.textAlign = 'left';
      fuente(ctx, `600 18px ${SANS}`, 3);
      ctx.fillStyle = C.oro;
      ctx.fillText(t.etiqueta.toUpperCase(), M + 28, yy + 15);
      const [notas] = partirLineas(t.notas, medirCon(`400 25px ${SANS}`), anchoNotas, 1);
      fuente(ctx, `400 25px ${SANS}`);
      ctx.fillStyle = C.texto;
      ctx.fillText(notas || '', colNotas, yy + 9);
      yy += 50;
    }
    y += altoPiramide + GAP;
  }

  if (d.tallas.length) {
    const n = d.tallas.length, sep = 16;
    const ancho = (ANCHO - sep * (n - 1)) / n;
    const mayor = Math.max(...d.tallas.map(t => t.ahorro));
    d.tallas.forEach((t, i) => {
      const x = M + i * (ancho + sep);
      const destaca = mayor > 0 && t.ahorro === mayor;
      caminoRedondo(ctx, x, y, ancho, altoPrecios, 20);
      ctx.fillStyle = destaca ? 'rgba(201,168,76,.15)' : C.panel;
      ctx.fill();
      ctx.strokeStyle = destaca ? C.oro : 'rgba(201,168,76,.4)';
      ctx.lineWidth = destaca ? 2.5 : 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      fuente(ctx, `500 23px ${SANS}`);
      ctx.fillStyle = C.suave;
      ctx.fillText(`${t.ml} ml`, x + ancho / 2, y + 20);
      fuente(ctx, `700 ${n > 4 ? 40 : 46}px ${SANS}`);
      ctx.fillStyle = destaca ? C.oroClaro : C.texto;
      ctx.fillText(`$${t.precio}`, x + ancho / 2, y + 52);
      if (t.ahorro > 0) {
        fuente(ctx, `600 ${n > 4 ? 16 : 18}px ${SANS}`);
        ctx.fillStyle = C.oroClaro;
        ctx.fillText(`ahorras $${t.ahorro}`, x + ancho / 2, y + 110);
      }
    });
    y += altoPrecios + GAP;
  }

  if (d.pro) {
    const etiqueta = 'PRO';
    const texto = `Envase reforzado de color · ${unirTallas(d.pro.tallas)} ml · +$${d.pro.extra}`;
    fuente(ctx, `700 17px ${SANS}`, 2);
    const wTag = ctx.measureText(etiqueta).width + 22;
    fuente(ctx, `400 22px ${SANS}`);
    const wTxt = ctx.measureText(texto).width;
    const x0 = (W - (wTag + 14 + wTxt)) / 2;
    caminoRedondo(ctx, x0, y + 1, wTag, 30, 8);
    ctx.fillStyle = C.oro;
    ctx.fill();
    ctx.textAlign = 'left';
    fuente(ctx, `700 17px ${SANS}`, 2);
    ctx.fillStyle = '#17150f';
    ctx.fillText(etiqueta, x0 + 11, y + 6);
    fuente(ctx, `400 22px ${SANS}`);
    ctx.fillStyle = C.suave;
    ctx.fillText(texto, x0 + wTag + 14, y + 2);
  }
}

const unirTallas = ts => (ts.length > 1 ? `${ts.slice(0, -1).join(', ')} y ${ts[ts.length - 1]}` : ts[0]);

function pie(ctx, logo, d, y) {
  ctx.strokeStyle = C.marco;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  if (logo) {
    const h = 92, w = h * logo.width / logo.height;
    ctx.drawImage(logo, M - 6, y + 22, w, h);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  fuente(ctx, `600 28px ${SANS}`, 1);
  ctx.fillStyle = C.oro;
  ctx.fillText(d.sitio, W - M, y + 34);
  fuente(ctx, `400 21px ${SANS}`);
  ctx.fillStyle = C.suave;
  ctx.fillText('Decants originales · Tijuana', W - M, y + 78);
}

/** Dibuja la imagen y devuelve el canvas. */
export async function dibujarTarjeta(d) {
  await cargarFuentes();
  const [foto, logo] = await Promise.all([
    cargarImagen(d.imagen ? imgCompartir(d.imagen) : ''),
    logoSinFondo(),
  ]);
  // Sin foto (o de un sitio que no deja usarla): el frasco del modo ahorro.
  const img = foto || await cargarImagen(imgOPlaceholder('', u => u));

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const S = 460, TOP = 84;
  const yPie = H - 160;
  fondo(ctx, [M + S / 2, TOP + S / 2]);
  dibujarFoto(ctx, img, M, TOP, S);
  const xDer = M + S + 44;
  columnaDerecha(ctx, d, xDer, TOP, W - M - xDer, S);
  seccionMedia(ctx, d, TOP + S + 48, yPie - 34);
  pie(ctx, logo, d, yPie);
  return cv;
}

// ── Ventana: vista, compartir, copiar y guardar ──────────────────────────
let modal = null;
let actual = null;   // { cv, file, url, datos }
let turno = 0;

const comoBlob = (cv, tipo, calidad) => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('No se pudo armar la imagen'))), tipo, calidad));

function cerrar() {
  modal.classList.remove('open');
  turno++;
}

const acciones = {
  async compartir() {
    if (!actual) return;
    try {
      await navigator.share({ files: [actual.file], title: actual.datos.nombre });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('No se pudo compartir: ' + e.message, 'error');
    }
  },
  async copiar() {
    if (!actual) return;
    try {
      // El portapapeles solo acepta PNG; se pasa la promesa para no perder el permiso del toque.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': comoBlob(actual.cv, 'image/png') })]);
      toast('Imagen copiada: pégala en el chat', 'success');
    } catch (e) {
      toast('Este navegador no dejó copiar la imagen; usa Guardar', 'error');
    }
  },
  guardar() {
    if (!actual) return;
    const a = document.createElement('a');
    a.href = actual.url;
    a.download = actual.datos.archivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};

function asegurarModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal-overlay imgp';
  modal.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="imgp-titulo">
      <div class="modal-header"><h4 id="imgp-titulo">Imagen para compartir</h4>
        <button class="btn-icon" data-cerrar aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>
      <div class="modal-body">
        <div class="imgp-vista"></div>
        <p class="imgp-nota"></p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" data-accion="guardar"><i class="bi bi-download"></i> Guardar</button>
        <button class="btn btn-outline" data-accion="copiar"><i class="bi bi-copy"></i> Copiar</button>
        <button class="btn btn-primary" data-accion="compartir"><i class="bi bi-share"></i> Compartir</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-cerrar]')) { cerrar(); return; }
    const b = e.target.closest('[data-accion]');
    if (b && !b.disabled) acciones[b.dataset.accion]();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) cerrar();
  });
  return modal;
}

/**
 * Abre la ventana con la imagen del perfume.
 * @param {object} p  el perfume como está en Firestore
 * @param {{disable2ml?:boolean, proExtra?:number}} [opciones]  lo de config/tienda
 */
export async function abrirImagenPerfume(p, opciones = {}) {
  const m = asegurarModal();
  const mio = ++turno;
  const vista = m.querySelector('.imgp-vista');
  const nota = m.querySelector('.imgp-nota');
  const botones = m.querySelectorAll('[data-accion]');
  if (actual) URL.revokeObjectURL(actual.url);
  actual = null;
  vista.innerHTML = '<i class="esq imgp-esq" aria-hidden="true"></i>';
  nota.textContent = '';
  botones.forEach(b => { b.disabled = true; b.hidden = false; });
  m.classList.add('open');

  try {
    const datos = datosTarjeta(p, opciones);
    const cv = await dibujarTarjeta(datos);
    const blob = await comoBlob(cv, 'image/jpeg', 0.92);
    if (mio !== turno) return;   // se cerró o se abrió otro mientras se armaba
    const file = new File([blob], datos.archivo, { type: 'image/jpeg' });
    actual = { cv, file, url: URL.createObjectURL(blob), datos };
    vista.innerHTML = `<img src="${actual.url}" alt="${datos.nombre.replace(/"/g, '&quot;')}">`;

    const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const puedeCopiar = !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    m.querySelector('[data-accion="compartir"]').hidden = !puedeCompartir;
    m.querySelector('[data-accion="copiar"]').hidden = !puedeCopiar;
    botones.forEach(b => { b.disabled = false; });
    if (!datos.tallas.length) nota.textContent = 'Este perfume no tiene precios: la imagen sale sin ellos.';
  } catch (e) {
    if (mio !== turno) return;
    vista.innerHTML = '';
    nota.textContent = 'No se pudo armar la imagen: ' + e.message;
  }
}
