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

  // Si hay match directo, salimos rápido
  if (target.includes(query)) return true;

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
  
  const targetTokens = target.split(/\s+/);
  
  // Para cada token de la búsqueda, debe haber un match en el target
  for (let q of expandedTokens) {
    let matched = false;
    
    // Primero probar si es substring directo de todo el target
    if (target.includes(q)) {
      continue;
    }
    
    // Si no es substring, intentamos búsqueda difusa en cada palabra del target
    for (let t of targetTokens) {
      if (t.includes(q)) {
        matched = true;
        break;
      }
      
      // Reglas de distancia Levenshtein
      let maxDist = 0;
      if (q.length >= 6) maxDist = 2;
      else if (q.length >= 4) maxDist = 1;
      
      if (maxDist > 0) {
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

// Adjuntar a window para disponibilidad global en entornos mixtos
window.matchSearch = matchSearch;
