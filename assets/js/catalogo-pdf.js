/**
 * catalogo-pdf.js — Dibuja el catálogo en PDF con jsPDF a partir de lo que arma
 * catalogo-paginas.js (puro, con tests). Hoja carta, fondo oscuro de orilla a
 * orilla (sin bordes blancos), letras de la tienda (Poppins y Playfair).
 *
 * Dos modos:
 *  - digital: fotos ligeras, índice y tarjetas con links (a la hoja / al perfume).
 *  - imprenta: fotos en alta y 3 mm de sangrado por lado para que la imprenta
 *    corte sin dejar orilla blanca.
 *
 * Necesita en la página: jsPDF (window.jspdf) y qrcode-generator (window.qrcode).
 */
import { armarCatalogo, rangoMarcas, fechaLarga, edicion, archivoLogo, CONSEJOS, REDES, nombreArchivo } from './catalogo-paginas.js';
import { partirLineas } from './compartir-perfume.js?v=2';
import { imgCuadrada } from './cloudinary.js?v=3';
import { logoSinFondo } from './lienzo-perfume.js?v=3';
import { COLORES_PRO } from './pro.js';

const PW = 215.9, PH = 279.4;          // carta, en mm
const M = 14;                          // margen del contenido
const SANGRADO = 3;
const PT = 0.3528;                     // 1 pt en mm
const C = {
  texto: '#f3eee6', suave: '#aaa498', tenue: '#7d776d', oro: '#c9a84c', oroClaro: '#e2c47e',
  oscuro: '#141213', crema: '#f6f1e7',
};
const MODOS = {
  digital: { px: 420, calidad: 0.82, fondoPx: 5, sangrado: 0 },
  imprenta: { px: 760, calidad: 0.9, fondoPx: 8, sangrado: SANGRADO },
};
const FUENTES = {
  Poppins: 'Poppins_400Regular', PoppinsM: 'Poppins_500Medium', PoppinsSB: 'Poppins_600SemiBold',
  PoppinsB: 'Poppins_700Bold', Playfair: 'PlayfairDisplay_600SemiBold', PlayfairI: 'PlayfairDisplay_500Medium_Italic',
};

// ── Recursos (se bajan una vez por sesión) ─────────────────────────────────
const enBase64 = buf => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
let fuentesListas = null;
function cargarFuentes() {
  fuentesListas = fuentesListas || Promise.all(Object.entries(FUENTES).map(async ([fam, archivo]) => {
    const r = await fetch(new URL(`../fonts/${archivo}.ttf`, import.meta.url));
    if (!r.ok) throw new Error(`No se pudo bajar la fuente ${archivo}`);
    return [fam, archivo, enBase64(await r.arrayBuffer())];
  }));
  return fuentesListas.catch(e => { fuentesListas = null; throw e; });
}

