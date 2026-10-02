/**
 * ficha.js — Lee la descripción estructurada de un perfume para pintarla como
 * pirámide en la tienda. Sin DOM.
 *
 * Formato (el que genera la IA y el que tienen las fichas del catálogo):
 *
 *   <frase de personalidad>
 *
 *   Salida: a, b, c
 *   Corazón: d, e
 *   Fondo: f, g
 *        (o una sola línea "Notas: a, b, c" si no hay pirámide)
 *
 *   Duración: Alta (más de 8 h) · Estela: fuerte
 *   Ideal para: Noche · Clima frío
 *
 * Si la descripción es un párrafo libre, `estructurada` es false y la tienda
 * la muestra tal cual.
 */

const sinAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = t => String(t || '').split(',').map(x => x.trim()).filter(Boolean);

/** 1 = baja, 2 = moderada, 3 = alta/fuerte; 0 si no se reconoce. */
export function nivel(texto) {
  const t = sinAcento(texto);
  if (/\b(alta|fuerte|intensa|enorme)\b/.test(t)) return 3;
  if (/\b(moderada|media)\b/.test(t)) return 2;
  if (/\b(baja|discreta|suave|ligera)\b/.test(t)) return 1;
  return 0;
}

export function parsearFicha(descripcion) {
  const texto = String(descripcion || '').replace(/\r/g, '').trim();
  const r = {
    estructurada: false, frase: '', salida: [], corazon: [], fondo: [], notas: [],
    duracion: '', duracionNivel: 0, estela: '', estelaNivel: 0, momento: [], clima: '',
  };
  if (!texto) return r;

  const lineas = texto.split('\n').map(l => l.trim());
  const frase = [];
  for (const l of lineas) {
    const m = l.match(/^([^:]{3,14}):\s*(.+)$/);
    const clave = m ? sinAcento(m[1]) : '';
    if (clave === 'salida') r.salida = lista(m[2]);
    else if (clave === 'corazon') r.corazon = lista(m[2]);
    else if (clave === 'fondo') r.fondo = lista(m[2]);
    else if (clave === 'notas') r.notas = lista(m[2]);
    else if (clave === 'duracion') {
      // "Alta (más de 8 h) · Estela: fuerte"
      const [dur, est] = m[2].split('·').map(x => x.trim());
      r.duracion = dur || '';
      r.duracionNivel = nivel(dur);
      const e = (est || '').match(/estela:\s*(.+)$/i);
      if (e) { r.estela = e[1].trim(); r.estelaNivel = nivel(e[1]); }
    } else if (clave === 'estela') {
      r.estela = m[2].trim(); r.estelaNivel = nivel(m[2]);
    } else if (clave === 'ideal para') {
      const partes = m[2].split('·').map(x => x.trim()).filter(Boolean);
      const momento = partes[0] || '';
      r.momento = /dia y noche/.test(sinAcento(momento)) ? ['Día', 'Noche']
        : sinAcento(momento).includes('noche') ? ['Noche']
        : sinAcento(momento).includes('dia') ? ['Día'] : [];
      r.clima = partes[1] || '';
    } else if (l && !r.salida.length && !r.notas.length) {
      frase.push(l);
    }
  }
  r.frase = frase.join(' ');
  r.estructurada = !!(r.salida.length || r.corazon.length || r.fondo.length || r.notas.length);
  return r;
}
