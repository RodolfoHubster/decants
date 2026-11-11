const ACRONYMS = {
  'ysl': 'yves saint laurent',
  'jpg': 'jean paul gaultier',
  'ch': 'carolina herrera',
  'pdm': 'parfums de marly',
  'tf': 'tom ford',
  'd&g': 'dolce gabbana',
  'dg': 'dolce gabbana',
  'swy': 'stronger with you',
  'lveb': 'la vie est belle',
  'cdn': 'club de nuit',
  'cdnim': 'club de nuit intense man',
  'v&r': 'viktor rolf',
  'vr': 'viktor rolf',
  'adg': 'acqua di gio'
};

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1) // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Motor de búsqueda inteligente:
 * Soporta expansión de acrónimos y búsqueda por proximidad (errores de tipeo).
 */
export function matchSearch(query, target) {
  query = normalize(query);
  target = normalize(target);
  
  if (!query) return true;
  if (!target) return false;

  const targetTokens = target.split(/\s+/);
  // 1 o 2 letras ("le", "cd") solo cuentan al principio de una palabra: antes
  // "le" encontraba "bleu", "toilette"... casi todo.
  const aparece = q => (q.length <= 2 ? targetTokens.some(t => t.startsWith(q)) : target.includes(q));

  // Si hay match directo, salimos rápido
  if (aparece(query)) return true;
  // Sin espacios: "lebeau" encuentra "Le Beau", "clubdenuit" encuentra "Club de Nuit".
  const junto = s => s.replace(/[^a-z0-9]/g, '');
  if (query.length >= 4 && junto(target).includes(junto(query))) return true;

  let queryTokens = query.split(/\s+/);
  
  // Expandir acrónimos en los tokens
  const expandedTokens = [];
  for (let t of queryTokens) {
    if (ACRONYMS[t]) {
      expandedTokens.push(...ACRONYMS[t].split(/\s+/));
    } else {
      expandedTokens.push(t);
    }
  }
  
  // Para cada token de la búsqueda, debe haber un match en el target
  for (let q of expandedTokens) {
    let matched = false;

    // Primero probar si es substring directo de todo el target
    if (aparece(q)) {
      continue;
    }

    // Si no es substring, intentamos búsqueda difusa en cada palabra del target
    for (let t of targetTokens) {
      if (q.length > 2 && t.includes(q)) {
        matched = true;
        break;
      }
      
      // Reglas de distancia Levenshtein
      let maxDist = 0;
      if (q.length >= 6) maxDist = 2;
      else if (q.length >= 4) maxDist = 1;
      
      // El error de dedo se tolera si empieza con la misma letra: antes "beau"
      // encontraba "eau" y salían todos los Eau de Toilette.
      if (maxDist > 0 && t[0] === q[0]) {
        // Solo calcular levenshtein si la diferencia de longitudes no es absurda
        if (Math.abs(q.length - t.length) <= maxDist + 1) {
          if (levenshtein(q, t) <= maxDist) {
            matched = true;
            break;
          }
        }
      }
    }
    
    if (!matched) return false;
  }
  
  return true;
}

/**
 * Qué tan bien coincide una búsqueda, para ordenar los resultados (más alto,
 * más arriba). `campos` va de más a menos importante: [nombre, marca + nombre,
 * original del dupe]. Manda el campo (lo que coincide en el nombre va antes
 * que lo que coincide por la marca, y eso antes que los dupes); dentro del
 * mismo campo, de mejor a peor: igual, empieza igual, empieza una palabra,
 * contiene, y por palabras o con error de dedo.
 * Los espacios no importan: "lebeau" es "Le Beau". 0 si no coincide.
 */
export function puntajeBusqueda(query, campos) {
  const q = normalize(query);
  if (!q) return 0;
  const junto = s => s.replace(/[^a-z0-9]/g, '');
  const qj = junto(q);
  let mejor = 0;
  (campos || []).forEach((campo, i) => {
    const t = normalize(campo);
    if (!t) return;
    const tj = junto(t);
    const palabras = t.split(/\s+/);
    let nivel = 0;
    if (t === q || (qj && tj === qj)) nivel = 5;
    else if (t.startsWith(q) || (qj && tj.startsWith(qj))) nivel = 4;
    else if (palabras.some((_, k) => palabras.slice(k).join(' ').startsWith(q))) nivel = 3;
    else if (t.includes(q) || (qj && tj.includes(qj))) nivel = 2;
    else if (matchSearch(q, t)) nivel = 1;
    if (nivel) mejor = Math.max(mejor, (campos.length - i) * 10 + nivel);
  });
  return mejor;
}

// Adjuntar a window para disponibilidad global en entornos mixtos
if (typeof window !== "undefined") window.matchSearch = matchSearch;