function cargarImagen(src) {
  return new Promise(res => {
    if (!src) { res(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** Foto cuadrada en JPG; las que no vienen cuadradas se rellenan con la misma foto difuminada. */
async function fotoCuadrada(url, px, calidad) {
  const img = await cargarImagen(url ? imgCuadrada(url, px) : '');
  if (!img) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, px, px);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (Math.abs(iw / ih - 1) > 0.02 && 'filter' in ctx) {
    const k = Math.max(px / iw, px / ih);
    ctx.filter = 'blur(18px) brightness(.75)';
    ctx.drawImage(img, (px - iw * k) / 2 - 20, (px - ih * k) / 2 - 20, iw * k + 40, ih * k + 40);
    ctx.filter = 'none';
  }
  const k = Math.min(px / iw, px / ih);
  ctx.drawImage(img, (px - iw * k) / 2, (px - ih * k) / 2, iw * k, ih * k);
  try { return cv.toDataURL('image/jpeg', calidad); } catch { return null; }
}

/** Fondo oscuro con brillo dorado, como imagen (jsPDF no hace degradados). */
function fondo(anchoMm, altoMm, pxPorMm, brillo) {
  const w = Math.round(anchoMm * pxPorMm), h = Math.round(altoMm * pxPorMm);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#201d1e');
  g.addColorStop(1, '#0f0e0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const [cy, r, a] = brillo;
  const rg = ctx.createRadialGradient(w / 2, h * cy, 10, w / 2, h * cy, w * r);
  rg.addColorStop(0, `rgba(201,168,76,${a})`);
  rg.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.9);
}

/**
 * Logo de una marca en dorado sobre transparente, recortado a su silueta.
 * Sirve para los de assets/img/marcas (silueta blanca) y para cualquier otro
 * (de fondo transparente, o de fondo liso: lo que se aleja del fondo es el logo).
 */
async function logoDorado(src) {
  const img = await cargarImagen(src);
  if (!img) return null;
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  let datos;
  try { datos = ctx.getImageData(0, 0, w, h); } catch { return null; }
  const px = datos.data;
  const lum = i => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
  let transparente = false;
  for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 250) { transparente = true; break; }
  const fondo = lum(0);
  const masc = new Float32Array(w * h);
  let mayor = 0;
  for (let j = 0; j < w * h; j++) {
    const i = j * 4;
    masc[j] = transparente ? px[i + 3] : Math.abs(lum(i) - fondo);
    if (masc[j] > mayor) mayor = masc[j];
  }
  if (!mayor) return null;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const [r, g, b] = rgb(C.oro);
  for (let j = 0; j < w * h; j++) {
    const a = Math.round(masc[j] * 255 / mayor), i = j * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
    if (a > 24) {
      const x = j % w, y = (j - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  ctx.putImageData(datos, 0, 0);
  // Hasta 600 px de ancho: de sobra para 5 cm impresos y pesa menos.
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, 600 / cw);
  const out = document.createElement('canvas');
  out.width = Math.round(cw * k); out.height = Math.max(1, Math.round(ch * k));
  out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, out.width, out.height);
  return { data: out.toDataURL('image/png'), w: out.width, h: out.height };
}

/** Los logos de las marcas del catálogo: `extras` (marca → URL) manda sobre los guardados. */
async function cargarLogos(marcas, extras = {}) {
  const logos = new Map();
  await enParalelo([...marcas], 6, async m => {
    const archivo = archivoLogo(m);
    const src = extras[m] || (archivo ? new URL(`../img/marcas/${archivo}`, import.meta.url).href : '');
    if (!src) return;
    const l = await logoDorado(src);
    if (l) logos.set(m, l);
  });
  return logos;
}

/** Pool sencillo: corre `fn` sobre la lista, `n` a la vez. */
async function enParalelo(lista, n, fn) {
  let i = 0;
  const trabajador = async () => { while (i < lista.length) { const j = i++; await fn(lista[j], j); } };
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, trabajador));
}

// ── Dibujo ─────────────────────────────────────────────────────────────────
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

function crearLapiz(doc, B) {
  const opac = {};
  const L = {
    doc,
    X: x => x + B,
    Y: y => y + B,
    alfa(o) { doc.setGState(opac[o] || (opac[o] = new doc.GState({ opacity: o, 'stroke-opacity': o }))); },
    fuente(fam, pt, color = C.texto, esp = 0) {
      doc.setFont(fam, 'normal');
      doc.setFontSize(pt);
      doc.setTextColor(...rgb(color));
      doc.setCharSpace(esp);
    },
    ancho(s, esp = 0) { return doc.getTextWidth(s) + esp * Math.max(0, s.length - 1); },
    /** Texto con baseline arriba; align con espaciado calculado a mano. */
    texto(s, x, y, { fam = 'Poppins', pt = 9, color = C.texto, esp = 0, align = 'left' } = {}) {
      L.fuente(fam, pt, color, esp);
      const w = L.ancho(s, esp);
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      doc.text(s, L.X(x0), L.Y(y), { baseline: 'top' });
      return w;
    },
    /** Varios renglones; devuelve el alto usado. */
    parrafo(s, x, y, ancho, { fam = 'Poppins', pt = 9, color = C.texto, max = Infinity, lh = 1.35, align = 'left' } = {}) {
      L.fuente(fam, pt, color);
      const lineas = partirLineas(s, t => doc.getTextWidth(t), ancho, max);
      const alto = pt * PT * lh;
      lineas.forEach((l, i) => L.texto(l, align === 'center' ? x + ancho / 2 : x, y + i * alto, { fam, pt, color, align }));
      return lineas.length * alto;
    },
    caja(x, y, w, h, r, { relleno = null, alfaRelleno = 1, borde = null, alfaBorde = 1, grosor = 0.25 } = {}) {
      if (relleno) {
        L.alfa(alfaRelleno);
        doc.setFillColor(...rgb(relleno));
        doc.roundedRect(L.X(x), L.Y(y), w, h, r, r, 'F');
      }
      if (borde) {
        L.alfa(alfaBorde);
        doc.setDrawColor(...rgb(borde));
        doc.setLineWidth(grosor);
        doc.roundedRect(L.X(x), L.Y(y), w, h, r, r, 'S');
      }
      L.alfa(1);
    },
    linea(x1, y1, x2, y2, color = C.oro, alfa = 0.5, grosor = 0.25) {
      L.alfa(alfa);
      doc.setDrawColor(...rgb(color));
      doc.setLineWidth(grosor);
      doc.line(L.X(x1), L.Y(y1), L.X(x2), L.Y(y2));
      L.alfa(1);
    },
    /** Imagen recortada con esquinas redondeadas. */
    foto(data, x, y, s, r, alias) {
      if (!data) {
        L.caja(x, y, s, s, r, { relleno: '#1e1c1c', borde: C.oro, alfaBorde: 0.4 });
        L.texto('Fito Scents', x + s / 2, y + s / 2 - 2, { fam: 'PlayfairI', pt: 9, color: C.tenue, align: 'center' });
        return;
      }
      doc.saveGraphicsState();
      doc.roundedRect(L.X(x), L.Y(y), s, s, r, r, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(data, 'JPEG', L.X(x), L.Y(y), s, s, alias, 'FAST');
      doc.restoreGraphicsState();
    },
    link(x, y, w, h, destino) {
      if (destino) doc.link(L.X(x), L.Y(y), w, h, destino);
    },
    adorno(cx, y, ancho = 60) {
      L.linea(cx - ancho / 2, y, cx - 3, y, C.oro, 0.6);
      L.linea(cx + 3, y, cx + ancho / 2, y, C.oro, 0.6);
      doc.setFillColor(...rgb(C.oro));
      const d = 1.3;
      doc.lines([[d, d], [d, -d], [-d, -d]], L.X(cx - d), L.Y(y), [1, 1], 'F', true);
    },
  };
  return L;
}

function qr(L, texto, x, y, lado) {
  if (!window.qrcode) return;
  const q = window.qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  const pad = lado * 0.08;
  L.caja(x, y, lado, lado, 2, { relleno: C.crema });
  const m = (lado - 2 * pad) / n;
  L.doc.setFillColor(...rgb(C.oscuro));
  // Cuadritos seguidos de un renglón en un solo rectángulo, y encimados un pelo:
  // así no se ven rayitas blancas entre ellos al imprimir ni en pantalla.
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c)) continue;
      let fin = c;
      while (fin + 1 < n && q.isDark(r, fin + 1)) fin++;
      L.doc.rect(L.X(x + pad + c * m), L.Y(y + pad + r * m), (fin - c + 1) * m + 0.06, m + 0.06, 'F');
      c = fin;
    }
  }
  L.link(x, y, lado, lado, { url: texto });
}

