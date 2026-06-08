/**
 * slug.js — utilidades de URL por perfume
 * Genera slugs y construye/lee URLs limpias.
 */

/**
 * toSlug('Jean Lowe Summer Vibes') → 'jean-lowe-summer-vibes'
 * Elimina acentos, caracteres especiales y espacios.
 */
export function toSlug(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')      // solo letras, números, guión
    .trim()
    .replace(/\s+/g, '-')              // espacios → guión
    .replace(/-+/g, '-');              // guiones múltiples → uno
}

/**
 * perfumeURL(perfume) → '/perfumes/hawas-london'
 * Combina marca + nombre para el slug.
 */
export function perfumeURL(p) {
  const base = [p.marca, p.nombre].filter(Boolean).join(' ');
  return '/perfumes/' + toSlug(base);
}

/**
 * getSlugFromURL() → 'hawas-london' | null
 * Lee el slug actual de window.location.pathname.
 */
export function getSlugFromURL() {
  const match = window.location.pathname.match(/^\/perfumes\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * findBySlug(all, slug) → perfume | undefined
 * Busca en el arreglo 'all' el perfume cuyo slug coincida.
 */
export function findBySlug(all, slug) {
  if (!slug) return undefined;
  return all.find(p => {
    const base = [p.marca, p.nombre].filter(Boolean).join(' ');
    return toSlug(base) === slug;
  });
}
