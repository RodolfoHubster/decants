/**
 * slug.js — utilidades de URL por perfume
 * Usa hash routing (#/perfumes/slug) para compatibilidad con GitHub Pages.
 */

/**
 * toSlug('Jean Lowe Summer Vibes') → 'jean-lowe-summer-vibes'
 */
export function toSlug(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * perfumeURL(p) → '#/perfumes/hawas-london'
 */
export function perfumeURL(p) {
  const base = [p.marca, p.nombre].filter(Boolean).join(' ');
  return '#/perfumes/' + toSlug(base);
}

/**
 * perfumeFullURL(p) → 'https://rodolfohubster.github.io/decants/#/perfumes/hawas-london'
 */
export function perfumeFullURL(p) {
  const origin = window.location.origin + window.location.pathname.replace(/\/$/, '');
  return origin + perfumeURL(p);
}

/**
 * getSlugFromHash() → 'hawas-london' | null
 * Lee el slug del hash actual: #/perfumes/hawas-london
 */
export function getSlugFromHash() {
  const match = window.location.hash.match(/^#\/perfumes\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * findBySlug(all, slug) → perfume | undefined
 */
export function findBySlug(all, slug) {
  if (!slug) return undefined;
  return all.find(p => {
    const base = [p.marca, p.nombre].filter(Boolean).join(' ');
    return toSlug(base) === slug;
  });
}