function marcoYFondo(L, ctx, portada = false) {
  const { doc } = L;
  const B = ctx.B;
  doc.addImage(portada ? ctx.fondoPortada : ctx.fondo, 'JPEG', 0, 0, PW + 2 * B, PH + 2 * B, portada ? 'fondo-portada' : 'fondo', 'FAST');
  L.alfa(0.35);
  doc.setDrawColor(...rgb(C.oro));
  doc.setLineWidth(0.3);
  doc.roundedRect(L.X(7), L.Y(7), PW - 14, PH - 14, 4, 4, 'S');
  L.alfa(1);
}

function cabeza(L, titulo, derecha) {
  L.texto(titulo, M, 14.5, { fam: 'Playfair', pt: 20 });
  if (derecha) L.texto(derecha.toUpperCase(), PW - M, 19, { fam: 'PoppinsSB', pt: 6.5, color: C.oro, esp: 0.45, align: 'right' });
  L.linea(M, 28, PW - M, 28, C.oro, 0.45);
}

function pie(L, ctx, numero) {
  const y = PH - 17.5;
  L.linea(M, y - 2.5, PW - M, y - 2.5, C.oro, 0.3);
  L.texto(`fitoscents.com  ·  Precios al ${ctx.fechaCorta}`, M, y, { pt: 6.6, color: C.tenue });
  L.link(M, y - 1, 26, 5, { url: 'https://fitoscents.com/' });
  if (ctx.proExtra > 0) {
    L.texto(`PRO: envase reforzado de color en 5 y 10 ml, +$${ctx.proExtra}`, PW / 2 + 8, y, { pt: 6.6, color: C.tenue, align: 'center' });
  }
  L.texto(String(numero), PW - M, y - 1.2, { fam: 'Playfair', pt: 11, color: C.oro, align: 'right' });
}

/**
 * El logo de la marca en una caja de `ancho` × `alto` (los anchos y bajitos se
 * ven más chicos, los cuadrados más altos); sin logo, el nombre en la letra de la
 * tienda. Devuelve el alto usado.
 */
function cajaLogo(logo, ancho, alto) {
  const prop = logo.w / logo.h;
  let h = prop < 2.5 ? alto * 1.45 : prop < 5 ? alto * 1.15 : alto, w = h * prop;
  if (w > ancho) { w = ancho; h = w / prop; }
  return { w, h };
}

/** El alto que ocupará la marca, sin dibujarla. */
/** El nombre en mayúsculas, en los renglones que quepan (sin logo). */
function lineasMarca(L, nombre, ancho, pt, max) {
  const esp = pt * 0.06;
  L.fuente('Playfair', pt, C.oro, esp);
  return partirLineas(nombre.toUpperCase(), t => L.ancho(t, esp), ancho, max);
}

function medirMarca(L, ctx, nombre, ancho, { alto = 4.4, pt = 7, lineas = 1 } = {}) {
  const logo = ctx.logos && ctx.logos.get(nombre);
  return logo ? cajaLogo(logo, ancho, alto).h : lineasMarca(L, nombre, ancho, pt, lineas).length * pt * PT * 1.15;
}

function marca(L, ctx, nombre, x, y, ancho, { alto = 4.4, pt = 7, align = 'left', lineas = 1 } = {}) {
  const logo = ctx.logos && ctx.logos.get(nombre);
  if (logo) {
    const { w, h } = cajaLogo(logo, ancho, alto);
    const x0 = align === 'center' ? x + (ancho - w) / 2 : x;
    L.doc.addImage(logo.data, 'PNG', L.X(x0), L.Y(y), w, h, `logo-${nombre}`, 'FAST');
    return h;
  }
  const esp = pt * 0.06, lh = pt * PT * 1.15;
  const ls = lineasMarca(L, nombre, ancho, pt, lineas);
  ls.forEach((l, i) => L.texto(l, align === 'center' ? x + ancho / 2 : x, y + 0.3 + i * lh, { fam: 'Playfair', pt, color: C.oro, esp, align }));
  return ls.length * lh;
}

