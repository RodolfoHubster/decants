/**
 * newsletter.js — Suscripción al correo de novedades y armado del correo. Sin DOM.
 *
 * La tienda guarda cada correo en Firestore (suscriptores/<correo>, que el
 * visitante solo puede crear). El envío se hace con Brevo: el panel arma cada
 * martes el correo con lo nuevo de la semana para pegarlo ahí.
 */

const RE_CORREO = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

/** Correo en minúsculas y sin espacios. */
export function normalizarCorreo(email) {
  return String(email || '').trim().toLowerCase();
}

/** ¿Parece un correo válido? (sin "/" porque es también el id del documento). */
export function correoValido(email) {
  const e = normalizarCorreo(email);
  return e.length >= 6 && e.length <= 120 && RE_CORREO.test(e);
}

/** El documento de cada suscriptor: id = el correo, así nadie se anota dos veces. */
export function suscripcion(email, origen = 'tienda', ahora = Date.now()) {
  const e = normalizarCorreo(email);
  return { id: e, datos: { email: e, creadoEn: ahora, origen } };
}

/**
 * Lo nuevo desde `desde` (ms): decants (perfumes y paquetes activos) y
 * perfumes completos, del más reciente al más viejo.
 */
export function novedadesDesde({ perfumes = [], completos = [] } = {}, desde = 0) {
  const nuevo = p => p && p.activo !== false && !p.archivado && (Number(p.creadoEn) || 0) >= desde;
  return {
    decants: perfumes.filter(nuevo).sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0)),
    completos: completos.filter(nuevo).sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0)),
  };
}

const precioDesde = precios => {
  const vals = Object.values(precios || {}).map(Number).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : 0;
};

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Correo de novedades listo para pegar en Brevo (HTML con tablas, que es lo que
 * leen bien Gmail y Outlook) y su versión en texto.
 *
 * @param {{decants:Array, completos:Array}} novedades
 * @param {{base:string, link:(p)=>string, img:(url)=>string}} op
 *   base = carpeta del sitio; link(p) = ruta de la página del perfume; img = Cloudinary.
 */
export function armarCorreo(novedades, { base, link, img }) {
  const filas = [];
  const texto = ['Novedades de Fitoscents', ''];
  const tarjeta = (nombre, marca, precio, url, foto) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #2a2620">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        ${foto ? `<td width="96" valign="top"><a href="${url}"><img src="${foto}" width="88" height="88" alt="${esc(nombre)}" style="display:block;border-radius:10px;object-fit:cover"></a></td>` : ''}
        <td valign="middle" style="font-family:Arial,sans-serif;color:#f0ece4">
          <div style="font-size:11px;color:#c9a84c;text-transform:uppercase;letter-spacing:1px">${esc(marca || '')}</div>
          <div style="font-size:17px;font-weight:bold;margin:2px 0 4px"><a href="${url}" style="color:#f0ece4;text-decoration:none">${esc(nombre)}</a></div>
          ${precio ? `<div style="font-size:14px;color:#c9a84c">Desde $${precio} MXN</div>` : ''}
        </td>
      </tr></table>
    </td></tr>`;

  if (novedades.decants.length) {
    filas.push('<tr><td style="padding:18px 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#888880;text-transform:uppercase;letter-spacing:1px">Nuevos decants</td></tr>');
    texto.push('NUEVOS DECANTS');
    novedades.decants.forEach(p => {
      const url = base + link(p);
      const precio = precioDesde(p.precios);
      filas.push(tarjeta(p.nombre, p.marca || (p.tipo === 'paquete' ? 'Combos Fitoscents' : ''), precio, url, img(p.imagen)));
      texto.push(`- ${p.marca ? p.marca + ' · ' : ''}${p.nombre}${precio ? ` — desde $${precio}` : ''}: ${url}`);
    });
  }
  if (novedades.completos.length) {
    filas.push('<tr><td style="padding:18px 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#888880;text-transform:uppercase;letter-spacing:1px">Perfumes completos</td></tr>');
    texto.push('', 'PERFUMES COMPLETOS');
    novedades.completos.forEach(p => {
      const url = base + 'perfumes-completos.html';
      const precio = precioDesde(p.precios);
      filas.push(tarjeta(p.nombre, p.marca, precio, url, img(p.imagen)));
      texto.push(`- ${p.marca ? p.marca + ' · ' : ''}${p.nombre}${precio ? ` — desde $${precio}` : ''}: ${url}`);
    });
  }
  texto.push('', `Ver todo: ${base}`, 'Pide por WhatsApp: https://wa.me/526648162623');

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px">
    <tr><td style="font-family:Georgia,serif;font-size:26px;color:#f0ece4;padding-bottom:4px">Novedades de la semana</td></tr>
    <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#888880;padding-bottom:8px">Lo nuevo en Fitoscents: decants originales desde 2 ml.</td></tr>
    ${filas.join('')}
    <tr><td style="padding:22px 0 6px" align="center">
      <a href="${base}" style="display:inline-block;background:#c9a84c;color:#14120e;font-family:Arial,sans-serif;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px;text-decoration:none">Ver el catálogo</a>
    </td></tr>
    <tr><td align="center" style="font-family:Arial,sans-serif;font-size:13px;padding-top:8px"><a href="https://wa.me/526648162623" style="color:#25D366;text-decoration:none">Pide por WhatsApp</a></td></tr>
  </table>
</td></tr></table>`;
  return { html, texto: texto.join('\n'), total: novedades.decants.length + novedades.completos.length };
}