function tarjeta(L, ctx, t, x, y, w, h, conGenero) {
  L.caja(x, y, w, h, 3, { relleno: '#ffffff', alfaRelleno: 0.045, borde: C.oro, alfaBorde: 0.3 });
  const pad = 3, s = w - 2 * pad;
  L.foto(ctx.fotos.get(t.id), x + pad, y + pad, s, 2.2, `foto-${t.id}`);
  if (conGenero) {
    const etiqueta = { mujer: 'MUJER', hombre: 'HOMBRE', unisex: 'UNISEX' }[t.seccion] || '';
    L.fuente('PoppinsB', 5, C.oscuro, 0.3);
    const we = L.ancho(etiqueta, 0.3) + 4;
    L.caja(x + pad + 2, y + pad + 2, we, 4.4, 1.2, { relleno: C.oro });
    L.texto(etiqueta, x + pad + 4, y + pad + 3.1, { fam: 'PoppinsB', pt: 5, color: C.oscuro, esp: 0.3 });
  }

  let ty = y + pad + s + 3.6;
  ty += marca(L, ctx, t.marca, x + pad, ty, s) + 2;

  L.fuente('Playfair', 11.5);
  const largo = partirLineas(t.nombre, q => L.doc.getTextWidth(q), s).length > 2;
  const ptNombre = largo ? 9.8 : 11.5;
  ty += L.parrafo(t.nombre, x + pad, ty, s, { fam: 'Playfair', pt: ptNombre, max: 2, lh: 1.12 }) + 1;

  if (t.inspirado) {
    ty += L.parrafo(`Inspirado en ${t.inspirado}`, x + pad, ty, s, { fam: 'PoppinsM', pt: 6, color: C.oroClaro, max: 2, lh: 1.3 }) + 1.1;
  }
  // Precios abajo; lo que quede de espacio arriba de ellos se usa para notas,
  // duración/estela o (si no hay notas) la frase del perfume.
  const hp = 13, yp = y + h - pad - hp, limite = yp - 2;
  const cabe = (lineas, pt, lh) => Math.max(0, Math.floor((limite - ty) / (pt * PT * lh)));
  if (t.notas.length) {
    ty += L.parrafo(t.notas.join(' · '), x + pad, ty, s, { pt: 6.3, color: C.suave, max: Math.min(3, cabe(3, 6.3, 1.3)), lh: 1.3 }) + 1.4;
  } else if (t.frase) {
    ty += L.parrafo(t.frase, x + pad, ty, s, { fam: 'PlayfairI', pt: 7.4, color: C.suave, max: Math.min(4, cabe(4, 7.4, 1.3)), lh: 1.3 }) + 1.4;
  }
  if (t.rasgos.length && limite - ty >= 3) {
    L.texto(t.rasgos.join('  ·  '), x + pad, ty, { fam: 'PoppinsM', pt: 5.8, color: C.tenue });
  }

  // Precios: una pastilla por tamaño; la de más ahorro, en dorado.
  const n = t.tallas.length;
  if (n) {
    const sep = 1.5, wp = (s - sep * (n - 1)) / n;
    const mayor = Math.max(...t.tallas.map(q => q.ahorro));
    t.tallas.forEach((q, i) => {
      const xp = x + pad + i * (wp + sep);
      const destaca = mayor > 0 && q.ahorro === mayor;
      L.caja(xp, yp, wp, hp, 1.6, destaca
        ? { relleno: C.oro, alfaRelleno: 0.16, borde: C.oro, alfaBorde: 0.95, grosor: 0.3 }
        : { relleno: '#ffffff', alfaRelleno: 0.05, borde: C.oro, alfaBorde: 0.35 });
      const cx = xp + wp / 2;
      L.texto(`${q.ml} ml`, cx, yp + 1.5, { fam: 'PoppinsM', pt: 5.6, color: C.suave, align: 'center' });
      L.texto(`$${q.precio}`, cx, yp + 4.1, { fam: 'PoppinsB', pt: n > 4 ? 8.2 : 9.2, color: destaca ? C.oroClaro : C.texto, align: 'center' });
      if (q.ahorro > 0) {
        L.fuente('PoppinsSB', 4.6);
        const largoA = `ahorras $${q.ahorro}`;
        const txt = L.ancho(largoA) <= wp - 1 ? largoA : `−$${q.ahorro}`;
        L.texto(txt, cx, yp + 9.2, { fam: 'PoppinsSB', pt: 4.6, color: C.oroClaro, align: 'center' });
      }
    });
  }
  L.link(x, y, w, h, { url: t.link });
}

function tarjetaDato(L, d, x, y, w, h) {
  if (d.invitacion) L.link(x, y, w, h, { url: 'https://wa.me/526648162623' });
  L.caja(x, y, w, h, 3, { relleno: C.oro, alfaRelleno: 0.06, borde: C.oro, alfaBorde: 0.45 });
  const pad = 5, ancho = w - 2 * pad;
  L.fuente('Playfair', 13);
  const lt = partirLineas(d.titulo, q => L.doc.getTextWidth(q), ancho, 3).length;
  L.fuente('Poppins', 8);
  const lx = partirLineas(d.texto, q => L.doc.getTextWidth(q), ancho, 12).length;
  const alto = 4 + 3 + lt * 13 * PT * 1.15 + 3 + lx * 8 * PT * 1.5;
  let ty = y + Math.max(pad, (h - alto) / 2);
  L.texto(d.invitacion ? 'FITO SCENTS' : 'DATO CURIOSO', x + pad, ty, { fam: 'PoppinsSB', pt: 6, color: C.oro, esp: 0.6 });
  ty += 7;
  ty += L.parrafo(d.titulo, x + pad, ty, ancho, { fam: 'Playfair', pt: 13, max: 3, lh: 1.15 }) + 3;
  L.parrafo(d.texto, x + pad, ty, ancho, { pt: 8, color: C.suave, max: 12, lh: 1.5 });
}

function cajaDato(L, d, x, y, w) {
  const pad = 7;
  L.fuente('Poppins', 9);
  const lineas = partirLineas(d.texto, q => L.doc.getTextWidth(q), w - 2 * pad, 6).length;
  const h = pad + 4 + 9 + lineas * 9 * PT * 1.5 + pad;
  L.caja(x, y, w, h, 3, { relleno: C.oro, alfaRelleno: 0.06, borde: C.oro, alfaBorde: 0.45 });
  L.texto('DATO CURIOSO', x + pad, y + pad, { fam: 'PoppinsSB', pt: 6.5, color: C.oro, esp: 0.6 });
  L.texto(d.titulo, x + pad, y + pad + 4.5, { fam: 'Playfair', pt: 14 });
  L.parrafo(d.texto, x + pad, y + pad + 13.5, w - 2 * pad, { pt: 9, color: C.suave, lh: 1.5 });
  return h;
}

/** Fila de fotos centrada con el nombre abajo (portada y portadillas). */
function filaFotos(L, ctx, items, y, lado, conNombre = true) {
  if (!items.length) return 0;
  const sep = 8;
  const total = items.length * lado + (items.length - 1) * sep;
  items.forEach((t, i) => {
    const x = (PW - total) / 2 + i * (lado + sep);
    L.foto(ctx.fotos.get(t.id), x, y, lado, 3, `foto-${t.id}`);
    L.caja(x, y, lado, lado, 3, { borde: C.oro, alfaBorde: 0.55, grosor: 0.3 });
    if (conNombre) {
      L.parrafo(t.nombre, x, y + lado + 3, lado, { fam: 'Playfair', pt: 9.5, max: 2, lh: 1.15, align: 'center' });
      marca(L, ctx, t.marca, x, y + lado + 11, lado, { alto: 3.4, pt: 6, align: 'center' });
    }
    L.link(x, y, lado, lado, { url: t.link });
  });
  return lado + (conNombre ? 16 : 0);
}

// ── Hojas ──────────────────────────────────────────────────────────────────
const HOJAS = {
  portada(L, ctx, p) {
    marcoYFondo(L, ctx, true);
    if (ctx.logo) {
      const w = 84, h = w * ctx.logo.h / ctx.logo.w;
      L.doc.addImage(ctx.logo.data, 'PNG', L.X((PW - w) / 2), L.Y(30), w, h, 'logo-fito', 'FAST');
    }
    L.texto('Catálogo de decants', PW / 2, 92, { fam: 'Playfair', pt: 32, align: 'center' });
    L.texto(`EDICIÓN ${edicion(p.fecha).toUpperCase()}`, PW / 2, 108, { fam: 'PoppinsSB', pt: 8, color: C.oro, esp: 1.2, align: 'center' });
    L.adorno(PW / 2, 117, 50);
    filaFotos(L, ctx, p.destacados, 126, 50, false);
    L.texto('Prueba tu próximo perfume favorito antes de comprar la botella.', PW / 2, 186, { fam: 'PlayfairI', pt: 12.5, color: C.suave, align: 'center' });
    const lado = 26, yq = 210;
    qr(L, 'https://fitoscents.com/', PW / 2 - lado - 6, yq, lado);
    L.texto('Catálogo digital y', PW / 2 + 2, yq + 3, { pt: 9, color: C.suave });
    L.texto('precios al día', PW / 2 + 2, yq + 7.5, { pt: 9, color: C.suave });
    L.texto('fitoscents.com', PW / 2 + 2, yq + 13, { fam: 'PoppinsSB', pt: 12, color: C.oro });
    L.link(PW / 2 + 2, yq + 12, 40, 7, { url: 'https://fitoscents.com/' });
    L.texto('Tijuana y Rosarito, B.C.', PW / 2 + 2, yq + 20.5, { pt: 8, color: C.tenue });
  },

  bienvenida(L, ctx, p) {
    marcoYFondo(L, ctx);
    L.texto('Cómo pedir', M, 22, { fam: 'Playfair', pt: 30 });
    L.linea(M, 38, PW - M, 38, C.oro, 0.45);
    let y = 45;
    y += L.parrafo('Decants 100% originales de perfumes de diseñador y árabes. Prueba tu próximo favorito en un tamaño pequeño antes de invertir en la botella completa.',
      M, y, PW - 2 * M, { pt: 11, color: C.suave, lh: 1.5 }) + 9;

    const pasos = [
      ['Elige tu perfume', 'Busca por sección y marca en el índice. Cada tarjeta trae sus notas principales y, si es el caso, el perfume en el que está inspirado.'],
      ['Escoge el tamaño', `Tenemos ${p.tallas || 'varios tamaños'}. El precio de cada tamaño viene en su tarjeta, y en dorado el que más te conviene.`],
      ['Mándanos mensaje', 'Por WhatsApp al 664 816 2623 o desde fitoscents.com, donde también ves lo disponible al día.'],
    ];
    const wPaso = (PW - 2 * M - 2 * 6) / 3;
    pasos.forEach(([t, d], i) => {
      const x = M + i * (wPaso + 6);
      L.caja(x, y, wPaso, 52, 3, { relleno: '#ffffff', alfaRelleno: 0.045, borde: C.oro, alfaBorde: 0.3 });
      L.texto(String(i + 1), x + 6, y + 5, { fam: 'Playfair', pt: 26, color: C.oro });
      L.texto(t, x + 6, y + 20, { fam: 'PoppinsSB', pt: 10.5 });
      L.parrafo(d, x + 6, y + 28, wPaso - 12, { pt: 8.2, color: C.suave, lh: 1.5, max: 8 });
    });
    L.link(M + 2 * (wPaso + 6), y, wPaso, 52, { url: 'https://wa.me/526648162623' });
    y += 62;

    if (ctx.proExtra > 0) {
      L.caja(M, y, PW - 2 * M, 34, 3, { relleno: C.oro, alfaRelleno: 0.07, borde: C.oro, alfaBorde: 0.5 });
      L.caja(M + 6, y + 6, 13, 6, 1.5, { relleno: C.oro });
      L.texto('PRO', M + 12.5, y + 7.2, { fam: 'PoppinsB', pt: 8, color: C.oscuro, esp: 0.4, align: 'center' });
      L.texto('Decant PRO', M + 23, y + 6, { fam: 'Playfair', pt: 14 });
      L.parrafo(`En 5 y 10 ml puedes pedirlo en envase reforzado y cubierto de aluminio de color: aguanta caídas y es ideal para traerlo contigo. Cuesta $${ctx.proExtra} más y eliges el color.`,
        M + 6, y + 15, PW - 2 * M - 70, { pt: 8.4, color: C.suave, lh: 1.5, max: 4 });
      COLORES_PRO.forEach((c, i) => {
        const cx = PW - M - 58 + i * 8.2, cy = y + 21;
        L.doc.setFillColor(...rgb(c.hex));
        L.doc.circle(L.X(cx), L.Y(cy), 3, 'F');
        L.alfa(0.6);
        L.doc.setDrawColor(...rgb(C.oro));
        L.doc.setLineWidth(0.2);
        L.doc.circle(L.X(cx), L.Y(cy), 3, 'S');
        L.alfa(1);
      });
      y += 44;
    }
    y += cajaDato(L, p.dato, M, y, PW - 2 * M) + 10;
    L.parrafo(`Precios vigentes al ${fechaLarga(p.fecha)}. Pueden cambiar sin aviso: consulta los precios y la disponibilidad al día en fitoscents.com.`,
      M, Math.max(y, PH - 40), PW - 2 * M, { pt: 7.5, color: C.tenue, lh: 1.5 });
    pie(L, ctx, p.numero);
  },

  indice(L, ctx, p) {
    marcoYFondo(L, ctx);
    L.texto('Índice', M, 22, { fam: 'Playfair', pt: 30 });
    L.linea(M, 38, PW - M, 38, C.oro, 0.45);
    const cols = ctx.indice.length || 1;
    const sep = 8, wCol = (PW - 2 * M - sep * (cols - 1)) / cols;
    const filasMax = Math.max(...ctx.indice.map(e => e.marcas.length), 1);
    const yIni = 48, yFin = PH - 52;
    const fila = Math.min(6.4, (yFin - yIni - 18) / filasMax);
    ctx.indice.forEach((e, i) => {
      const x = M + i * (wCol + sep);
      L.texto(e.seccion.titulo, x, yIni, { fam: 'Playfair', pt: 17 });
      L.texto(String(e.pagina), x + wCol, yIni + 1.5, { fam: 'Playfair', pt: 13, color: C.oro, align: 'right' });
      L.texto(`${e.total} perfumes`, x, yIni + 8.5, { pt: 7, color: C.tenue });
      L.link(x, yIni - 1, wCol, 13, { pageNumber: e.pagina });
      L.linea(x, yIni + 13.5, x + wCol, yIni + 13.5, C.oro, 0.35);
      e.marcas.forEach((m, j) => {
        const y = yIni + 17 + j * fila;
        L.fuente('Poppins', 8.6);
        const [nombre] = partirLineas(m.marca, q => L.doc.getTextWidth(q), wCol - 14, 1);
        const wn = L.texto(nombre, x, y, { pt: 8.6 });
        L.texto(String(m.pagina), x + wCol, y, { fam: 'PoppinsSB', pt: 8.6, color: C.oro, align: 'right' });
        // Puntitos guía entre la marca y la hoja.
        L.alfa(0.35);
        L.doc.setFillColor(...rgb(C.oro));
        for (let px = x + wn + 2; px < x + wCol - 7; px += 1.6) L.doc.circle(L.X(px), L.Y(y + 2.2), 0.18, 'F');
        L.alfa(1);
        L.link(x, y - 0.8, wCol, fila, { pageNumber: m.pagina });
      });
    });
    const consejos = ctx.paginas.find(q => q.tipo === 'consejos');
    if (consejos) {
      const y = PH - 44;
      L.linea(M, y - 4, PW - M, y - 4, C.oro, 0.3);
      L.texto('Consejos para que tu perfume dure más', M, y, { fam: 'PlayfairI', pt: 11, color: C.suave });
      L.texto(String(consejos.numero), PW - M, y, { fam: 'Playfair', pt: 11, color: C.oro, align: 'right' });
      L.link(M, y - 1, PW - 2 * M, 7, { pageNumber: consejos.numero });
    }
    pie(L, ctx, p.numero);
  },

  casas(L, ctx, p) {
    marcoYFondo(L, ctx);
    L.texto('Nuestras casas', M, 22, { fam: 'Playfair', pt: 30 });
    L.linea(M, 38, PW - M, 38, C.oro, 0.45);
    L.texto(`${p.marcas.length} marcas de diseñador y árabes. Toca una para ir a sus perfumes.`, M, 42, { pt: 8.5, color: C.tenue });
    const cols = 4, sep = 5;
    const filas = Math.ceil(p.marcas.length / cols);
    const top = 52, abajo = PH - 26;
    const w = (PW - 2 * M - sep * (cols - 1)) / cols;
    const h = Math.min(28, (abajo - top - sep * (filas - 1)) / filas);
    p.marcas.forEach((m, i) => {
      const x = M + (i % cols) * (w + sep), y = top + Math.floor(i / cols) * (h + sep);
      L.caja(x, y, w, h, 2.5, { relleno: '#ffffff', alfaRelleno: 0.04, borde: C.oro, alfaBorde: 0.25 });
      const op = { alto: 7.5, pt: 9.5, align: 'center', lineas: 2 };
      const usado = medirMarca(L, ctx, m.marca, w - 10, op);
      marca(L, ctx, m.marca, x + 5, y + (h - usado) / 2 - 1, w - 10, op);
      L.texto(String(m.pagina), x + w - 3, y + h - 5, { fam: 'Playfair', pt: 7.5, color: C.tenue, align: 'right' });
      L.link(x, y, w, h, { pageNumber: m.pagina });
    });
    pie(L, ctx, p.numero);
  },

  seccion(L, ctx, p) {
    marcoYFondo(L, ctx, true);
    L.texto('COLECCIÓN', PW / 2, 46, { fam: 'PoppinsSB', pt: 8, color: C.oro, esp: 1.6, align: 'center' });
    L.texto(p.seccion.titulo, PW / 2, 53, { fam: 'Playfair', pt: 58, align: 'center' });
    L.adorno(PW / 2, 81, 70);
    L.texto(`${p.total} perfumes  ·  ${p.marcas} ${p.marcas === 1 ? 'marca' : 'marcas'}`, PW / 2, 86, { pt: 10, color: C.suave, align: 'center' });
    if (p.destacados.length) {
      L.texto('LOS MÁS BUSCADOS', PW / 2, 103, { fam: 'PoppinsSB', pt: 6.5, color: C.tenue, esp: 1, align: 'center' });
      filaFotos(L, ctx, p.destacados, 110, 46);
    }
    if (p.dato) cajaDato(L, p.dato, 38, 190, PW - 76);
    pie(L, ctx, p.numero);
  },

  novedades(L, ctx, p) {
    marcoYFondo(L, ctx, true);
    L.texto('RECIÉN LLEGADOS', PW / 2, 46, { fam: 'PoppinsSB', pt: 8, color: C.oro, esp: 1.6, align: 'center' });
    L.texto('Lo nuevo', PW / 2, 53, { fam: 'Playfair', pt: 58, align: 'center' });
    L.adorno(PW / 2, 81, 70);
    L.texto(`${p.total} ${p.total === 1 ? 'perfume' : 'perfumes'} desde el ${fechaLarga(p.desde)}`, PW / 2, 86, { pt: 10, color: C.suave, align: 'center' });
    if (p.destacados.length) filaFotos(L, ctx, p.destacados, 104, 46);
    if (p.dato) cajaDato(L, p.dato, 38, 190, PW - 76);
    pie(L, ctx, `Lo nuevo · ${p.numero}`);
  },

  perfumes(L, ctx, p) {
    marcoYFondo(L, ctx);
    cabeza(L, p.titulo, p.conGenero ? '' : rangoMarcas(p.items));
    const cols = 3, filas = 2, sepX = 5.5, sepY = 6;
    const top = 33, abajo = PH - 24;
    const w = (PW - 2 * M - sepX * (cols - 1)) / cols;
    const h = (abajo - top - sepY * (filas - 1)) / filas;
    const celdas = [...p.items.map(t => ['t', t]), ...p.relleno.map(d => ['d', d])];
    celdas.forEach(([tipo, v], i) => {
      const x = M + (i % cols) * (w + sepX), y = top + Math.floor(i / cols) * (h + sepY);
      if (tipo === 't') tarjeta(L, ctx, v, x, y, w, h, p.conGenero);
      else tarjetaDato(L, v, x, y, w, h);
    });
    pie(L, ctx, ctx.tipo === 'novedades' ? `Lo nuevo · ${p.numero}` : p.numero);
  },

  consejos(L, ctx, p) {
    marcoYFondo(L, ctx);
    L.texto('Para que tu perfume dure más', M, 22, { fam: 'Playfair', pt: 26 });
    L.linea(M, 36, PW - M, 36, C.oro, 0.45);
    const cols = 2, sep = 7, w = (PW - 2 * M - sep) / cols, h = 52;
    CONSEJOS.forEach((c, i) => {
      const x = M + (i % cols) * (w + sep), y = 46 + Math.floor(i / cols) * (h + sep);
      L.caja(x, y, w, h, 3, { relleno: '#ffffff', alfaRelleno: 0.045, borde: C.oro, alfaBorde: 0.3 });
      L.texto(String(i + 1).padStart(2, '0'), x + 7, y + 6, { fam: 'Playfair', pt: 22, color: C.oro });
      L.texto(c.titulo, x + 7, y + 19, { fam: 'PoppinsSB', pt: 11 });
      L.parrafo(c.texto, x + 7, y + 27, w - 14, { pt: 9, color: C.suave, lh: 1.5, max: 5 });
    });
    pie(L, ctx, p.numero);
  },

  contraportada(L, ctx, p) {
    marcoYFondo(L, ctx, true);
    if (ctx.logo) {
      const w = 70, h = w * ctx.logo.h / ctx.logo.w;
      L.doc.addImage(ctx.logo.data, 'PNG', L.X((PW - w) / 2), L.Y(28), w, h, 'logo-fito', 'FAST');
    }
    L.texto('Síguenos', PW / 2, 80, { fam: 'Playfair', pt: 26, align: 'center' });
    L.adorno(PW / 2, 96, 50);
    let y = 104;
    for (const r of REDES) {
      L.texto(r.red.toUpperCase(), PW / 2 - 4, y + 1.4, { fam: 'PoppinsSB', pt: 7, color: C.oro, esp: 0.8, align: 'right' });
      L.texto(r.texto, PW / 2 + 4, y, { fam: 'PoppinsM', pt: 12.5 });
      L.link(PW / 2 - 50, y - 1.5, 100, 9, { url: r.url });
      y += 11;
    }
    const lado = 46, yq = 172;
    qr(L, 'https://fitoscents.com/', (PW - lado) / 2, yq, lado);
    L.texto('Escanéalo para ver el catálogo digital', PW / 2, yq + lado + 5, { pt: 9, color: C.suave, align: 'center' });
    L.texto('y los precios al día', PW / 2, yq + lado + 9.5, { pt: 9, color: C.suave, align: 'center' });
    L.texto(`Tijuana y Rosarito, B.C.  ·  Precios al ${fechaLarga(p.fecha)}`, PW / 2, PH - 22, { pt: 7.5, color: C.tenue, align: 'center' });
  },
};

/**
 * Genera el PDF.
 * @param {object[]} perfumes  de Firestore (con id)
 * @param {{modo?:'digital'|'imprenta', tipo?:'completo'|'novedades', desde?:number, fecha?:number,
 *          disable2ml?:boolean, proExtra?:number, logosExtra?:Object<string,string>,
 *          progreso?:(msg:string, hechas?:number, total?:number)=>void}} op
 * @returns {Promise<{blob:Blob, nombre:string, paginas:number, catalogo:object, sinFoto:string[]}>}
 */
export async function generarCatalogo(perfumes, op = {}) {
  const { modo = 'digital', tipo = 'completo', fecha = Date.now(), progreso = () => {} } = op;
  const conf = MODOS[modo] || MODOS.digital;
  if (!window.jspdf) throw new Error('No cargó la librería de PDF (jsPDF). Revisa tu internet y recarga.');
  const catalogo = armarCatalogo(perfumes, { ...op, tipo, fecha });
  if (!catalogo.conteo.total) throw new Error(tipo === 'novedades' ? 'No hay perfumes nuevos desde esa fecha.' : 'No hay perfumes para el catálogo.');

  progreso('Preparando letras y fondo…');
  const fuentes = await cargarFuentes();
  const B = conf.sangrado;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [PW + 2 * B, PH + 2 * B], orientation: 'portrait', compress: true });
  for (const [fam, archivo, b64] of fuentes) {
    doc.addFileToVFS(`${archivo}.ttf`, b64);
    doc.addFont(`${archivo}.ttf`, fam, 'normal');
  }
  doc.setProperties({ title: `Fito Scents · Catálogo de decants · ${edicion(fecha)}`, author: 'Fito Scents', subject: 'Catálogo de decants', creator: 'fitoscents.com' });

  const logoCv = await logoSinFondo();
  const marcas = new Set(catalogo.paginas.flatMap(pg => [...(pg.items || []), ...(pg.destacados || [])].map(t => t.marca)));
  progreso('Preparando logos de las marcas…');
  const ctx = {
    B, tipo, proExtra: Number(op.proExtra) || 0, logos: await cargarLogos(marcas, op.logosExtra),
    paginas: catalogo.paginas, indice: catalogo.indice,
    fechaCorta: new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    fondo: fondo(PW + 2 * B, PH + 2 * B, conf.fondoPx, [0.05, 0.9, 0.09]),
    fondoPortada: fondo(PW + 2 * B, PH + 2 * B, conf.fondoPx, [0.42, 0.85, 0.16]),
    logo: logoCv ? { data: logoCv.toDataURL('image/png'), w: logoCv.width, h: logoCv.height } : null,
    fotos: new Map(),
  };

  // Fotos: una vez cada perfume (tarjetas, portada y portadillas).
  const conFoto = new Map();
  for (const pg of catalogo.paginas) for (const t of [...(pg.items || []), ...(pg.destacados || [])]) conFoto.set(t.id, t);
  const lista = [...conFoto.values()];
  let hechas = 0;
  const sinFoto = [];
  await enParalelo(lista, 6, async t => {
    const data = await fotoCuadrada(t.imagen, conf.px, conf.calidad);
    if (data) ctx.fotos.set(t.id, data); else sinFoto.push(`${t.marca} ${t.nombre}`);
    progreso('Bajando fotos…', ++hechas, lista.length);
  });

  progreso('Armando las hojas…');
  catalogo.paginas.forEach((pg, i) => {
    if (i > 0) doc.addPage([PW + 2 * B, PH + 2 * B], 'portrait');
    HOJAS[pg.tipo](crearLapiz(doc, B), ctx, pg);
  });

  // Marcadores (el índice lateral del lector de PDF).
  const o = doc.outline;
  if (o) {
    for (const pg of catalogo.paginas) {
      if (pg.tipo === 'portada') o.add(null, 'Portada', { pageNumber: pg.numero });
      if (pg.tipo === 'bienvenida') o.add(null, 'Cómo pedir', { pageNumber: pg.numero });
      if (pg.tipo === 'indice') o.add(null, 'Índice', { pageNumber: pg.numero });
      if (pg.tipo === 'novedades') o.add(null, 'Lo nuevo', { pageNumber: pg.numero });
      if (pg.tipo === 'consejos') o.add(null, 'Consejos', { pageNumber: pg.numero });
    }
    for (const e of catalogo.indice) {
      const nodo = o.add(null, e.seccion.titulo, { pageNumber: e.pagina });
      for (const m of e.marcas) o.add(nodo, m.marca, { pageNumber: m.pagina });
    }
  }

  const blob = doc.output('blob');
  return { blob, nombre: nombreArchivo({ tipo, modo, fecha }), paginas: catalogo.paginas.length, catalogo, sinFoto };
}
